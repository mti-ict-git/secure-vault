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
  const base =
    "SELECT a.id,a.actor_user_id,a.action,a.resource_type,a.resource_id,a.details_json,a.created_at,u.display_name AS actor_username FROM dbo.audit_logs a LEFT JOIN dbo.users u ON a.actor_user_id=u.id";
  const r = actor_user_id
    ? await pool
        .request()
        .input("actor_user_id", actor_user_id)
        .query(`${base} WHERE a.actor_user_id=@actor_user_id ORDER BY a.created_at DESC`)
    : await pool.request().query(`${base} ORDER BY a.created_at DESC`);
  return r.recordset;
};

export type AuditFilter = {
  actor_user_id?: string;
  since?: string;
  until?: string;
  action?: string;
};

export const listAuditsFiltered = async (filter: AuditFilter) => {
  const pool = await getPool();
  const base =
    "SELECT a.id,a.actor_user_id,a.action,a.resource_type,a.resource_id,a.details_json,a.created_at,u.display_name AS actor_username FROM dbo.audit_logs a LEFT JOIN dbo.users u ON a.actor_user_id=u.id";
  const where: string[] = [];
  const req = pool.request();
  if (filter.actor_user_id) {
    where.push("a.actor_user_id=@actor_user_id");
    req.input("actor_user_id", filter.actor_user_id);
  }
  if (filter.since) {
    where.push("a.created_at>=@since");
    req.input("since", filter.since);
  }
  if (filter.until) {
    where.push("a.created_at<=@until");
    req.input("until", filter.until);
  }
  if (filter.action) {
    const act = filter.action.includes(".") ? filter.action.split(".").join("_") : filter.action;
    where.push("a.action=@action");
    req.input("action", act);
  }
  const sql = `${base}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY a.created_at DESC`;
  const r = await req.query(sql);
  return r.recordset;
};
