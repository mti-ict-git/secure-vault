-- Persistent per-user notifications (security receipts and alerts), so they reach
-- the user even if they were offline when it happened.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notifications')
BEGIN
CREATE TABLE dbo.notifications (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  user_id UNIQUEIDENTIFIER NOT NULL,
  type NVARCHAR(64) NOT NULL,
  severity NVARCHAR(16) NOT NULL DEFAULT 'info',
  message NVARCHAR(500) NOT NULL,
  actor_user_id UNIQUEIDENTIFIER NULL,
  vault_id UNIQUEIDENTIFIER NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  read_at DATETIME2 NULL,
  dismissed_at DATETIME2 NULL
);
CREATE INDEX IX_notifications_user ON dbo.notifications (user_id, created_at DESC);
END;
