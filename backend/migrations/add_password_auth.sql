-- 添加密码认证支持到users表
-- 执行日期: 2026-02-09
-- 用途: 支持邮箱+密码注册和登录

USE DCCT_BPS_Debug;
GO

-- 检查password_hash列是否存在，不存在则添加
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.users') 
    AND name = 'password_hash'
)
BEGIN
    ALTER TABLE dbo.users
    ADD password_hash NVARCHAR(255) NULL;
    
    PRINT '✅ 已添加 password_hash 列到 users 表';
END
ELSE
BEGIN
    PRINT '⚠️ password_hash 列已存在，跳过添加';
END
GO

-- 验证结果
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'users'
AND COLUMN_NAME = 'password_hash';
GO

PRINT '✅ 密码认证迁移完成';
GO
