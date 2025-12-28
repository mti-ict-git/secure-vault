import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

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
      "SELECT * FROM dbo.vaults WHERE owner_user_id=@user_id OR team_id IN (SELECT team_id FROM dbo.team_members WHERE user_id=@user_id)"
    );
  return r.recordset;
};

export const getVault = async (id: string) => {
  const pool = await getPool();
  const r = await pool.request().input("id", id).query("SELECT * FROM dbo.vaults WHERE id=@id");
  return r.recordset[0] || null;
};
