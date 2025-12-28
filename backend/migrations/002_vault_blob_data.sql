IF EXISTS (SELECT * FROM sys.tables WHERE name = 'vault_blobs')
BEGIN
  IF COL_LENGTH('dbo.vault_blobs', 'storage_kind') IS NULL
  BEGIN
    EXEC('ALTER TABLE dbo.vault_blobs ADD storage_kind NVARCHAR(16) NOT NULL CONSTRAINT DF_vault_blobs_storage_kind DEFAULT ''fs'';');
  END;
END;

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'vault_blobs')
BEGIN
  IF COL_LENGTH('dbo.vault_blobs', 'storage_kind') IS NOT NULL
  BEGIN
    EXEC('UPDATE dbo.vault_blobs SET storage_kind=''fs'' WHERE storage_kind IS NULL;');
  END;
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'vault_blob_data')
BEGIN
CREATE TABLE dbo.vault_blob_data (
  blob_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  data VARBINARY(MAX) NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
END;
