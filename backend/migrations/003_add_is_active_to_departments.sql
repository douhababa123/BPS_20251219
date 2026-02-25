-- ========================================
-- Phase 3: 为 departments 表添加 is_active 字段
-- 用于软删除支持
-- ========================================

-- 添加 is_active 字段
ALTER TABLE dbo.departments 
ADD is_active BIT NOT NULL DEFAULT 1;

GO

-- 为 is_active 创建索引（优化查询性能）
CREATE INDEX IDX_departments_is_active 
ON dbo.departments(is_active);

GO

-- 验证字段已添加
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'departments' AND COLUMN_NAME = 'is_active';

GO

-- 验证现有数据都是活跃的
SELECT 
    COUNT(*) as total_departments,
    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_departments
FROM dbo.departments;

GO

PRINT '✅ departments 表 is_active 字段添加完成';
