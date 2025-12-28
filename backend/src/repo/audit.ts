import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export const writeAudit = async (
  actor_user_id: string | null,
  action: string,
  resource_type: string | null,
  resource_id: string | null,
  details_json: unknown
) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("actor_user_id", actor_user_id)
    .input("action", action)
    .input("resource_type", resource_type)
    .input("resource_id", resource_id)
    .input("details_json", JSON.stringify(details_json ?? {}))
    .query(
      "INSERT INTO dbo.audit_logs (id,actor_user_id,action,resource_type,resource_id,details_json,created_at) VALUES (@id,@actor_user_id,@action,@resource_type,@resource_id,@details_json,SYSUTCDATETIME())"
    );
  return id;
};

export const listAudits = async (actor_user_id?: string) => {
  const pool = await getPool();
  const r = actor_user_id
    ? await pool.request().input("actor_user_id", actor_user_id).query("SELECT * FROM dbo.audit_logs WHERE actor_user_id=@actor_user_id ORDER BY created_at DESC")
    : await pool.request().query("SELECT * FROM dbo.audit_logs ORDER BY created_at DESC");
  return r.recordset;
};
