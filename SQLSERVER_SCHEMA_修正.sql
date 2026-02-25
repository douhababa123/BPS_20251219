-- ============================================================================
-- SQL Server 表结构修正脚本
-- 根据 Supabase 实际表结构修正字段差异
-- ============================================================================
-- 创建日期: 2026-01-29
-- 说明: 修正 employees, competency_definitions, resource_planning_tasks, 
--       schedule_change_notifications, tasks 表的字段，完全匹配 Supabase
-- 执行方式: 在 SQL Server Management Studio (SSMS) 中打开并执行
-- ============================================================================

USE DCCT_BPS_Debug;
GO

PRINT '============================================================';
PRINT '开始修正 SQL Server 表结构以匹配 Supabase';
PRINT '============================================================';
PRINT '';

-- ============================================================================
-- 修正 1：employees 表 - 添加缺失的 4 个字段
-- ============================================================================

PRINT '修正 employees 表...';

-- 添加 role 字段（角色，默认 'BPS_ENGINEER'）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employees') AND name = 'role')
BEGIN
    ALTER TABLE dbo.employees ADD role NVARCHAR(50) DEFAULT 'BPS_ENGINEER';
    PRINT '  ✅ 已添加字段: role';
END
ELSE
    PRINT '  ⚠️  字段 role 已存在，跳过';

-- 添加 phone 字段（电话）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employees') AND name = 'phone')
BEGIN
    ALTER TABLE dbo.employees ADD phone NVARCHAR(50);
    PRINT '  ✅ 已添加字段: phone';
END
ELSE
    PRINT '  ⚠️  字段 phone 已存在，跳过';

-- 添加 last_login_at 字段（最后登录时间）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employees') AND name = 'last_login_at')
BEGIN
    ALTER TABLE dbo.employees ADD last_login_at DATETIME2;
    PRINT '  ✅ 已添加字段: last_login_at';
END
ELSE
    PRINT '  ⚠️  字段 last_login_at 已存在，跳过';

-- 添加 login_count 字段（登录次数，默认 0）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employees') AND name = 'login_count')
BEGIN
    ALTER TABLE dbo.employees ADD login_count INT DEFAULT 0;
    PRINT '  ✅ 已添加字段: login_count';
END
ELSE
    PRINT '  ⚠️  字段 login_count 已存在，跳过';

PRINT '';

-- ============================================================================
-- 修正 2：创建 resource_task_types 表（初始脚本中缺失）
-- ============================================================================

PRINT '创建 resource_task_types 表...';

-- 删除旧表（如果存在）
IF OBJECT_ID('dbo.resource_task_types', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.resource_task_types;
    PRINT '  ✅ 已删除旧表 resource_task_types';
END

-- 创建 resource_task_types 表（完全匹配 Supabase）
CREATE TABLE dbo.resource_task_types (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) NOT NULL,
  name NVARCHAR(MAX) NOT NULL,
  color_hex NVARCHAR(50) NOT NULL,
  description NVARCHAR(MAX),
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_resource_task_types_code UNIQUE (code)
);

CREATE INDEX idx_resource_task_types_active ON dbo.resource_task_types(is_active);
CREATE INDEX idx_resource_task_types_code ON dbo.resource_task_types(code);

PRINT '  ✅ 已创建 resource_task_types 表（匹配 Supabase）';
PRINT '';

-- ============================================================================
-- 修正 3：competency_definitions 表 - 完全重建以匹配 Supabase
-- ============================================================================

PRINT '修正 competency_definitions 表...';

