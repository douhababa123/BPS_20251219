/*
 * 审计日志表创建脚本
 * Phase 2: 审计日志系统
 * 
 * 功能：记录所有数据变更操作，包括：
 * - 哪个表被修改
 * - 哪条记录被修改 (record_id)
 * - 什么操作类型 (INSERT/UPDATE/DELETE)
 * - 哪个字段被修改
 * - 修改前后的值
 * - 谁操作的 (operator_id)
 * - 什么时候操作的 (operated_at)
 */

-- ============================================================================
-- Step 1: 创建审计日志表
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'data_audit_logs')
BEGIN
    CREATE TABLE dbo.data_audit_logs (
        -- 主键
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        
        -- 目标表信息
        table_name NVARCHAR(100) NOT NULL,          -- 被操作的表名
        record_id NVARCHAR(100) NOT NULL,           -- 被操作记录的ID（支持UUID和其他格式）
        
        -- 操作信息
        operation_type NVARCHAR(20) NOT NULL,       -- INSERT/UPDATE/DELETE
        field_name NVARCHAR(100) NULL,              -- 被修改的字段名（DELETE时为NULL）
        old_value NVARCHAR(MAX) NULL,               -- 修改前的值
        new_value NVARCHAR(MAX) NULL,               -- 修改后的值
        
        -- 操作人信息
        operator_id UNIQUEIDENTIFIER NOT NULL,      -- 操作人用户ID
        operator_name NVARCHAR(100) NOT NULL,       -- 操作人姓名（冗余，便于查询）
        operator_email NVARCHAR(255) NOT NULL,      -- 操作人邮箱（冗余）
        
        -- 时间戳
        operated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- 外键约束
        CONSTRAINT FK_audit_logs_operator FOREIGN KEY (operator_id) 
            REFERENCES dbo.users(id) ON DELETE NO ACTION,
        
        -- CHECK 约束
        CONSTRAINT CHK_audit_logs_operation_type 
            CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE'))
    );
    
    PRINT '✅ 表 data_audit_logs 创建成功';
END
ELSE
BEGIN
    PRINT '⚠️  表 data_audit_logs 已存在';
END;
GO

-- ============================================================================
-- Step 2: 创建索引
-- ============================================================================

-- 按表名查询的索引（最常用）
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_audit_logs_table_name')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_audit_logs_table_name 
    ON dbo.data_audit_logs(table_name, operated_at DESC);
    PRINT '✅ 索引 IDX_audit_logs_table_name 创建成功';
END;
GO

-- 按操作人查询的索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_audit_logs_operator')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_audit_logs_operator 
    ON dbo.data_audit_logs(operator_id, operated_at DESC);
    PRINT '✅ 索引 IDX_audit_logs_operator 创建成功';
END;
GO

-- 按时间查询的索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_audit_logs_operated_at')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_audit_logs_operated_at 
    ON dbo.data_audit_logs(operated_at DESC);
    PRINT '✅ 索引 IDX_audit_logs_operated_at 创建成功';
END;
GO

-- 按记录ID查询的索引（查看特定记录的历史）
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_audit_logs_record')
BEGIN
    CREATE NONCLUSTERED INDEX IDX_audit_logs_record 
    ON dbo.data_audit_logs(table_name, record_id, operated_at DESC);
    PRINT '✅ 索引 IDX_audit_logs_record 创建成功';
END;
GO

-- ============================================================================
-- Step 3: 验证表结构
-- ============================================================================

PRINT '';
PRINT '========================================';
PRINT '📋 验证审计日志表结构';
PRINT '========================================';

-- 检查表是否存在
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'data_audit_logs')
BEGIN
    PRINT '✅ data_audit_logs 表存在';
    
    -- 列出所有字段
    PRINT '';
    PRINT '📊 字段列表:';
    SELECT 
        COLUMN_NAME as '字段名',
        DATA_TYPE as '数据类型',
        CHARACTER_MAXIMUM_LENGTH as '最大长度',
        IS_NULLABLE as '允许NULL',
        COLUMN_DEFAULT as '默认值'
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'data_audit_logs'
    ORDER BY ORDINAL_POSITION;
    
    -- 列出所有索引
    PRINT '';
    PRINT '🔍 索引列表:';
    SELECT 
        i.name as '索引名',
        STRING_AGG(c.name, ', ') as '列名'
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.data_audit_logs')
    GROUP BY i.name, i.index_id
    ORDER BY i.index_id;
    
    -- 统计当前记录数
    DECLARE @count INT;
    SELECT @count = COUNT(*) FROM dbo.data_audit_logs;
    PRINT '';
    PRINT CONCAT('📊 当前审计日志记录数: ', @count);
END
ELSE
BEGIN
    PRINT '❌ data_audit_logs 表不存在';
END;

PRINT '';
PRINT '========================================';
PRINT '✅ 审计日志表迁移完成';
PRINT '========================================';
GO

-- ============================================================================
-- Step 4: 插入示例数据（可选，用于测试）
-- ============================================================================

/*
-- 示例：记录一次 UPDATE 操作
DECLARE @admin_id UNIQUEIDENTIFIER;
SELECT @admin_id = id FROM dbo.users WHERE email = 'admin@bosch.com';

INSERT INTO dbo.data_audit_logs (
    table_name, record_id, operation_type,
    field_name, old_value, new_value,
    operator_id, operator_name, operator_email
)
VALUES (
    'employees',                    -- 表名
    '12345678-1234-1234-1234-123456789012',  -- 记录ID
    'UPDATE',                       -- 操作类型
    'department_id',                -- 字段名
    'dept-001',                     -- 旧值
    'dept-002',                     -- 新值
    @admin_id,                      -- 操作人ID
    '测试管理员',                    -- 操作人姓名
    'admin@bosch.com'               -- 操作人邮箱
);

PRINT '✅ 示例审计日志已插入';
*/
