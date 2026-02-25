-- 数据导入前临时处理脚本
-- 用途: 解决导入过程中的约束和字段问题

USE DCCT_BPS_Debug;
GO

-- 1. 删除 skills 表的唯一约束（导入后会重建）
IF EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'uq_skills_code')
BEGIN
    ALTER TABLE dbo.skills DROP CONSTRAINT uq_skills_code;
    PRINT '✅ 已删除 skills 表的唯一约束 uq_skills_code';
END

-- 2. 修改 tasks 表的 task_type 列允许 NULL（导入后会恢复）
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 'tasks' AND COLUMN_NAME = 'task_type' AND IS_NULLABLE = 'NO')
BEGIN
    ALTER TABLE dbo.tasks ALTER COLUMN task_type NVARCHAR(50) NULL;
    PRINT '✅ 已修改 tasks.task_type 列允许 NULL';
END

PRINT '';
PRINT '✅ 临时处理完成，可以开始导入数据';
GO