-- 删除旧表（如果存在外键，先删除外键）
IF OBJECT_ID('dbo.competency_definitions', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.competency_definitions;
    PRINT '  ✅ 已删除旧表 competency_definitions';
END

-- 重新创建表（完全匹配 Supabase）
CREATE TABLE dbo.competency_definitions (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  module_id INT NOT NULL,
  module_name NVARCHAR(MAX) NOT NULL,
  competency_type NVARCHAR(MAX) NOT NULL,           -- Supabase 中是 competency_type，不是 competency_name
  competency_code NVARCHAR(50),
  description NVARCHAR(MAX),
  owner_engineer NVARCHAR(MAX),                     -- 负责工程师
  is_key_competency BIT DEFAULT 0,                  -- 是否核心能力
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE()
);

CREATE INDEX idx_competency_definitions_module ON dbo.competency_definitions(module_id);
CREATE INDEX idx_competency_definitions_code ON dbo.competency_definitions(competency_code);

PRINT '  ✅ 已重新创建 competency_definitions 表（匹配 Supabase）';
PRINT '';

-- ============================================================================
-- 修正 4：resource_planning_tasks 表 - 删除重建（字段差异太大）
-- ============================================================================

PRINT '修正 resource_planning_tasks 表...';

-- 删除旧表
IF OBJECT_ID('dbo.resource_planning_tasks', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.resource_planning_tasks;
    PRINT '  ✅ 已删除旧表 resource_planning_tasks';
END

-- 重新创建表（完全匹配 Supabase 的 20 个字段）
CREATE TABLE dbo.resource_planning_tasks (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  employee_id UNIQUEIDENTIFIER NOT NULL,
  task_type_code NVARCHAR(50),
  start_week NVARCHAR(20),                          -- 格式: "CW01"
  end_week NVARCHAR(20),
  start_date DATE,
  end_date DATE,
  topic NVARCHAR(MAX),                              -- Supabase 是 topic 不是 task_topic
  location NVARCHAR(255),                           -- Supabase 是 location 不是 task_location
  notes NVARCHAR(MAX),
  imported_at DATETIME2 DEFAULT GETDATE(),
  import_batch_id UNIQUEIDENTIFIER,
  source_file_name NVARCHAR(500),
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  task_date DATE,                                   -- 单独的任务日期字段
  year_month NVARCHAR(10),                          -- 格式: "2025-01"
  cw_week NVARCHAR(10),                             -- 格式: "CW01"
  day_of_month INT,
  task_type NVARCHAR(100),                          -- 任务类型名称（冗余字段）
  CONSTRAINT fk_resource_tasks_employee FOREIGN KEY (employee_id) REFERENCES dbo.employees(id) ON DELETE CASCADE
);

CREATE INDEX idx_resource_tasks_employee ON dbo.resource_planning_tasks(employee_id);
CREATE INDEX idx_resource_tasks_date ON dbo.resource_planning_tasks(task_date);
CREATE INDEX idx_resource_tasks_year_month ON dbo.resource_planning_tasks(year_month);
CREATE INDEX idx_resource_tasks_cw_week ON dbo.resource_planning_tasks(cw_week);
CREATE INDEX idx_resource_tasks_import_batch ON dbo.resource_planning_tasks(import_batch_id);

PRINT '  ✅ 已重新创建 resource_planning_tasks 表（匹配 Supabase 20 个字段）';
PRINT '';

-- ============================================================================
-- 修正 5：schedule_change_notifications 表 - 删除重建（字段名不匹配）
-- ============================================================================

PRINT '修正 schedule_change_notifications 表...';

-- 删除旧表
IF OBJECT_ID('dbo.schedule_change_notifications', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.schedule_change_notifications;
    PRINT '  ✅ 已删除旧表 schedule_change_notifications';
END

-- 重新创建表（完全匹配 Supabase）
CREATE TABLE dbo.schedule_change_notifications (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  task_id UNIQUEIDENTIFIER,                         -- 关联的任务ID（可为空）
  affected_employee_id UNIQUEIDENTIFIER NOT NULL,   -- Supabase 是 affected_employee_id
  modified_by_employee_id UNIQUEIDENTIFIER NOT NULL, -- Supabase 是 modified_by_employee_id
  notification_type NVARCHAR(50) NOT NULL,          -- Supabase 是 notification_type
  change_description NVARCHAR(MAX),                 -- Supabase 是 change_description
  is_read BIT DEFAULT 0,                            -- Supabase 是 is_read
  created_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_schedule_notif_affected_emp FOREIGN KEY (affected_employee_id) REFERENCES dbo.employees(id) ON DELETE NO ACTION,
  CONSTRAINT fk_schedule_notif_modified_emp FOREIGN KEY (modified_by_employee_id) REFERENCES dbo.employees(id) ON DELETE NO ACTION,
  CONSTRAINT fk_schedule_notif_task FOREIGN KEY (task_id) REFERENCES dbo.tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_schedule_notif_affected ON dbo.schedule_change_notifications(affected_employee_id);
CREATE INDEX idx_schedule_notif_modified ON dbo.schedule_change_notifications(modified_by_employee_id);
CREATE INDEX idx_schedule_notif_task ON dbo.schedule_change_notifications(task_id);
CREATE INDEX idx_schedule_notif_is_read ON dbo.schedule_change_notifications(is_read);

PRINT '  ✅ 已重新创建 schedule_change_notifications 表（匹配 Supabase）';
PRINT '';

-- ============================================================================
-- 修正 6：tasks 表 - 添加缺失的 time_slot 字段
-- ============================================================================

PRINT '修正 tasks 表...';

-- 添加 time_slot 字段（时间段，默认 'FULL_DAY'）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tasks') AND name = 'time_slot')
BEGIN
    ALTER TABLE dbo.tasks ADD time_slot NVARCHAR(50) DEFAULT 'FULL_DAY';
    PRINT '  ✅ 已添加字段: time_slot';
END
ELSE
    PRINT '  ⚠️  字段 time_slot 已存在，跳过';

-- 修改 hours_per_day 和 total_hours 字段类型为 DECIMAL（匹配 Supabase 的 numeric）
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tasks') AND name = 'hours_per_day' AND system_type_id = 56) -- INT
BEGIN
    ALTER TABLE dbo.tasks ALTER COLUMN hours_per_day DECIMAL(10,2);
    PRINT '  ✅ 已修改字段类型: hours_per_day (INT → DECIMAL)';
END

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tasks') AND name = 'total_hours' AND system_type_id = 56) -- INT
BEGIN
    ALTER TABLE dbo.tasks ALTER COLUMN total_hours DECIMAL(10,2);
    PRINT '  ✅ 已修改字段类型: total_hours (INT → DECIMAL)';
END

-- 修改 required_skills 字段为 NVARCHAR(MAX)（Supabase 是 ARRAY，SQL Server 存储为 JSON 字符串）
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tasks') AND name = 'required_skills')
BEGIN
    -- 因为有 CHECK 约束，需要先删除约束再修改
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.tasks');
    IF @ConstraintName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.tasks DROP CONSTRAINT ' + @ConstraintName);
    END
    
    ALTER TABLE dbo.tasks ALTER COLUMN required_skills NVARCHAR(MAX);
    PRINT '  ✅ 已修改字段类型: required_skills (存储 JSON 数组字符串)';
END

PRINT '';

-- ============================================================================
-- 修正 7：创建 view_resource_planning_latest 视图（缺失的视图）
-- ============================================================================

PRINT '创建 view_resource_planning_latest 视图...';

-- 删除旧视图（如果存在）
IF OBJECT_ID('dbo.view_resource_planning_latest', 'V') IS NOT NULL
BEGIN
    DROP VIEW dbo.view_resource_planning_latest;
    PRINT '  ✅ 已删除旧视图 view_resource_planning_latest';
END
GO

-- 创建视图：资源规划最新版本任务视图（按天存储）
CREATE VIEW dbo.view_resource_planning_latest AS
SELECT
  rpt.id,
  rpt.employee_id,
  e.employee_id AS employee_code,
  e.name AS employee_name,
  e.department_id,
  d.name AS department_name,
  rpt.task_type_code,
  rpt.task_type,
  rpt.topic,
  rpt.location,
  rpt.task_date,
  rpt.year_month,
  rpt.cw_week,
  rpt.day_of_month,
  rpt.start_date,
  rpt.end_date,
  rpt.notes,
  rpt.created_at
FROM dbo.resource_planning_tasks rpt
LEFT JOIN dbo.employees e ON rpt.employee_id = e.id
LEFT JOIN dbo.departments d ON e.department_id = d.id
WHERE e.is_active = 1;
GO

PRINT '  ✅ 已创建 view_resource_planning_latest 视图';
PRINT '';

-- ============================================================================
-- 修正 8：departments 表 - 调整 ID 类型（Supabase 是 BIGINT，不是自增）
-- ============================================================================

PRINT '修正 departments 表...';

-- 注意：departments.id 在 Supabase 中是 BIGINT 但不是自增的
-- 由于已经创建了 IDENTITY，这里保持不变，导入时手动插入 ID 即可

PRINT '  ℹ️  departments.id 保持 IDENTITY，CSV 导入时需手动指定 ID';
PRINT '';

-- ============================================================================
-- 修正 7：skills 表 - 调整 ID 类型
-- ============================================================================

PRINT '修正 skills 表...';

-- skills.id 在 Supabase 中也是 BIGINT 但不是自增
-- 保持 IDENTITY，导入时手动插入

PRINT '  ℹ️  skills.id 保持 IDENTITY，CSV 导入时需手动指定 ID';
PRINT '';

-- ============================================================================
-- 修正 8：resource_task_types 表 - 调整 ID 类型
-- ============================================================================

PRINT '修正 resource_task_types 表...';

-- resource_task_types.id 在 Supabase 中也是 BIGINT 但不是自增
-- 保持 IDENTITY，导入时手动插入

PRINT '  ℹ️  resource_task_types.id 保持 IDENTITY，CSV 导入时需手动指定 ID';
PRINT '';

-- ============================================================================
-- 验证修正结果
-- ============================================================================

PRINT '';
PRINT '============================================================';
PRINT '✅ 表结构修正完成！';
PRINT '============================================================';
PRINT '';
PRINT '已修正的表:';
PRINT '  1. ✅ employees - 添加了 4 个字段（role, phone, last_login_at, login_count）';
PRINT '  2. ✅ competency_definitions - 完全重建（匹配 Supabase 10 个字段）';
PRINT '  3. ✅ resource_planning_tasks - 完全重建（匹配 Supabase 20 个字段）';
PRINT '  4. ✅ schedule_change_notifications - 完全重建（匹配 Supabase 8 个字段）';
PRINT '  5. ✅ tasks - 添加 time_slot 字段，调整数值类型';
PRINT '';
PRINT '现在可以开始导入 Supabase 的 CSV 数据！';
PRINT '';
PRINT '导入顺序:';
PRINT '  第一批: departments, factories, task_types, resource_task_types, skills, competency_definitions';
PRINT '  第二批: employees';
PRINT '  第三批: competency_assessments, tasks, resource_planning_tasks, schedule_change_notifications';
PRINT '';
PRINT '注意事项:';
PRINT '  - departments, skills, resource_task_types 的 ID 需要手动指定（SET IDENTITY_INSERT ON）';
PRINT '  - UUID 字段需要确保格式正确';
PRINT '  - 时间字段确保格式为 ISO 8601（yyyy-MM-dd HH:mm:ss）';
PRINT '';
PRINT '============================================================';
GO

-- 查看最终表结构统计
SELECT 
    t.name AS table_name,
    COUNT(c.column_id) AS column_count
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
WHERE t.name IN (
    'departments',
    'employees',
    'factories',
    'task_types',
    'skills',
    'competency_definitions',
    'competency_assessments',
    'resource_task_types',
    'tasks',
    'resource_planning_tasks',
    'schedule_change_notifications'
)
GROUP BY t.name
ORDER BY t.name;
