import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export const ensureUser = async (displayName: string, email?: string, ldap_dn?: string) => {
  const pool = await getPool();
  const existing = await pool
    .request()
    .input("email", email || null)
    .query("SELECT TOP 1 * FROM dbo.users WHERE email = @email");
  if (existing.recordset.length) {
    const u = existing.recordset[0];
    await pool
      .request()
      .input("id", u.id)
      .query("UPDATE dbo.users SET last_login_at = SYSUTCDATETIME() WHERE id = @id");
    return u.id as string;
  }
  const id = uid();
  await pool
    .request()
    .input("id", id)
    .input("email", email || null)
    .input("display_name", displayName)
    .input("ldap_dn", ldap_dn || null)
    .query(
      "INSERT INTO dbo.users (id,email,display_name,ldap_dn,created_at,last_login_at) VALUES (@id,@email,@display_name,@ldap_dn,SYSUTCDATETIME(),SYSUTCDATETIME())"
    );
  return id;
};

export const upsertKeys = async (
  userId: string,
  public_sign_key: string,
  public_enc_key: string,
  encrypted_private_key: string
) => {
  const pool = await getPool();
  await pool
    .request()
    .input("id", userId)
    .input("psk", public_sign_key)
    .input("pek", public_enc_key)
    .input("epk", encrypted_private_key)
    .query(
      "UPDATE dbo.users SET public_sign_key=@psk, public_enc_key=@pek, encrypted_private_key=@epk WHERE id=@id"
    );
};

export const getKeys = async (userId: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", userId)
    .query(
      "SELECT public_sign_key, public_enc_key, encrypted_private_key FROM dbo.users WHERE id=@id"
    );
  return r.recordset[0] || null;
};

export const getUserById = async (userId: string) => {
  const pool = await getPool();
  const r = await pool.request().input("id", userId).query("SELECT id, display_name, email FROM dbo.users WHERE id=@id");
  return r.recordset[0] || null;
};

export const createSession = async (userId: string) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("user_id", userId)
    .query("INSERT INTO dbo.sessions (id,user_id,created_at) VALUES (@id,@user_id,SYSUTCDATETIME())");
  return id;
};

export const isSessionValid = async (sessionId: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", sessionId)
    .query("SELECT TOP 1 * FROM dbo.sessions WHERE id=@id AND revoked_at IS NULL");
  return !!r.recordset.length;
};
