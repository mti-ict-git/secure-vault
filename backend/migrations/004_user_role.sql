IF EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
BEGIN
  IF COL_LENGTH('dbo.users', 'role') IS NULL
  BEGIN
    ALTER TABLE dbo.users ADD role NVARCHAR(16) NOT NULL CONSTRAINT DF_users_role DEFAULT 'user';
  END;
END;

