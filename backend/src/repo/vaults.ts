import sql from "mssql";
import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export type VaultPermissions = "read" | "write";

export type VaultPurpose = "primary" | "transfer";

export const createVault = async (
  owner_user_id: string | null,
  team_id: string | null,
  kind: "personal" | "team",
  version: number,
  vault_key_wrapped: string,
  purpose: VaultPurpose = "primary"
) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("owner_user_id", owner_user_id)
    .input("team_id", team_id)
    .input("kind", kind)
    .input("version", version)
    .input("vault_key_wrapped", vault_key_wrapped)
    .input("purpose", purpose)
    .query(
      "INSERT INTO dbo.vaults (id,owner_user_id,team_id,kind,version,vault_key_wrapped,purpose,created_at,updated_at) VALUES (@id,@owner_user_id,@team_id,@kind,@version,@vault_key_wrapped,@purpose,SYSUTCDATETIME(),SYSUTCDATETIME())"
    );
  return id;
};

export const listVaultsForUser = async (userId: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("user_id", userId)
    .query(
      `SELECT v.*,
        CASE WHEN v.kind='personal' AND v.owner_user_id=@user_id AND v.purpose='primary' THEN 1 ELSE 0 END as is_own_primary,
        COALESCE(
          CASE WHEN v.owner_user_id=@user_id THEN v.vault_key_wrapped END,
          s.wrapped_key,
          tm_last.team_key_wrapped
        ) as vault_key_wrapped_for_user,
        COALESCE(
          s.permissions,
          CASE WHEN tm_last.role IN ('owner','admin','editor') THEN 'write' ELSE 'read' END
        ) as permissions
      FROM dbo.vaults v
      LEFT JOIN dbo.shares s ON s.source_vault_id=v.id AND s.target_user_id=@user_id
      OUTER APPLY (
        SELECT TOP 1 tm2.*
        FROM dbo.team_members tm2
        WHERE tm2.team_id = v.team_id AND tm2.user_id=@user_id AND tm2.revoked_at IS NULL
        ORDER BY tm2.invited_at DESC
      ) tm_last
      WHERE (v.owner_user_id=@user_id)
        OR (v.team_id IS NOT NULL AND tm_last.id IS NOT NULL AND tm_last.joined_at IS NOT NULL)
        OR (s.id IS NOT NULL)
      ORDER BY is_own_primary DESC, v.created_at ASC`
    );
  return r.recordset;
};

export const getVault = async (id: string) => {
  const pool = await getPool();
  const r = await pool.request().input("id", id).query("SELECT * FROM dbo.vaults WHERE id=@id");
  return r.recordset[0] || null;
};

export const getVaultAccessForUser = async (
  vault_id: string,
  user_id: string
): Promise<{ permissions: VaultPermissions } | null> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("vault_id", vault_id)
    .input("user_id", user_id)
    .query(
      "SELECT TOP 1 COALESCE(s.permissions, CASE WHEN v.owner_user_id=@user_id THEN 'write' WHEN tm.role IN ('owner','admin','editor') THEN 'write' ELSE 'read' END) as permissions FROM dbo.vaults v LEFT JOIN dbo.shares s ON s.source_vault_id=v.id AND s.target_user_id=@user_id LEFT JOIN dbo.team_members tm ON tm.team_id=v.team_id AND tm.user_id=@user_id AND tm.revoked_at IS NULL AND tm.joined_at IS NOT NULL WHERE v.id=@vault_id AND (v.owner_user_id=@user_id OR s.id IS NOT NULL OR tm.id IS NOT NULL)"
    );
  const row = r.recordset[0] as { permissions?: string } | undefined;
  const permissions = row?.permissions;
  if (permissions === "read" || permissions === "write") return { permissions };
  return null;
};

export const canUserAccessVault = async (vault_id: string, user_id: string) => {
  const access = await getVaultAccessForUser(vault_id, user_id);
  return access !== null;
};

export const hasPrimaryPersonalVault = async (user_id: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("user_id", user_id)
    .query("SELECT TOP 1 id FROM dbo.vaults WHERE kind='personal' AND owner_user_id=@user_id AND purpose='primary'");
  return r.recordset.length > 0;
};

/**
 * Swap a vault to a new key in one transaction: the owner's wrapped key, every
 * remaining share's wrapped key, and the snapshot re-encrypted with the new key.
 * Readers therefore never see the new snapshot with an old key or the reverse.
 */
export const commitKeyRotation = async (args: {
  vault_id: string;
  expected_key_version: number;
  vault_key_wrapped: string;
  shares: { share_id: string; wrapped_key: string }[];
  blob: { id: string; content_sha256: string; storage_kind: "fs" | "db"; storage_ref: string; size_bytes: number; created_by: string };
}): Promise<{ ok: true; key_version: number } | { ok: false; error: "stale_key_version" }> => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const upd = await new sql.Request(tx)
      .input("id", args.vault_id)
      .input("expected", args.expected_key_version)
      .input("wrapped", args.vault_key_wrapped)
      .query(
        "UPDATE dbo.vaults SET vault_key_wrapped=@wrapped, key_version=key_version+1, updated_at=SYSUTCDATETIME() OUTPUT inserted.key_version WHERE id=@id AND key_version=@expected"
      );
    if (upd.recordset.length !== 1) {
      await tx.rollback();
      return { ok: false, error: "stale_key_version" };
    }
    for (const s of args.shares) {
      await new sql.Request(tx)
        .input("id", s.share_id)
        .input("vault_id", args.vault_id)
        .input("wrapped", s.wrapped_key)
        .query("UPDATE dbo.shares SET wrapped_key=@wrapped WHERE id=@id AND source_vault_id=@vault_id");
    }
    await new sql.Request(tx)
      .input("id", args.blob.id)
      .input("vault_id", args.vault_id)
      .input("sha", args.blob.content_sha256)
      .input("kind", args.blob.storage_kind)
      .input("ref", args.blob.storage_ref)
      .input("size", args.blob.size_bytes)
      .input("by", args.blob.created_by)
      .query(
        "INSERT INTO dbo.vault_blobs (id,vault_id,blob_type,content_sha256,storage_kind,storage_ref,size_bytes,created_by,created_at) VALUES (@id,@vault_id,'snapshot',@sha,@kind,@ref,@size,@by,SYSUTCDATETIME())"
      );
    await tx.commit();
    return { ok: true, key_version: Number(upd.recordset[0].key_version) };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
};
