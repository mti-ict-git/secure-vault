-- Distinguish a user's primary personal vault from "transfer" vaults created by
-- Copy to User. Only transfer vaults may be shared; the primary personal vault never.
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'vaults')
BEGIN
  IF COL_LENGTH('dbo.vaults', 'purpose') IS NULL
  BEGIN
    ALTER TABLE dbo.vaults ADD purpose NVARCHAR(16) NOT NULL CONSTRAINT DF_vaults_purpose DEFAULT 'primary';
    -- Backfill: the oldest personal vault per owner stays 'primary'; later personal
    -- vaults were created by Copy to User and become 'transfer'.
    EXEC('
      ;WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_user_id ORDER BY created_at) rn
        FROM dbo.vaults WHERE kind = ''personal'' AND owner_user_id IS NOT NULL
      )
      UPDATE v SET purpose = ''transfer''
      FROM dbo.vaults v JOIN ranked r ON r.id = v.id
      WHERE r.rn > 1;
    ');
  END;
END;
