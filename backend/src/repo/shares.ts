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
