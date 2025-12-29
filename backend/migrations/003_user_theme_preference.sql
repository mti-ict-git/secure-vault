IF EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
  IF COL_LENGTH('dbo.users', 'theme_preference') IS NULL
  BEGIN
    ALTER TABLE dbo.users ADD theme_preference NVARCHAR(16) NULL;
  END;
END;

