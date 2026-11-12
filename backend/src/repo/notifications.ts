import { getPool } from "../db/mssql.js";
import { publishSyncEvent, uid } from "../state/store.js";

export type Severity = "info" | "warning" | "critical";

export type NotificationRow = {
  id: string;
  type: string;
  severity: Severity;
  message: string;
  actor_user_id: string | null;
  vault_id: string | null;
  created_at: Date;
  read_at: Date | null;
};

export const createNotification = async (n: {
  user_id: string;
  type: string;
  severity?: Severity;
  message: string;
  actor_user_id?: string | null;
  vault_id?: string | null;
  /** Skip if an unread notification with the same type, vault and actor exists within this window. */
  coalesceMinutes?: number;
}) => {
  const pool = await getPool();
  if (n.coalesceMinutes) {
    const dup = await pool
      .request()
      .input("user_id", n.user_id)
      .input("type", n.type)
      .input("vault_id", n.vault_id ?? null)
      .input("actor", n.actor_user_id ?? null)
      .input("mins", n.coalesceMinutes)
      .query(
        "SELECT TOP 1 id FROM dbo.notifications WHERE user_id=@user_id AND type=@type AND read_at IS NULL AND ((vault_id IS NULL AND @vault_id IS NULL) OR vault_id=@vault_id) AND ((actor_user_id IS NULL AND @actor IS NULL) OR actor_user_id=@actor) AND created_at > DATEADD(minute, -@mins, SYSUTCDATETIME())"
      );
    if (dup.recordset.length) return null;
  }
  const id = uid();
  await pool
    .request()
    .input("id", id)
    .input("user_id", n.user_id)
    .input("type", n.type)
    .input("severity", n.severity ?? "info")
    .input("message", n.message.slice(0, 500))
    .input("actor", n.actor_user_id ?? null)
    .input("vault_id", n.vault_id ?? null)
    .query(
      "INSERT INTO dbo.notifications (id,user_id,type,severity,message,actor_user_id,vault_id,created_at) VALUES (@id,@user_id,@type,@severity,@message,@actor,@vault_id,SYSUTCDATETIME())"
    );
  publishSyncEvent({ t: Date.now(), type: "notification", target_user_id: n.user_id });
  return id;
};

export const listNotifications = async (user_id: string, limit = 50): Promise<NotificationRow[]> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("user_id", user_id)
    .input("limit", limit)
    .query(
      "SELECT TOP (@limit) id,type,severity,message,actor_user_id,vault_id,created_at,read_at FROM dbo.notifications WHERE user_id=@user_id AND dismissed_at IS NULL ORDER BY created_at DESC"
    );
  return r.recordset as NotificationRow[];
};

export const markNotificationsRead = async (user_id: string) => {
  const pool = await getPool();
  await pool
    .request()
    .input("user_id", user_id)
    .query("UPDATE dbo.notifications SET read_at=SYSUTCDATETIME() WHERE user_id=@user_id AND read_at IS NULL");
};

export const dismissNotifications = async (user_id: string) => {
  const pool = await getPool();
  await pool
    .request()
    .input("user_id", user_id)
    .query(
      "UPDATE dbo.notifications SET dismissed_at=SYSUTCDATETIME(), read_at=COALESCE(read_at, SYSUTCDATETIME()) WHERE user_id=@user_id AND dismissed_at IS NULL"
    );
};

export const listAdminIds = async (): Promise<string[]> => {
  const pool = await getPool();
  const r = await pool.request().query("SELECT id FROM dbo.users WHERE role='admin'");
  return r.recordset.map((x: { id: string }) => String(x.id));
};

export const listJoinedTeamMemberIds = async (team_id: string): Promise<string[]> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("team_id", team_id)
    .query("SELECT user_id FROM dbo.team_members WHERE team_id=@team_id AND joined_at IS NOT NULL AND revoked_at IS NULL");
  return r.recordset.map((x: { user_id: string }) => String(x.user_id));
};

/** Distinct users a vault was shared with in the last few minutes (from the audit trail). */
export const recentShareTargets = async (vault_id: string, minutes: number): Promise<number> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("vault_id", vault_id)
    .input("mins", minutes)
    .query(
      "SELECT COUNT(DISTINCT JSON_VALUE(details_json,'$.target_user_id')) n FROM dbo.audit_logs WHERE action='vault_share' AND resource_id=@vault_id AND created_at > DATEADD(minute, -@mins, SYSUTCDATETIME())"
    );
  return Number(r.recordset[0]?.n ?? 0);
};

export const displayNameOf = async (user_id: string | null | undefined): Promise<string> => {
  if (!user_id) return "Someone";
  const pool = await getPool();
  const r = await pool.request().input("id", user_id).query("SELECT TOP 1 display_name, email FROM dbo.users WHERE id=@id");
  const u = r.recordset[0] as { display_name?: string | null; email?: string | null } | undefined;
  return u?.display_name || u?.email || "Someone";
};
