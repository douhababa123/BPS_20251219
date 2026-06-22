IF COL_LENGTH('dbo.users', 'must_change_password') IS NULL
BEGIN
    ALTER TABLE dbo.users
    ADD must_change_password BIT NOT NULL
        CONSTRAINT DF_users_must_change_password DEFAULT (0);
END;

IF COL_LENGTH('dbo.users', 'password_updated_at') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD password_updated_at DATETIME2 NULL;
END;
