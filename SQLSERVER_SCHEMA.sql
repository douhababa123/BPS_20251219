-- ============================================================================
-- BPS 项目 SQL Server 数据库完整建表脚本
-- 从 Supabase (PostgreSQL) 迁移到 SQL Server
-- ============================================================================
-- 创建日期: 2026-01-29
-- 说明: 包含所有表结构、索引、约束和初始数据
-- 执行方式: 在 SQL Server Management Studio (SSMS) 中打开并执行
-- ============================================================================

-- ============================================================================
-- 第一部分：删除旧表（如果存在，重新运行脚本时使用）
-- ============================================================================
-- 注意：首次执行可以跳过此部分，或保留以确保幂等性

IF OBJECT_ID('dbo.resource_planning_tasks', 'U') IS NOT NULL DROP TABLE dbo.resource_planning_tasks;
IF OBJECT_ID('dbo.tasks', 'U') IS NOT NULL DROP TABLE dbo.tasks;
IF OBJECT_ID('dbo.competency_assessment_history', 'U') IS NOT NULL DROP TABLE dbo.competency_assessment_history;
IF OBJECT_ID('dbo.competency_assessments', 'U') IS NOT NULL DROP TABLE dbo.competency_assessments;
IF OBJECT_ID('dbo.employees', 'U') IS NOT NULL DROP TABLE dbo.employees;
IF OBJECT_ID('dbo.skills', 'U') IS NOT NULL DROP TABLE dbo.skills;
IF OBJECT_ID('dbo.departments', 'U') IS NOT NULL DROP TABLE dbo.departments;
IF OBJECT_ID('dbo.task_types', 'U') IS NOT NULL DROP TABLE dbo.task_types;
IF OBJECT_ID('dbo.factories', 'U') IS NOT NULL DROP TABLE dbo.factories;
IF OBJECT_ID('dbo.otp_tokens', 'U') IS NOT NULL DROP TABLE dbo.otp_tokens;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;
GO

-- ============================================================================
-- 第二部分：创建认证相关表（新增）
-- ============================================================================

-- 2.1 用户表（替代 Supabase Auth）
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
GO

PRINT '✅ 用户表 (users) 创建完成';
GO

-- 2.2 OTP 验证码临时表
CREATE TABLE dbo.otp_tokens (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email NVARCHAR(255) NOT NULL,
  token NVARCHAR(10) NOT NULL,
  type NVARCHAR(50) NOT NULL CHECK (type IN ('signup', 'login', 'recovery')),
  expires_at DATETIME2 NOT NULL,
  used BIT DEFAULT 0,
  used_at DATETIME2,
  created_at DATETIME2 DEFAULT GETDATE()
);

CREATE INDEX idx_otp_email_type ON dbo.otp_tokens(email, type, expires_at);
GO

PRINT '✅ OTP 验证码表 (otp_tokens) 创建完成';
GO

-- ============================================================================
-- 第三部分：创建业务核心表
-- ============================================================================

-- 3.1 部门表
CREATE TABLE dbo.departments (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  name NVARCHAR(255) NOT NULL,
  code NVARCHAR(50),
  description NVARCHAR(MAX),
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_departments_name UNIQUE (name),
  CONSTRAINT uq_departments_code UNIQUE (code)
);
GO

PRINT '✅ 部门表 (departments) 创建完成';
GO

