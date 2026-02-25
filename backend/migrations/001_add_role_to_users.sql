-- ============================================================================
-- 数据管理后台系统 - 数据库迁移脚本 Phase 1
-- 功能：为 users 表添加 role 字段，支持管理员权限控制
-- 创建日期：2026-02-13
-- 数据库：SQL Server 2019 (DCCT_BPS_Debug)
-- ============================================================================

USE [DCCT_BPS_Debug];
GO

PRINT N'========================================';
PRINT N'开始执行迁移: 添加 users.role 字段';
PRINT N'========================================';
PRINT N'';

-- ============================================================================
-- Step 1: 检查 role 字段是否已存在
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'role'
)
BEGIN
    PRINT N'✓ users 表尚未添加 role 字段，开始添加...';
    
    -- 添加 role 字段
    ALTER TABLE dbo.users 
    ADD role NVARCHAR(20) NOT NULL DEFAULT 'user';
    
    PRINT N'✓ 已添加 role 字段（类型: NVARCHAR(20), 默认值: ''user''）';
END
ELSE
BEGIN
    PRINT N'⚠ users 表已存在 role 字段，跳过添加步骤';
END
GO

-- ============================================================================
-- Step 2: 添加 role 字段的检查约束
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_users_role'
)
BEGIN
    PRINT N'✓ 添加 role 字段约束...';
    
    ALTER TABLE dbo.users
    ADD CONSTRAINT CHK_users_role 
    CHECK (role IN ('admin', 'user'));
    
    PRINT N'✓ 已添加约束: role 只能是 ''admin'' 或 ''user''';
END
ELSE
BEGIN
    PRINT N'⚠ role 字段约束已存在，跳过添加步骤';
END
GO

-- ============================================================================
-- Step 3: 更新现有用户的 role 字段（可选）
-- ============================================================================

PRINT N'✓ 检查现有用户的 role 字段...';

-- 统计当前用户数量
DECLARE @total_users INT;
DECLARE @admin_users INT;
DECLARE @normal_users INT;

SELECT @total_users = COUNT(*) FROM dbo.users;
SELECT @admin_users = COUNT(*) FROM dbo.users WHERE role = 'admin';
SELECT @normal_users = COUNT(*) FROM dbo.users WHERE role = 'user';

PRINT N'当前用户统计:';
PRINT N'  总用户数: ' + CAST(@total_users AS NVARCHAR(10));
PRINT N'  管理员数: ' + CAST(@admin_users AS NVARCHAR(10));
PRINT N'  普通用户: ' + CAST(@normal_users AS NVARCHAR(10));
PRINT N'';

-- 如果需要手动设置管理员，取消下面的注释并修改邮箱
/*
PRINT N'✓ 设置管理员账户...';

UPDATE dbo.users 
SET role = 'admin' 
WHERE email IN (
    'admin@bosch.com',
    'your-email@bosch.com'  -- 替换为你的邮箱
);

PRINT N'✓ 管理员账户已设置';
*/

-- ============================================================================
-- Step 4: 创建索引以优化权限查询
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IDX_users_role'
    AND object_id = OBJECT_ID('dbo.users')
)
BEGIN
    PRINT N'✓ 为 role 字段创建索引...';
    
    CREATE NONCLUSTERED INDEX IDX_users_role
    ON dbo.users(role)
    WHERE role = 'admin';  -- 过滤索引，只索引管理员
    
    PRINT N'✓ 已创建过滤索引: IDX_users_role';
END
ELSE
BEGIN
    PRINT N'⚠ role 字段索引已存在，跳过创建步骤';
END
GO

-- ============================================================================
-- Step 5: 验证迁移结果
-- ============================================================================

PRINT N'========================================';
PRINT N'迁移验证';
PRINT N'========================================';

-- 验证字段是否存在
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'role'
)
BEGIN
    PRINT N'✅ 验证通过: role 字段已存在';
    
    -- 显示字段详情
    SELECT 
        COLUMN_NAME AS '字段名',
        DATA_TYPE AS '数据类型',
        CHARACTER_MAXIMUM_LENGTH AS '最大长度',
        IS_NULLABLE AS '允许NULL',
        COLUMN_DEFAULT AS '默认值'
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users' 
    AND COLUMN_NAME = 'role';
END
ELSE
BEGIN
    PRINT N'❌ 验证失败: role 字段不存在';
END

-- 验证约束是否存在
IF EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CHK_users_role'
)
BEGIN
    PRINT N'✅ 验证通过: role 字段约束已存在';
END
ELSE
BEGIN
    PRINT N'❌ 验证失败: role 字段约束不存在';
END

-- 验证索引是否存在
IF EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IDX_users_role'
)
BEGIN
    PRINT N'✅ 验证通过: role 字段索引已存在';
END
ELSE
BEGIN
    PRINT N'❌ 验证失败: role 字段索引不存在';
END

PRINT N'';
PRINT N'========================================';
PRINT N'迁移完成！';
PRINT N'========================================';
PRINT N'';
PRINT N'后续步骤:';
PRINT N'1. 如需设置管理员，请取消 Step 3 的注释并重新运行';
PRINT N'2. 更新后端代码: backend/models.py (UserResponse 添加 role 字段)';
PRINT N'3. 实现权限验证: backend/auth.py (verify_admin 函数)';
PRINT N'4. 运行单元测试: pytest tests/test_admin_auth.py';
PRINT N'';

GO
