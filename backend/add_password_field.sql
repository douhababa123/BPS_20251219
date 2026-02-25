-- 添加密码字段到users表
-- 用于邮箱+密码登录功能

USE DCCT_BPS_Debug;
GO

-- 添加password_hash字段（如果不存在）
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.users') 
    AND name = 'password_hash'
)
BEGIN
    ALTER TABLE dbo.users
    ADD password_hash NVARCHAR(255) NULL;
    
    PRINT '✅ password_hash字段已添加';
END
ELSE
BEGIN
    PRINT '⚠️ password_hash字段已存在';
END
GO

-- 添加最后登录时间字段
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.users') 
    AND name = 'last_login_at'
)
BEGIN
    ALTER TABLE dbo.users
    ADD last_login_at DATETIME NULL;
    
    PRINT '✅ last_login_at字段已添加';
END
ELSE
BEGIN
    PRINT '⚠️ last_login_at字段已存在';
END
GO

-- 验证
SELECT TOP 5 
    id, email, name, password_hash, last_login_at, created_at
FROM dbo.users;
GO
