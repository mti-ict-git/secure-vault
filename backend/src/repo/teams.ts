import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export const createTeam = async (name: string, created_by: string, team_key_wrapped_for_creator?: string) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("name", name)
    .input("created_by", created_by)
    .input("key", team_key_wrapped_for_creator || null)
    .query(
      "INSERT INTO dbo.teams (id,name,created_by,team_key_wrapped_for_creator,created_at) VALUES (@id,@name,@created_by,@key,SYSUTCDATETIME())"
    );
  return id;
};

export const inviteMember = async (
  team_id: string,
  user_id: string,
  role: string,
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

export const updateMemberRole = async (member_id: string, role: string) => {
  const pool = await getPool();
  await pool.request().input("id", member_id).input("role", role).query("UPDATE dbo.team_members SET role=@role WHERE id=@id");
};

export const removeMember = async (member_id: string) => {
  const pool = await getPool();
  await pool.request().input("id", member_id).query("DELETE FROM dbo.team_members WHERE id=@id");
};
