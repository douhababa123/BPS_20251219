-- ============================================================================
-- SQL Server 补充认证表脚本
-- 创建 users 和 otp_tokens 表（如果缺失）
-- ============================================================================

USE DCCT_BPS_Debug;
GO

PRINT '============================================================';
PRINT '检查并创建认证相关表（users, otp_tokens）';
PRINT '============================================================';
PRINT '';

-- ============================================================================
-- 1. 创建 users 表（替代 Supabase Auth）
-- ============================================================================

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      email NVARCHAR(255) NOT NULL UNIQUE,
      name NVARCHAR(255) NOT NULL,
      email_confirmed BIT DEFAULT 0,
      email_confirmed_at DATETIME2,
      is_active BIT DEFAULT 1,
      created_at DATETIME2 DEFAULT GETDATE(),
      updated_at DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX idx_users_email ON dbo.users(email);
    CREATE INDEX idx_users_active ON dbo.users(is_active);

    PRINT '  ✅ 已创建 users 表';
END
ELSE
    PRINT '  ⚠️  users 表已存在，跳过';

PRINT '';

-- ============================================================================
-- 2. 创建 otp_tokens 表（OTP 验证码临时表）
-- ============================================================================

IF OBJECT_ID('dbo.otp_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.otp_tokens (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      email NVARCHAR(255) NOT NULL,
      otp_code NVARCHAR(10) NOT NULL,
      created_at DATETIME2 DEFAULT GETDATE(),
      expires_at DATETIME2 NOT NULL,
      is_used BIT DEFAULT 0,
      used_at DATETIME2,
      action_type NVARCHAR(50) NOT NULL  -- 'SIGNUP', 'LOGIN', 'RESET_PASSWORD'
    );

    CREATE INDEX idx_otp_tokens_email ON dbo.otp_tokens(email);
    CREATE INDEX idx_otp_tokens_expires ON dbo.otp_tokens(expires_at);
    CREATE INDEX idx_otp_tokens_action ON dbo.otp_tokens(action_type);

    PRINT '  ✅ 已创建 otp_tokens 表';
END
ELSE
    PRINT '  ⚠️  otp_tokens 表已存在，跳过';

PRINT '';
PRINT '============================================================';
PRINT '✅ 认证表检查完成！';
PRINT '============================================================';
PRINT '';

-- ============================================================================
-- 验证所有表
-- ============================================================================

PRINT '当前数据库中的所有表:';
PRINT '';

SELECT 
    TABLE_NAME AS [表名],
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = t.TABLE_NAME) AS [字段数]
FROM INFORMATION_SCHEMA.TABLES t
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

PRINT '';
PRINT '应该看到以下 13 个表:';
PRINT '  1. competency_assessments';
PRINT '  2. competency_definitions';
PRINT '  3. departments';
PRINT '  4. employees';
PRINT '  5. factories';
PRINT '  6. otp_tokens';
PRINT '  7. resource_planning_tasks';
PRINT '  8. resource_task_types';
PRINT '  9. schedule_change_notifications';
PRINT ' 10. skills';
PRINT ' 11. task_types';
PRINT ' 12. tasks';
PRINT ' 13. users';
PRINT '';
GO
