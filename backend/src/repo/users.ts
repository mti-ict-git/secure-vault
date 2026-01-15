import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export const ensureUser = async (displayName: string, email?: string, ldap_dn?: string) => {
  const pool = await getPool();
  let existingId: string | null = null;
  if (email && email.length > 0) {
    const byEmail = await pool
      .request()
      .input("email", email)
      .query("SELECT TOP 1 id, email, display_name, ldap_dn FROM dbo.users WHERE email = @email");
    if (byEmail.recordset.length) existingId = String(byEmail.recordset[0].id);
  }
  if (!existingId && ldap_dn && ldap_dn.length > 0) {
    const byDn = await pool
      .request()
      .input("ldap_dn", ldap_dn)
      .query("SELECT TOP 1 id, email, display_name, ldap_dn FROM dbo.users WHERE ldap_dn = @ldap_dn");
    if (byDn.recordset.length) existingId = String(byDn.recordset[0].id);
  }
  if (existingId) {
    await pool
      .request()
      .input("id", existingId)
      .input("email", email || null)
      .input("ldap_dn", ldap_dn || null)
      .query(
        "UPDATE dbo.users SET last_login_at = SYSUTCDATETIME(), email = COALESCE(@email, email), ldap_dn = COALESCE(@ldap_dn, ldap_dn) WHERE id = @id"
      );
    return existingId;
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

export const clearKeys = async (userId: string) => {
  const pool = await getPool();
  await pool
    .request()
    .input("id", userId)
    .query(
      "UPDATE dbo.users SET public_sign_key=NULL, public_enc_key=NULL, encrypted_private_key=NULL WHERE id=@id"
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
  const r = await pool
    .request()
    .input("id", userId)
    .query("SELECT id, display_name, email, theme_preference, role FROM dbo.users WHERE id=@id");
  return r.recordset[0] || null;
};

export const isAdminUser = async (userId: string): Promise<boolean> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", userId)
    .query("SELECT TOP 1 role FROM dbo.users WHERE id=@id");
  const row = r.recordset[0] as { role?: string } | undefined;
  return row?.role === "admin";
};

export const getUserByEmail = async (email: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("email", email)
    .query("SELECT TOP 1 id, display_name, email FROM dbo.users WHERE email=@email");
  return r.recordset[0] || null;
};

export const getPublicKeysByUserId = async (userId: string) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("id", userId)
    .query(
      "SELECT id, display_name, email, public_sign_key, public_enc_key FROM dbo.users WHERE id=@id"
    );
  return r.recordset[0] || null;
};

export const setThemePreference = async (userId: string, theme: "light" | "dark" | "system") => {
  const pool = await getPool();
  await pool
    .request()
    .input("id", userId)
    .input("theme", theme)
    .query("UPDATE dbo.users SET theme_preference=@theme WHERE id=@id");
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
