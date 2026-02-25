-- ============================================================================
-- BPS 项目 SQL Server 数据库补充建表脚本
-- 补充遗漏的 3 个重要表
-- ============================================================================
-- 创建日期: 2026-01-29
-- 说明: 补充 competency_definitions, resource_task_types, schedule_change_notifications
-- 执行方式: 在 SQL Server Management Studio (SSMS) 中打开并执行
-- ============================================================================

USE DCCT_BPS_Debug;
GO

-- ============================================================================
-- 第一部分：补充能力定义表
-- ============================================================================

-- 删除旧表（如果存在）
IF OBJECT_ID('dbo.competency_definitions', 'U') IS NOT NULL DROP TABLE dbo.competency_definitions;
GO

-- 创建能力定义表（9大能力模块和39种能力类型）
CREATE TABLE dbo.competency_definitions (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  module_id INT NOT NULL,                      -- 模块编号（1-9）
  module_name NVARCHAR(255) NOT NULL,          -- 模块名称
  module_name_en NVARCHAR(255),                -- 模块英文名称
  competency_name NVARCHAR(255) NOT NULL,      -- 能力名称
  competency_name_en NVARCHAR(255),            -- 能力英文名称
  competency_code NVARCHAR(50),                -- 能力代码
  description NVARCHAR(MAX),                   -- 描述
  display_order INT DEFAULT 0,                 -- 显示顺序
  is_active BIT DEFAULT 1,                     -- 是否启用
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_competency_definitions_module_name UNIQUE (module_id, competency_name),
  CONSTRAINT uq_competency_definitions_code UNIQUE (competency_code)
);

CREATE INDEX idx_competency_definitions_module ON dbo.competency_definitions(module_id);
CREATE INDEX idx_competency_definitions_active ON dbo.competency_definitions(is_active);
CREATE INDEX idx_competency_definitions_order ON dbo.competency_definitions(display_order);
GO

PRINT '✅ 能力定义表 (competency_definitions) 创建完成';
GO

-- ============================================================================
-- 第二部分：补充资源规划任务类型配置表
-- ============================================================================

-- 删除旧表（如果存在）
IF OBJECT_ID('dbo.resource_task_types', 'U') IS NOT NULL DROP TABLE dbo.resource_task_types;
GO

-- 创建资源规划任务类型配置表
CREATE TABLE dbo.resource_task_types (
  id INT IDENTITY(1,1) PRIMARY KEY,
  type_code NVARCHAR(50) NOT NULL,             -- 任务类型代码
  type_name NVARCHAR(255) NOT NULL,            -- 任务类型名称
  type_name_en NVARCHAR(255),                  -- 任务类型英文名称
  color_hex NVARCHAR(10) NOT NULL,             -- 颜色代码（如 #3B82F6）
  description NVARCHAR(MAX),                   -- 描述
  is_system BIT DEFAULT 1,                     -- 是否系统预设
  is_active BIT DEFAULT 1,                     -- 是否启用
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_resource_task_types_code UNIQUE (type_code)
);

CREATE INDEX idx_resource_task_types_active ON dbo.resource_task_types(is_active);
GO

PRINT '✅ 资源规划任务类型配置表 (resource_task_types) 创建完成';
GO

-- ============================================================================
-- 第三部分：补充日程变更通知表
-- ============================================================================

-- 删除旧表（如果存在）
IF OBJECT_ID('dbo.schedule_change_notifications', 'U') IS NOT NULL DROP TABLE dbo.schedule_change_notifications;
GO

-- 创建日程变更通知表（Site PS修改工程师日程时触发）
CREATE TABLE dbo.schedule_change_notifications (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER NOT NULL,       -- 被修改日程的工程师ID
  changed_by_employee_id UNIQUEIDENTIFIER,     -- 修改者ID（Site PS）
  change_type NVARCHAR(50) NOT NULL,           -- 变更类型（create/update/delete）
  task_id UNIQUEIDENTIFIER,                    -- 关联的任务ID
  change_date DATETIME2 NOT NULL,              -- 变更时间
  notification_status NVARCHAR(50) DEFAULT 'unread' CHECK (notification_status IN ('unread', 'read', 'archived')),
  notification_message NVARCHAR(MAX),          -- 通知消息内容
  created_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_schedule_notifications_employee FOREIGN KEY (employee_id) REFERENCES dbo.employees(id) ON DELETE NO ACTION,
  CONSTRAINT fk_schedule_notifications_changed_by FOREIGN KEY (changed_by_employee_id) REFERENCES dbo.employees(id) ON DELETE NO ACTION
);

CREATE INDEX idx_schedule_notifications_employee ON dbo.schedule_change_notifications(employee_id);
CREATE INDEX idx_schedule_notifications_status ON dbo.schedule_change_notifications(notification_status);
CREATE INDEX idx_schedule_notifications_date ON dbo.schedule_change_notifications(change_date);
GO

PRINT '✅ 日程变更通知表 (schedule_change_notifications) 创建完成';
GO

-- ============================================================================
-- 第四部分：验证脚本执行结果
-- ============================================================================

PRINT '';
PRINT '========================================';
PRINT '🎉 补充表结构创建完成！';
PRINT '========================================';
PRINT '';
PRINT '已补充的表:';
PRINT '  1. competency_definitions (能力定义表)';
PRINT '  2. resource_task_types (资源规划任务类型配置表)';
PRINT '  3. schedule_change_notifications (日程变更通知表)';
PRINT '';
PRINT '下一步操作:';
PRINT '  1. 从 Supabase Dashboard 导出这 3 个表的数据为 CSV';
PRINT '  2. 使用 SSMS 导入数据';
PRINT '  3. 验证数据完整性';
PRINT '';
PRINT '========================================';
GO

-- ============================================================================
-- 附录：查询新增表验证
-- ============================================================================

-- 查看新增的表
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE' 
  AND TABLE_NAME IN ('competency_definitions', 'resource_task_types', 'schedule_change_notifications')
ORDER BY TABLE_NAME;
GO
