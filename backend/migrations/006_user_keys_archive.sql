-- Keep old key material when a user resets their keys, so a mistaken or malicious
-- reset can be undone instead of making every vault permanently unreadable.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_keys_archive')
BEGIN
CREATE TABLE dbo.user_keys_archive (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  user_id UNIQUEIDENTIFIER NOT NULL,
  public_sign_key NVARCHAR(MAX) NULL,
  public_enc_key NVARCHAR(MAX) NULL,
  encrypted_private_key NVARCHAR(MAX) NULL,
  reason NVARCHAR(64) NOT NULL,
  archived_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_user_keys_archive_user ON dbo.user_keys_archive (user_id);
END;