-- 3.2 员工表
CREATE TABLE dbo.employees (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id NVARCHAR(50) NOT NULL,
  name NVARCHAR(255) NOT NULL,
  department_id BIGINT,
  email NVARCHAR(255),
  position NVARCHAR(255),
  auth_user_id UNIQUEIDENTIFIER,
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_employees_employee_id UNIQUE (employee_id),
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES dbo.departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_auth_user FOREIGN KEY (auth_user_id) REFERENCES dbo.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_employees_department ON dbo.employees(department_id);
CREATE INDEX idx_employees_employee_id ON dbo.employees(employee_id);
CREATE INDEX idx_employees_name ON dbo.employees(name);
CREATE INDEX idx_employees_auth_user ON dbo.employees(auth_user_id);
CREATE INDEX idx_employees_email ON dbo.employees(email);
GO

PRINT '✅ 员工表 (employees) 创建完成';
GO

-- 3.3 技能表
CREATE TABLE dbo.skills (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  module_id INT NOT NULL,
  module_name NVARCHAR(255) NOT NULL,
  skill_name NVARCHAR(255) NOT NULL,
  skill_code NVARCHAR(50),
  description NVARCHAR(MAX),
  display_order INT DEFAULT 0,
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_skills_module_name UNIQUE (module_id, skill_name),
  CONSTRAINT uq_skills_code UNIQUE (skill_code)
);

CREATE INDEX idx_skills_module ON dbo.skills(module_id);
CREATE INDEX idx_skills_active ON dbo.skills(is_active);
CREATE INDEX idx_skills_order ON dbo.skills(display_order);
GO

PRINT '✅ 技能表 (skills) 创建完成';
GO

-- 3.4 能力评估表
CREATE TABLE dbo.competency_assessments (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER NOT NULL,
  skill_id BIGINT NOT NULL,
  current_level INT NOT NULL,
  target_level INT NOT NULL,
  gap AS (target_level - current_level) PERSISTED,
  assessment_year INT DEFAULT YEAR(GETDATE()),
  assessment_date DATE DEFAULT CAST(GETDATE() AS DATE),
  notes NVARCHAR(MAX),
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT UQ_competency_assessments_employee_skill UNIQUE (employee_id, skill_id),
  CONSTRAINT CK_competency_assessments_current_0_5 CHECK (current_level BETWEEN 0 AND 5),
  CONSTRAINT CK_competency_assessments_target_0_5 CHECK (target_level BETWEEN 0 AND 5),
  CONSTRAINT CK_competency_assessments_target_gte_current CHECK (target_level >= current_level),
  CONSTRAINT fk_assessments_employee FOREIGN KEY (employee_id) REFERENCES dbo.employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessments_skill FOREIGN KEY (skill_id) REFERENCES dbo.skills(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessments_employee ON dbo.competency_assessments(employee_id);
CREATE INDEX idx_assessments_skill ON dbo.competency_assessments(skill_id);
CREATE INDEX idx_assessments_year ON dbo.competency_assessments(assessment_year);
CREATE INDEX idx_assessments_gap ON dbo.competency_assessments(gap);
GO

CREATE TABLE dbo.competency_assessment_history (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
  assessment_id UNIQUEIDENTIFIER NOT NULL,
  source_assessment_id UNIQUEIDENTIFIER NULL,
  employee_id UNIQUEIDENTIFIER NOT NULL,
  skill_id BIGINT NOT NULL,
  current_level INT NOT NULL,
  target_level INT NOT NULL,
  gap AS (target_level - current_level) PERSISTED,
  assessment_date DATETIME2 NOT NULL,
  assessment_year INT NOT NULL,
  assessment_quarter TINYINT NOT NULL,
  notes NVARCHAR(MAX) NULL,
  changed_at DATETIME2 NOT NULL DEFAULT GETDATE(),
  changed_by_user_id UNIQUEIDENTIFIER NULL,
  change_source NVARCHAR(32) NOT NULL,
  CONSTRAINT CK_competency_history_current_0_5 CHECK (current_level BETWEEN 0 AND 5),
  CONSTRAINT CK_competency_history_target_0_5 CHECK (target_level BETWEEN 0 AND 5),
  CONSTRAINT CK_competency_history_target_gte_current
    CHECK (change_source = 'MIGRATION_BASELINE' OR target_level >= current_level),
  CONSTRAINT CK_competency_history_quarter CHECK (assessment_quarter BETWEEN 1 AND 4),
  CONSTRAINT CK_competency_history_source
    CHECK (change_source IN ('MIGRATION_BASELINE', 'WEB_EDIT')),
  CONSTRAINT FK_competency_history_assessment FOREIGN KEY (assessment_id)
    REFERENCES dbo.competency_assessments(id),
  CONSTRAINT FK_competency_history_employee FOREIGN KEY (employee_id)
    REFERENCES dbo.employees(id),
  CONSTRAINT FK_competency_history_skill FOREIGN KEY (skill_id)
    REFERENCES dbo.skills(id),
  CONSTRAINT FK_competency_history_user FOREIGN KEY (changed_by_user_id)
    REFERENCES dbo.users(id)
);

CREATE UNIQUE INDEX UX_competency_history_source_assessment
  ON dbo.competency_assessment_history(source_assessment_id)
  WHERE source_assessment_id IS NOT NULL;
CREATE INDEX IX_competency_history_employee_skill_changed
  ON dbo.competency_assessment_history(employee_id, skill_id, changed_at DESC);
CREATE INDEX IX_competency_history_year_quarter
  ON dbo.competency_assessment_history(assessment_year, assessment_quarter, changed_at DESC);
GO

PRINT '✅ 能力评估表 (competency_assessments) 创建完成';
GO

-- ============================================================================
-- 第四部分：创建任务管理相关表
-- ============================================================================

-- 4.1 任务类型表
CREATE TABLE dbo.task_types (
  id INT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) NOT NULL,
  name NVARCHAR(255) NOT NULL,
  color_hex NVARCHAR(10) NOT NULL,
  description NVARCHAR(MAX),
  is_system BIT DEFAULT 1,
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_task_types_code UNIQUE (code)
);

CREATE INDEX idx_task_types_active ON dbo.task_types(is_active);
GO

PRINT '✅ 任务类型表 (task_types) 创建完成';
GO

-- 4.2 工厂表
CREATE TABLE dbo.factories (
  id INT IDENTITY(1,1) PRIMARY KEY,
  code NVARCHAR(50) NOT NULL,
  name NVARCHAR(255) NOT NULL,
  region NVARCHAR(255),
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT uq_factories_code UNIQUE (code)
);

CREATE INDEX idx_factories_active ON dbo.factories(is_active);
GO

PRINT '✅ 工厂表 (factories) 创建完成';
GO

-- 4.3 任务表
CREATE TABLE dbo.tasks (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  task_name NVARCHAR(500) NOT NULL,
  task_type NVARCHAR(100) NOT NULL,
  task_location NVARCHAR(100) NOT NULL,
  assigned_employee_id UNIQUEIDENTIFIER,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INT,
  hours_per_day INT DEFAULT 8,
  total_hours INT,
  source NVARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'system')),
  status NVARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  is_cross_factory BIT DEFAULT 0,
  request_factory NVARCHAR(100),
  required_skills NVARCHAR(MAX), -- 存储 JSON 数组字符串
  notes NVARCHAR(MAX),
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_tasks_employee FOREIGN KEY (assigned_employee_id) REFERENCES dbo.employees(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_employee ON dbo.tasks(assigned_employee_id);
CREATE INDEX idx_tasks_dates ON dbo.tasks(start_date, end_date);
CREATE INDEX idx_tasks_status ON dbo.tasks(status);
CREATE INDEX idx_tasks_type ON dbo.tasks(task_type);
GO

PRINT '✅ 任务表 (tasks) 创建完成';
GO

-- ============================================================================
-- 第五部分：创建资源规划表
-- ============================================================================

CREATE TABLE dbo.resource_planning_tasks (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER,
  task_topic NVARCHAR(500) NOT NULL,
  task_type NVARCHAR(100),
  task_location NVARCHAR(100),
  task_date DATE,
  year_month NVARCHAR(10), -- 格式: "2025-01"
  cw_week NVARCHAR(10),    -- 格式: "CW01"
  day_of_month INT,
  week_start DATE,
  week_end DATE,
  status NVARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  notes NVARCHAR(MAX),
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_resource_tasks_employee FOREIGN KEY (employee_id) REFERENCES dbo.employees(id) ON DELETE CASCADE
);

CREATE INDEX idx_resource_tasks_date ON dbo.resource_planning_tasks(task_date);
CREATE INDEX idx_resource_tasks_year_month ON dbo.resource_planning_tasks(year_month);
CREATE INDEX idx_resource_tasks_cw_week ON dbo.resource_planning_tasks(cw_week);
CREATE INDEX idx_resource_tasks_emp_date ON dbo.resource_planning_tasks(employee_id, task_date);
GO

PRINT '✅ 资源规划任务表 (resource_planning_tasks) 创建完成';
GO

-- ============================================================================
-- 第六部分：插入初始数据
-- ============================================================================

-- 6.1 插入任务类型初始数据
SET IDENTITY_INSERT dbo.task_types ON;
GO

INSERT INTO dbo.task_types (id, code, name, color_hex, is_system, is_active)
VALUES
  (1, 'workshop', 'Workshop', '#3B82F6', 1, 1),
  (2, 'speed_week', 'Speed week', '#8B5CF6', 1, 1),
  (3, 'project', 'Project', '#10B981', 1, 1),
  (4, 'training', 'Training', '#F59E0B', 1, 1),
  (5, 'coaching', 'Coaching', '#EF4444', 1, 1),
  (6, 'meeting', 'Meeting', '#6366F1', 1, 1),
  (7, 'leave', 'Leave', '#64748B', 1, 1),
  (8, 'self_develop', 'Self-develop', '#14B8A6', 1, 1);
GO

SET IDENTITY_INSERT dbo.task_types OFF;
GO

PRINT '✅ 已插入 8 种系统预设任务类型';
GO

-- 6.2 插入工厂初始数据
SET IDENTITY_INSERT dbo.factories ON;
GO

INSERT INTO dbo.factories (id, code, name, is_active)
VALUES
  (1, 'FLCNa', 'FLCNa', 1),
  (2, 'FLCCh', 'FLCCh', 1),
  (3, 'FCGNa', 'FCGNa', 1),
  (4, 'FEDNa', 'FEDNa', 1),
  (5, 'FCLCh', 'FCLCh', 1),
  (6, 'FDCCh', 'FDCCh', 1),
  (7, 'GPU-SU', 'GPU-SU', 1),
  (8, 'EA', 'EA', 1),
  (9, 'HA', 'HA', 1);
GO

SET IDENTITY_INSERT dbo.factories OFF;
GO

PRINT '✅ 已插入 9 个工厂数据';
GO

-- 6.3 插入技能初始数据（示例）
SET IDENTITY_INSERT dbo.skills ON;
GO

INSERT INTO dbo.skills (id, module_id, module_name, skill_name, display_order, is_active)
VALUES
  (1, 1, 'TPM基础', '设备管理', 1, 1),
  (2, 1, 'TPM基础', '预防维护', 2, 1),
  (3, 1, 'TPM基础', '自主维护', 3, 1),
  (4, 2, '精益流程', 'VSM分析', 4, 1),
  (5, 2, '精益流程', 'SMED', 5, 1),
  (6, 2, '精益流程', '价值流优化', 6, 1),
  (7, 3, '问题解决', '8D方法', 7, 1),
  (8, 3, '问题解决', 'Why-Why分析', 8, 1),
  (9, 3, '问题解决', '根因分析', 9, 1),
  (10, 4, '项目管理', '项目计划', 10, 1),
  (11, 4, '项目管理', '进度管理', 11, 1),
  (12, 4, '项目管理', '风险管理', 12, 1),
  (13, 5, '数据分析', '统计分析', 13, 1),
  (14, 5, '数据分析', 'Excel高级应用', 14, 1),
  (15, 5, '数据分析', '数据可视化', 15, 1),
  (16, 6, '团队领导', '团队建设', 16, 1),
  (17, 6, '团队领导', '沟通协调', 17, 1),
  (18, 6, '团队领导', '冲突管理', 18, 1);
GO

SET IDENTITY_INSERT dbo.skills OFF;
GO

PRINT '✅ 已插入 18 个示例技能数据（6个模块）';
GO

-- ============================================================================
-- 第七部分：创建视图（用于复杂查询优化）
-- ============================================================================

-- 7.1 员工技能评估全视图（含部门、技能信息）
CREATE OR ALTER VIEW dbo.view_assessments_full AS
SELECT
  ca.id,
  ca.employee_id,
  e.employee_id AS employee_code,
  e.name AS employee_name,
  e.department_id,
  d.name AS department_name,
  d.code AS department_code,
  ca.skill_id,
  s.module_id,
  s.module_name,
  s.skill_name,
  s.display_order,
  ca.current_level,
  ca.target_level,
  ca.gap,
  ca.assessment_year,
  ca.assessment_date,
  ca.notes,
  ca.created_at,
  ca.updated_at
FROM dbo.competency_assessments ca
INNER JOIN dbo.employees e ON ca.employee_id = e.id
LEFT JOIN dbo.departments d ON e.department_id = d.id
INNER JOIN dbo.skills s ON ca.skill_id = s.id
WHERE e.is_active = 1 AND s.is_active = 1;
GO

PRINT '✅ 视图 view_assessments_full 创建完成';
GO

-- 7.2 员工维度差距统计视图
CREATE OR ALTER VIEW dbo.view_employee_gaps AS
SELECT
  e.id AS employee_id,
  e.employee_id AS employee_code,
  e.name AS employee_name,
  d.name AS department_name,
  ca.assessment_year,
  COUNT(DISTINCT ca.skill_id) AS total_skills_assessed,
  AVG(CAST(ca.current_level AS FLOAT)) AS avg_current_level,
  AVG(CAST(ca.target_level AS FLOAT)) AS avg_target_level,
  AVG(CAST(ca.gap AS FLOAT)) AS avg_gap,
  SUM(CASE WHEN ca.gap > 0 THEN 1 ELSE 0 END) AS skills_with_gap
FROM dbo.employees e
LEFT JOIN dbo.departments d ON e.department_id = d.id
LEFT JOIN dbo.competency_assessments ca ON e.id = ca.employee_id
WHERE e.is_active = 1
GROUP BY e.id, e.employee_id, e.name, d.name, ca.assessment_year;
GO

PRINT '✅ 视图 view_employee_gaps 创建完成';
GO

-- 7.3 技能维度差距统计视图
CREATE OR ALTER VIEW dbo.view_skill_gaps AS
SELECT
  s.id AS skill_id,
  s.module_id,
  s.module_name,
  s.skill_name,
  ca.assessment_year,
  COUNT(DISTINCT ca.employee_id) AS total_employees_assessed,
  AVG(CAST(ca.current_level AS FLOAT)) AS avg_current_level,
  AVG(CAST(ca.target_level AS FLOAT)) AS avg_target_level,
  AVG(CAST(ca.gap AS FLOAT)) AS avg_gap,
  SUM(CASE WHEN ca.gap > 0 THEN 1 ELSE 0 END) AS employees_with_gap
FROM dbo.skills s
LEFT JOIN dbo.competency_assessments ca ON s.id = ca.skill_id
WHERE s.is_active = 1
GROUP BY s.id, s.module_id, s.module_name, s.skill_name, ca.assessment_year;
GO

PRINT '✅ 视图 view_skill_gaps 创建完成';
GO

-- 7.4 部门维度差距统计视图
CREATE OR ALTER VIEW dbo.view_department_gaps AS
SELECT
  d.id AS department_id,
  d.name AS department_name,
  d.code AS department_code,
  ca.assessment_year,
  COUNT(DISTINCT e.id) AS total_employees,
  COUNT(DISTINCT ca.skill_id) AS total_skills_assessed,
  AVG(CAST(ca.current_level AS FLOAT)) AS avg_current_level,
  AVG(CAST(ca.target_level AS FLOAT)) AS avg_target_level,
  AVG(CAST(ca.gap AS FLOAT)) AS avg_gap,
  SUM(CASE WHEN ca.gap > 0 THEN 1 ELSE 0 END) AS assessments_with_gap
FROM dbo.departments d
LEFT JOIN dbo.employees e ON d.id = e.department_id AND e.is_active = 1
LEFT JOIN dbo.competency_assessments ca ON e.id = ca.employee_id
GROUP BY d.id, d.name, d.code, ca.assessment_year;
GO

PRINT '✅ 视图 view_department_gaps 创建完成';
GO

-- ============================================================================
-- 第八部分：创建存储过程（可选，用于常用操作）
-- ============================================================================

-- 8.1 清理过期 OTP 验证码
CREATE OR ALTER PROCEDURE dbo.sp_cleanup_expired_otps
AS
BEGIN
  DELETE FROM dbo.otp_tokens
  WHERE expires_at < GETDATE() OR used = 1;
  
  PRINT '✅ 已清理过期 OTP 验证码';
END;
GO

PRINT '✅ 存储过程 sp_cleanup_expired_otps 创建完成';
GO

-- ============================================================================
-- 第九部分：验证脚本执行结果
-- ============================================================================

PRINT '';
PRINT '========================================';
PRINT '🎉 SQL Server 数据库 Schema 创建完成！';
PRINT '========================================';
PRINT '';
PRINT '已创建的表:';
PRINT '  1. users (用户认证表)';
PRINT '  2. otp_tokens (OTP验证码表)';
PRINT '  3. departments (部门表)';
PRINT '  4. employees (员工表)';
PRINT '  5. skills (技能表)';
PRINT '  6. competency_assessments (能力评估表)';
PRINT '  7. task_types (任务类型表)';
PRINT '  8. factories (工厂表)';
PRINT '  9. tasks (任务表)';
PRINT ' 10. resource_planning_tasks (资源规划表)';
PRINT '';
PRINT '已创建的视图:';
PRINT '  1. view_assessments_full (评估全信息视图)';
PRINT '  2. view_employee_gaps (员工差距统计视图)';
PRINT '  3. view_skill_gaps (技能差距统计视图)';
PRINT '  4. view_department_gaps (部门差距统计视图)';
PRINT '';
PRINT '已插入的初始数据:';
PRINT '  - 8 种系统预设任务类型';
PRINT '  - 9 个工厂数据';
PRINT '  - 18 个示例技能（6个模块）';
PRINT '';
PRINT '下一步操作:';
PRINT '  1. 运行数据迁移脚本 migrate_supabase_to_sqlserver.py';
PRINT '  2. 验证数据完整性';
PRINT '  3. 配置 FastAPI 后端连接此数据库';
PRINT '';
PRINT '========================================';
GO

-- ============================================================================
-- 附录：查询表结构验证（可选执行）
-- ============================================================================

-- 查看所有表
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;

-- 查看表行数统计
-- SELECT
--   t.name AS TableName,
--   SUM(p.rows) AS RowCount
-- FROM sys.tables t
-- INNER JOIN sys.partitions p ON t.object_id = p.object_id
-- WHERE p.index_id IN (0,1)
-- GROUP BY t.name
-- ORDER BY t.name;
