-- Incremented on every vault key rotation. Uploads must name the key version they
-- were encrypted with, so a client still holding a rotated-out key cannot write.
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'vaults')
BEGIN
  IF COL_LENGTH('dbo.vaults', 'key_version') IS NULL
  BEGIN
    ALTER TABLE dbo.vaults ADD key_version INT NOT NULL CONSTRAINT DF_vaults_key_version DEFAULT 1;
  END;
END;
