-- 数据导入后恢复脚本
-- 用途: 恢复导入前修改的约束和字段

USE DCCT_BPS_Debug;
GO

-- 1. 重建 skills 表的唯一约束（忽略 NULL 值）
-- SQL Server 2008+ 支持带 WHERE 子句的唯一索引（过滤索引）
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'uq_skills_code')
BEGIN
    -- 先创建带过滤条件的唯一索引（只对非 NULL 值生效）
    CREATE UNIQUE NONCLUSTERED INDEX uq_skills_code 
    ON dbo.skills(skill_code) 
    WHERE skill_code IS NOT NULL;
    PRINT '✅ 已重建 skills 表的唯一索引 uq_skills_code (过滤 NULL 值)';
END

-- 2. 恢复 tasks 表的 task_type 列为 NOT NULL
-- 注意：只有在所有行都有值时才能恢复 NOT NULL
DECLARE @nullCount INT;
SELECT @nullCount = COUNT(*) FROM dbo.tasks WHERE task_type IS NULL;

IF @nullCount = 0
BEGIN
    ALTER TABLE dbo.tasks ALTER COLUMN task_type NVARCHAR(50) NOT NULL;
    PRINT '✅ 已恢复 tasks.task_type 列为 NOT NULL';
END
ELSE
BEGIN
    PRINT '⚠️  tasks 表中有 ' + CAST(@nullCount AS NVARCHAR) + ' 行的 task_type 为 NULL，无法恢复 NOT NULL 约束';
    PRINT 'ℹ️  建议检查 CSV 数据或手动填充默认值';
END

PRINT '';
PRINT '✅ 导入后恢复完成';
GO
