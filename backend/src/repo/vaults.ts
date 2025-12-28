import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export type VaultPermissions = "read" | "write";

export const createVault = async (owner_user_id: string | null, team_id: string | null, kind: "personal" | "team", version: number, vault_key_wrapped: string) => {
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
    .query(
      "INSERT INTO dbo.vaults (id,owner_user_id,team_id,kind,version,vault_key_wrapped,created_at,updated_at) VALUES (@id,@owner_user_id,@team_id,@kind,@version,@vault_key_wrapped,SYSUTCDATETIME(),SYSUTCDATETIME())"
    );
  return id;
};

export const listVaultsForUser = async (userId: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("user_id", userId)
    .query(
      "SELECT v.*, COALESCE(CASE WHEN v.owner_user_id=@user_id THEN v.vault_key_wrapped END, s.wrapped_key, tm.team_key_wrapped) as vault_key_wrapped_for_user, COALESCE(s.permissions, CASE WHEN tm.role IN ('owner','admin','editor') THEN 'write' ELSE 'read' END) as permissions FROM dbo.vaults v LEFT JOIN dbo.shares s ON s.source_vault_id=v.id AND s.target_user_id=@user_id LEFT JOIN dbo.team_members tm ON tm.team_id=v.team_id AND tm.user_id=@user_id AND tm.revoked_at IS NULL WHERE (v.owner_user_id=@user_id) OR (v.team_id IS NOT NULL AND tm.id IS NOT NULL AND tm.joined_at IS NOT NULL) OR (s.id IS NOT NULL)"
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
