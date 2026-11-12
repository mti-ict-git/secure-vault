import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export const createShare = async (
  source_vault_id: string,
  target_user_id: string | null,
  target_team_id: string | null,
  wrapped_key: string,
  permissions: "read" | "write"
) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("source_vault_id", source_vault_id)
    .input("target_user_id", target_user_id)
    .input("target_team_id", target_team_id)
    .input("wrapped_key", wrapped_key)
    .input("permissions", permissions)
    .query(
      "INSERT INTO dbo.shares (id,source_vault_id,target_user_id,target_team_id,wrapped_key,permissions,created_at) VALUES (@id,@source_vault_id,@target_user_id,@target_team_id,@wrapped_key,@permissions,SYSUTCDATETIME())"
    );
  return id;
};

export type ShareRow = {
  id: string;
  source_vault_id: string;
  target_user_id: string | null;
  target_team_id: string | null;
  permissions: "read" | "write";
  created_at: Date;
  display_name?: string | null;
  email?: string | null;
};

export const listSharesForVault = async (vault_id: string): Promise<ShareRow[]> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("vault_id", vault_id)
    .query(
      "SELECT s.id, s.source_vault_id, s.target_user_id, s.target_team_id, s.permissions, s.created_at, u.display_name, u.email FROM dbo.shares s LEFT JOIN dbo.users u ON u.id = s.target_user_id WHERE s.source_vault_id=@vault_id ORDER BY s.created_at"
    );
  return r.recordset as ShareRow[];
};

export const getShare = async (id: string): Promise<ShareRow | null> => {
  const pool = await getPool();
  const r = await pool.request().input("id", id).query("SELECT * FROM dbo.shares WHERE id=@id");
  return (r.recordset[0] as ShareRow | undefined) ?? null;
};

export const deleteShare = async (id: string) => {
  const pool = await getPool();
  await pool.request().input("id", id).query("DELETE FROM dbo.shares WHERE id=@id");
};
