IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
CREATE TABLE dbo.users (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  email NVARCHAR(255) NULL,
  display_name NVARCHAR(255) NULL,
  ldap_dn NVARCHAR(512) NULL,
  public_sign_key NVARCHAR(MAX) NULL,
  public_enc_key NVARCHAR(MAX) NULL,
  encrypted_private_key NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  last_login_at DATETIME2 NULL
);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions')
BEGIN
CREATE TABLE dbo.sessions (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  user_id UNIQUEIDENTIFIER NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  revoked_at DATETIME2 NULL
);
CREATE INDEX IX_sessions_user_id ON dbo.sessions (user_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'teams')
BEGIN
CREATE TABLE dbo.teams (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  created_by UNIQUEIDENTIFIER NOT NULL,
  team_key_wrapped_for_creator NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vaults')
BEGIN
CREATE TABLE dbo.vaults (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  owner_user_id UNIQUEIDENTIFIER NULL,
  team_id UNIQUEIDENTIFIER NULL,
  kind NVARCHAR(16) NOT NULL,
  version INT NOT NULL,
  vault_key_wrapped NVARCHAR(MAX) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_vaults_owner ON dbo.vaults (owner_user_id);
CREATE INDEX IX_vaults_team ON dbo.vaults (team_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vault_blobs')
BEGIN
CREATE TABLE dbo.vault_blobs (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  vault_id UNIQUEIDENTIFIER NOT NULL,
  blob_type NVARCHAR(32) NOT NULL,
  content_sha256 NVARCHAR(128) NULL,
  storage_ref NVARCHAR(1024) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_by UNIQUEIDENTIFIER NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_vault_blobs_vault ON dbo.vault_blobs (vault_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'team_members')
BEGIN
CREATE TABLE dbo.team_members (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  team_id UNIQUEIDENTIFIER NOT NULL,
  user_id UNIQUEIDENTIFIER NOT NULL,
  role NVARCHAR(16) NOT NULL,
  invited_by UNIQUEIDENTIFIER NULL,
  invited_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  joined_at DATETIME2 NULL,
  revoked_at DATETIME2 NULL,
  team_key_wrapped NVARCHAR(MAX) NOT NULL
);
CREATE INDEX IX_team_members_team ON dbo.team_members (team_id);
CREATE INDEX IX_team_members_user ON dbo.team_members (user_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'shares')
BEGIN
CREATE TABLE dbo.shares (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  source_vault_id UNIQUEIDENTIFIER NOT NULL,
  target_user_id UNIQUEIDENTIFIER NULL,
  target_team_id UNIQUEIDENTIFIER NULL,
  wrapped_key NVARCHAR(MAX) NOT NULL,
  permissions NVARCHAR(16) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_shares_source ON dbo.shares (source_vault_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'audit_logs')
BEGIN
CREATE TABLE dbo.audit_logs (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  actor_user_id UNIQUEIDENTIFIER NULL,
  action NVARCHAR(64) NOT NULL,
  resource_type NVARCHAR(64) NULL,
  resource_id UNIQUEIDENTIFIER NULL,
  details_json NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_audit_actor ON dbo.audit_logs (actor_user_id);
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'uploads')
BEGIN
CREATE TABLE dbo.uploads (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  user_id UNIQUEIDENTIFIER NOT NULL,
  original_filename NVARCHAR(255) NOT NULL,
  mime_type NVARCHAR(128) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_ref NVARCHAR(1024) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_uploads_user ON dbo.uploads (user_id);
END;

