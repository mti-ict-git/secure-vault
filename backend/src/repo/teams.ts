import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export type TeamRole = "owner" | "admin" | "editor" | "viewer";

export const createTeam = async (
  name: string,
  description: string | undefined,
  created_by: string,
  team_key_wrapped_for_creator: string
) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("name", name)
    .input("description", description || null)
    .input("created_by", created_by)
    .input("key", team_key_wrapped_for_creator)
    .query(
      "INSERT INTO dbo.teams (id,name,description,created_by,team_key_wrapped_for_creator,created_at) VALUES (@id,@name,@description,@created_by,@key,SYSUTCDATETIME())"
    );
  await pool
    .request()
    .input("id", uid())
    .input("team_id", id)
    .input("user_id", created_by)
    .input("role", "owner")
    .input("invited_by", created_by)
    .input("team_key_wrapped", team_key_wrapped_for_creator)
    .query(
      "INSERT INTO dbo.team_members (id,team_id,user_id,role,invited_by,invited_at,joined_at,team_key_wrapped) VALUES (@id,@team_id,@user_id,@role,@invited_by,SYSUTCDATETIME(),SYSUTCDATETIME(),@team_key_wrapped)"
    );
  return id;
};

export const inviteMember = async (
  team_id: string,
  user_id: string,
  role: TeamRole,
  invited_by: string,
  team_key_wrapped: string
) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("team_id", team_id)
    .input("user_id", user_id)
    .input("role", role)
    .input("invited_by", invited_by)
    .input("team_key_wrapped", team_key_wrapped)
    .query(
      "INSERT INTO dbo.team_members (id,team_id,user_id,role,invited_by,invited_at,team_key_wrapped) VALUES (@id,@team_id,@user_id,@role,@invited_by,SYSUTCDATETIME(),@team_key_wrapped)"
    );
  return id;
};

export const updateMemberRole = async (member_id: string, role: TeamRole) => {
  const pool = await getPool();
  await pool.request().input("id", member_id).input("role", role).query("UPDATE dbo.team_members SET role=@role WHERE id=@id");
};

export const removeMember = async (member_id: string) => {
  const pool = await getPool();
  await pool
    .request()
    .input("id", member_id)
    .query(
      "UPDATE dbo.team_members SET revoked_at=SYSUTCDATETIME() WHERE id=@id AND revoked_at IS NULL"
    );
};

export const updateTeam = async (team_id: string, name?: string, description?: string) => {
  const pool = await getPool();
  await pool
    .request()
    .input("id", team_id)
    .input("name", name || null)
    .input("description", description || null)
    .query(
      "UPDATE dbo.teams SET name=COALESCE(@name,name), description=COALESCE(@description,description) WHERE id=@id"
    );
};

export const deleteTeam = async (team_id: string) => {
  const pool = await getPool();
  await pool
    .request()
    .input("team_id", team_id)
    .query(
      "DELETE vb FROM dbo.vault_blobs vb JOIN dbo.vaults v ON v.id=vb.vault_id WHERE v.team_id=@team_id"
    );
  await pool
    .request()
    .input("team_id", team_id)
    .query(
      "DELETE s FROM dbo.shares s JOIN dbo.vaults v ON v.id=s.source_vault_id WHERE v.team_id=@team_id"
    );
  await pool
    .request()
    .input("team_id", team_id)
    .query("DELETE FROM dbo.shares WHERE target_team_id=@team_id");
  await pool
    .request()
    .input("team_id", team_id)
    .query("DELETE FROM dbo.vaults WHERE team_id=@team_id");
  await pool
    .request()
    .input("team_id", team_id)
    .query("DELETE FROM dbo.team_members WHERE team_id=@team_id");
  await pool.request().input("id", team_id).query("DELETE FROM dbo.teams WHERE id=@id");
};

export const getUserRoleInTeam = async (
  team_id: string,
  user_id: string
): Promise<TeamRole | null> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("team_id", team_id)
    .input("user_id", user_id)
    .query(
      "SELECT TOP 1 role FROM dbo.team_members WHERE team_id=@team_id AND user_id=@user_id AND joined_at IS NOT NULL AND revoked_at IS NULL"
    );
  const row = r.recordset[0] as { role?: string } | undefined;
  const role = row?.role;
  if (role === "owner" || role === "admin" || role === "editor" || role === "viewer") return role;
  return null;
};

export const getTeamMemberById = async (member_id: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", member_id)
    .query(
      "SELECT TOP 1 id,team_id,user_id,role FROM dbo.team_members WHERE id=@id AND revoked_at IS NULL"
    );
  const row = r.recordset[0] as
    | { id: string; team_id: string; user_id: string; role: string }
    | undefined;
  if (!row) return null;
  if (
    row.role !== "owner" &&
    row.role !== "admin" &&
    row.role !== "editor" &&
    row.role !== "viewer"
  ) {
    return null;
  }
  return { id: row.id, team_id: row.team_id, user_id: row.user_id, role: row.role };
};

export type TeamListItem = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  vault_id: string | null;
  role: "owner" | "admin" | "editor" | "viewer";
  invited_at: string;
  joined_at: string | null;
  team_key_wrapped: string;
};

export const listTeamsForUser = async (user_id: string): Promise<TeamListItem[]> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("user_id", user_id)
    .query(
      "SELECT t.id,t.name,t.description,t.created_by,t.created_at,v.id as vault_id,tm.role,tm.invited_at,tm.joined_at,tm.team_key_wrapped FROM dbo.teams t JOIN dbo.team_members tm ON tm.team_id=t.id AND tm.user_id=@user_id AND tm.revoked_at IS NULL LEFT JOIN dbo.vaults v ON v.team_id=t.id AND v.kind='team' ORDER BY t.created_at DESC"
    );
  return r.recordset as TeamListItem[];
};

export type TeamMemberRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  invited_by: string | null;
  invited_at: string;
  joined_at: string | null;
  revoked_at: string | null;
  team_key_wrapped: string;
  display_name: string | null;
  email: string | null;
};

export const listTeamMembers = async (team_id: string): Promise<TeamMemberRow[]> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("team_id", team_id)
    .query(
      "SELECT tm.*, u.display_name, u.email FROM dbo.team_members tm LEFT JOIN dbo.users u ON u.id=tm.user_id WHERE tm.team_id=@team_id AND tm.revoked_at IS NULL ORDER BY tm.invited_at DESC"
    );
  return r.recordset as TeamMemberRow[];
};

export const acceptInvite = async (team_id: string, user_id: string) => {
  const pool = await getPool();
  await pool
    .request()
    .input("team_id", team_id)
    .input("user_id", user_id)
    .query(
      "UPDATE dbo.team_members SET joined_at=SYSUTCDATETIME() WHERE team_id=@team_id AND user_id=@user_id AND joined_at IS NULL AND revoked_at IS NULL"
    );
};

export const isTeamMember = async (team_id: string, user_id: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("team_id", team_id)
    .input("user_id", user_id)
    .query(
      "SELECT TOP 1 id FROM dbo.team_members WHERE team_id=@team_id AND user_id=@user_id AND joined_at IS NOT NULL AND revoked_at IS NULL"
    );
  return r.recordset.length > 0;
};
