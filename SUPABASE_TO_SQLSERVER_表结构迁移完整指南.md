# Supabase 到 SQL Server 表结构迁移完整指南

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **适用场景**: BPS 项目从 Supabase (PostgreSQL) 迁移到 SQL Server 2019+  
> **目标**: 提供一次性迁移指南，避免重复字段差异修正工作

---

## 📋 目录

1. [迁移概述](#迁移概述)
2. [Supabase 表结构详细说明](#supabase-表结构详细说明)
3. [SQL Server 表结构说明](#sql-server-表结构说明)
4. [关键字段差异对比](#关键字段差异对比)
5. [完整迁移步骤](#完整迁移步骤)
6. [执行脚本说明](#执行脚本说明)
7. [验证检查清单](#验证检查清单)
8. [常见问题与注意事项](#常见问题与注意事项)

---

## 迁移概述

### 数据源信息
- **源数据库**: Supabase (PostgreSQL 15+)
- **目标数据库**: SQL Server 2019+ (本次迁移: 10.88.43.154, DCCT_BPS_Debug)
- **业务表数量**: 11 个表 + 5 个视图
- **数据总量**: 3013 行（2026-01-29 统计）
- **认证方式**: Supabase Auth → SQL Server 表 + JWT

### 核心差异
1. **数据类型**: UUID → UNIQUEIDENTIFIER, BIGINT → BIGINT IDENTITY, ARRAY → NVARCHAR(MAX) JSON
2. **字段命名**: 部分字段名称不一致（如 `competency_type` vs `competency_name`）
3. **认证架构**: 需新增 `users` 和 `otp_tokens` 表替代 Supabase Auth
4. **自增字段**: Supabase 部分表的 BIGINT 不自增，SQL Server 使用 IDENTITY

---

## Supabase 表结构详细说明

### 表清单及数据量

| 序号 | 表名 | 行数 | 说明 |
|------|------|------|------|
| 1 | departments | 14 | 部门信息 |
| 2 | employees | 18 | 员工信息 |
| 3 | factories | 9 | 工厂信息 |
| 4 | task_types | 8 | 任务类型（系统级） |
| 5 | resource_task_types | 11 | 资源任务类型（业务级） |
| 6 | skills | 104 | 技能列表 |
| 7 | competency_definitions | 39 | 能力定义 |
| 8 | competency_assessments | 375 | 能力评估记录 |
| 9 | tasks | 15 | 任务表 |
| 10 | resource_planning_tasks | 2411 | 资源规划任务（按天存储） |
| 11 | schedule_change_notifications | 9 | 排班变更通知 |
| **总计** | **11 张表** | **3013 行** | - |

### 视图清单

| 序号 | 视图名 | 说明 |
|------|--------|------|
| 1 | view_assessments_full | 完整能力评估视图（带员工、部门、技能信息） |
| 2 | view_department_gaps | 部门能力缺口视图 |
| 3 | view_employee_gaps | 员工能力缺口视图 |
| 4 | view_skill_gaps | 技能缺口视图 |
| 5 | view_resource_planning_latest | 资源规划最新版本视图 |

---

### 1. departments（部门表）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | bigint | PK | 主键（不自增，手动指定） |
| code | text | UNIQUE | 部门代码 |
| name | text | NOT NULL | 部门名称 |
| description | text | - | 部门描述 |
| is_active | boolean | DEFAULT true | 是否活跃 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

**注意**: `id` 是 `bigint` 但不是 SERIAL/自增，需手动插入 ID。

---

### 2. employees（员工表）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| employee_id | character varying(50) | UNIQUE, NOT NULL | 工号 |
| name | text | NOT NULL | 姓名 |
| email | character varying(255) | UNIQUE, NOT NULL | 邮箱 |
| department_id | bigint | FK → departments.id | 部门 ID |
| factory_id | bigint | FK → factories.id | 工厂 ID |
| skill_ids | ARRAY | - | 技能 ID 数组 |
| **role** | character varying(50) | DEFAULT 'BPS_ENGINEER' | **角色**（初始脚本缺失） |
| **phone** | character varying(50) | - | **电话**（初始脚本缺失） |
| hire_date | date | - | 入职日期 |
| is_active | boolean | DEFAULT true | 是否在职 |
| **last_login_at** | timestamp with time zone | - | **最后登录时间**（初始脚本缺失） |
| **login_count** | integer | DEFAULT 0 | **登录次数**（初始脚本缺失） |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

**关键字段差异**: 初始 SQL Server 脚本缺少 `role`, `phone`, `last_login_at`, `login_count` 4 个字段。

---

### 3. factories（工厂表）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | bigint | PK, SERIAL | 主键（自增） |
| code | text | UNIQUE | 工厂代码 |
| name | text | NOT NULL | 工厂名称 |
| location | text | - | 位置 |
| is_active | boolean | DEFAULT true | 是否活跃 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

---

### 4. task_types（任务类型表 - 系统级）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | integer | PK, SERIAL | 主键（自增） |
| code | character varying(50) | UNIQUE, NOT NULL | 任务代码 |
| name | text | NOT NULL | 任务名称 |
| color_hex | character varying(50) | NOT NULL | 颜色 |
| description | text | - | 描述 |
| is_system | boolean | DEFAULT false | 是否系统任务 |
| is_active | boolean | DEFAULT true | 是否活跃 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

---

### 5. resource_task_types（资源任务类型表 - 业务级）⚠️

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | bigint | PK | 主键（不自增） |
| code | character varying(50) | UNIQUE, NOT NULL | 任务代码 |
| name | text | NOT NULL | 任务名称 |
| color_hex | character varying(50) | NOT NULL | 颜色 |
| description | text | - | 描述 |
| is_active | boolean | DEFAULT true | 是否活跃 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

**⚠️ 关键问题**: 此表在初始 `SQLSERVER_SCHEMA.sql` 中**完全缺失**，必须补充创建！

---

### 6. skills（技能表）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | bigint | PK | 主键（不自增，手动指定） |
| skill_id | character varying(50) | UNIQUE, NOT NULL | 技能代码 |
| skill_name | text | NOT NULL | 技能名称 |
| category | text | - | 技能类别 |
| description | text | - | 描述 |
| is_active | boolean | DEFAULT true | 是否活跃 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

**注意**: `id` 不自增，需手动插入 ID。

---

### 7. competency_definitions（能力定义表）⚠️

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | bigint | PK, SERIAL | 主键（自增） |
| module_id | integer | NOT NULL | 模块 ID |
| module_name | text | NOT NULL | 模块名称 |
| **competency_type** | text | NOT NULL | **能力类型**（注意：不是 competency_name） |
| competency_code | character varying(50) | - | 能力代码 |
| description | text | - | 描述 |
| **owner_engineer** | text | - | **负责工程师**（初始脚本缺失） |
| **is_key_competency** | boolean | DEFAULT false | **是否核心能力**（初始脚本缺失） |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

**⚠️ 关键字段差异**: 
- 字段名是 `competency_type`，不是 `competency_name`
- 缺少 `owner_engineer` 和 `is_key_competency` 字段

---

### 8. competency_assessments（能力评估表）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | bigint | PK, SERIAL | 主键（自增） |
| employee_id | uuid | FK → employees.id | 员工 ID |
| skill_id | bigint | FK → skills.id | 技能 ID |
| competency_definition_id | bigint | FK → competency_definitions.id | 能力定义 ID |
| level | integer | NOT NULL | 能力等级（1-5） |
| assessed_at | timestamp with time zone | DEFAULT now() | 评估时间 |
| assessed_by | uuid | - | 评估人 ID |
| notes | text | - | 备注 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

---

### 9. tasks（任务表）⚠️

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| task_name | text | NOT NULL | 任务名称 |
| task_type_id | integer | FK → task_types.id | 任务类型 ID |
| assigned_employee_id | uuid | FK → employees.id | 负责人 ID |
| start_date | date | NOT NULL | 开始日期 |
| end_date | date | NOT NULL | 结束日期 |
| **time_slot** | character varying(50) | DEFAULT 'FULL_DAY' | **时间段**（初始脚本缺失） |
| hours_per_day | numeric | - | 每天小时数 |
| total_hours | numeric | - | 总小时数 |
| priority | integer | DEFAULT 3 | 优先级 |
| status | character varying(50) | DEFAULT 'PENDING' | 状态 |
| required_skills | ARRAY | - | 所需技能 ID 数组 |
| description | text | - | 描述 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |

**⚠️ 关键字段差异**: 
- 缺少 `time_slot` 字段
- `hours_per_day` 和 `total_hours` 应为 `numeric` (DECIMAL)，不是 INT

---

### 10. resource_planning_tasks（资源规划任务表 - 按天存储）⚠️

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | bigint | PK, SERIAL | 主键（自增） |
| employee_id | uuid | FK → employees.id | 员工 ID |
| task_type_code | character varying(50) | - | 任务类型代码 |
| start_week | character varying(20) | - | 开始周（CW01） |
| end_week | character varying(20) | - | 结束周（CW52） |
| start_date | date | - | 开始日期 |
| end_date | date | - | 结束日期 |
| **topic** | text | - | **主题**（注意：不是 task_topic） |
| **location** | character varying(255) | - | **地点**（注意：不是 task_location） |
| notes | text | - | 备注 |
| imported_at | timestamp with time zone | DEFAULT now() | 导入时间 |
| import_batch_id | uuid | - | 导入批次 ID |
| source_file_name | character varying(500) | - | 源文件名 |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |
| updated_at | timestamp with time zone | DEFAULT now() | 更新时间 |
| **task_date** | date | - | **任务日期**（单独字段） |
| **year_month** | character varying(10) | - | **年月**（2025-01） |
| **cw_week** | character varying(10) | - | **日历周**（CW01） |
| **day_of_month** | integer | - | **月份日期**（1-31） |
| **task_type** | character varying(100) | - | **任务类型名称**（冗余字段） |

**⚠️ 关键字段差异**: 
- 字段数量差异巨大：Supabase 20 个字段 vs 初始脚本约 10 个字段
- 字段名不一致：`topic` vs `task_topic`，`location` vs `task_location`
- 缺少 5 个关键字段：`task_date`, `year_month`, `cw_week`, `day_of_month`, `task_type`

---

### 11. schedule_change_notifications（排班变更通知表）⚠️

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| task_id | uuid | FK → tasks.id | 任务 ID |
| **affected_employee_id** | uuid | FK → employees.id | **受影响员工 ID**（注意字段名） |
| **modified_by_employee_id** | uuid | FK → employees.id | **修改人员工 ID**（注意字段名） |
| **notification_type** | character varying(50) | NOT NULL | **通知类型**（注意字段名） |
| **change_description** | text | - | **变更描述**（注意字段名） |
| **is_read** | boolean | DEFAULT false | **是否已读**（注意字段名） |
| created_at | timestamp with time zone | DEFAULT now() | 创建时间 |

**⚠️ 关键字段差异**: 所有主要字段名都不一致！
- `affected_employee_id` vs `employee_id`
- `modified_by_employee_id` vs `changed_by_employee_id`
- `notification_type` vs `change_type`
- `change_description` vs `description`
- `is_read` vs `notification_status`

---

## SQL Server 表结构说明

### 新增认证表（替代 Supabase Auth）

#### users（用户表）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | 主键 |
| email | NVARCHAR(255) | UNIQUE, NOT NULL | 邮箱 |
| name | NVARCHAR(255) | NOT NULL | 姓名 |
| email_confirmed | BIT | DEFAULT 0 | 邮箱是否确认 |
| email_confirmed_at | DATETIME2 | - | 邮箱确认时间 |
| is_active | BIT | DEFAULT 1 | 是否活跃 |
| created_at | DATETIME2 | DEFAULT GETDATE() | 创建时间 |
| updated_at | DATETIME2 | DEFAULT GETDATE() | 更新时间 |

#### otp_tokens（OTP 验证码表）

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | UNIQUEIDENTIFIER | PK, DEFAULT NEWID() | 主键 |
| email | NVARCHAR(255) | NOT NULL | 邮箱 |
| otp_code | NVARCHAR(10) | NOT NULL | OTP 验证码 |
| created_at | DATETIME2 | DEFAULT GETDATE() | 创建时间 |
| expires_at | DATETIME2 | NOT NULL | 过期时间 |
| is_used | BIT | DEFAULT 0 | 是否已使用 |
| used_at | DATETIME2 | - | 使用时间 |
| action_type | NVARCHAR(50) | NOT NULL | 操作类型（SIGNUP/LOGIN/RESET_PASSWORD） |

---

### 数据类型映射规则

| Supabase (PostgreSQL) | SQL Server | 说明 |
|----------------------|------------|------|
| uuid | UNIQUEIDENTIFIER | UUID 类型 |
| bigint (自增) | BIGINT IDENTITY(1,1) | 自增 64 位整数 |
| bigint (非自增) | BIGINT | 普通 64 位整数，导入时需手动指定 |
| integer (自增) | INT IDENTITY(1,1) | 自增 32 位整数 |
| text | NVARCHAR(MAX) | 可变长文本 |
| character varying(n) | NVARCHAR(n) | 可变长字符串 |
| boolean | BIT | 布尔值 |
| numeric | DECIMAL(10,2) | 数值类型 |
| date | DATE | 日期 |
| timestamp with time zone | DATETIME2 | 时间戳 |
| ARRAY | NVARCHAR(MAX) | 存储为 JSON 数组字符串 |
| now() | GETDATE() | 当前时间函数 |
| gen_random_uuid() | NEWID() | 生成 UUID 函数 |

---

## 关键字段差异对比

### 差异汇总表

| 表名 | 差异类型 | Supabase 字段 | 初始 SQL Server | 修正方案 |
|------|----------|---------------|----------------|----------|
| **employees** | 缺少字段 | role, phone, last_login_at, login_count | ❌ 缺失 | ✅ ALTER TABLE ADD |
| **resource_task_types** | 整表缺失 | 完整 8 字段表 | ❌ 表不存在 | ✅ CREATE TABLE |
| **competency_definitions** | 字段名+缺失 | competency_type, owner_engineer, is_key_competency | ❌ competency_name, 缺少2字段 | ✅ DROP + CREATE |
| **resource_planning_tasks** | 字段名+缺失 | topic, location, task_date, year_month, cw_week, day_of_month, task_type | ❌ task_topic, task_location, 缺少5字段 | ✅ DROP + CREATE |
| **schedule_change_notifications** | 所有字段名 | affected_employee_id, modified_by_employee_id, notification_type, change_description, is_read | ❌ employee_id, changed_by_employee_id, change_type, description, notification_status | ✅ DROP + CREATE |
| **tasks** | 缺少字段+类型 | time_slot, hours_per_day(numeric), total_hours(numeric) | ❌ 缺少 time_slot, INT 类型 | ✅ ALTER TABLE ADD + ALTER COLUMN |
| **view_resource_planning_latest** | 整个视图缺失 | 完整视图定义 | ❌ 视图不存在 | ✅ CREATE VIEW |

---

### 详细差异对比

#### 1. employees 表差异

| 字段 | Supabase | 初始 SQL Server | 状态 |
|------|----------|----------------|------|
| role | VARCHAR(50) DEFAULT 'BPS_ENGINEER' | ❌ 缺失 | 需添加 |
| phone | VARCHAR(50) | ❌ 缺失 | 需添加 |
| last_login_at | TIMESTAMP | ❌ 缺失 | 需添加 |
| login_count | INT DEFAULT 0 | ❌ 缺失 | 需添加 |

**修正SQL**:
```sql
ALTER TABLE dbo.employees ADD role NVARCHAR(50) DEFAULT 'BPS_ENGINEER';
ALTER TABLE dbo.employees ADD phone NVARCHAR(50);
ALTER TABLE dbo.employees ADD last_login_at DATETIME2;
ALTER TABLE dbo.employees ADD login_count INT DEFAULT 0;
```

---

#### 2. resource_task_types 表差异

**问题**: 初始脚本完全缺失此表！

**修正SQL**:
```sql
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
```

---

#### 3. competency_definitions 表差异

| 字段 | Supabase | 初始 SQL Server | 状态 |
|------|----------|----------------|------|
| competency_type | TEXT NOT NULL | ❌ competency_name | 字段名错误 |
| owner_engineer | TEXT | ❌ 缺失 | 需添加 |
| is_key_competency | BOOLEAN DEFAULT false | ❌ 缺失 | 需添加 |

**修正方案**: 删除重建（字段名不一致，无法简单 ALTER）

---

#### 4. resource_planning_tasks 表差异

| 字段 | Supabase | 初始 SQL Server | 状态 |
|------|----------|----------------|------|
| topic | TEXT | ❌ task_topic | 字段名错误 |
| location | VARCHAR(255) | ❌ task_location | 字段名错误 |
| task_date | DATE | ❌ 缺失 | 需添加 |
| year_month | VARCHAR(10) | ❌ 缺失 | 需添加 |
| cw_week | VARCHAR(10) | ❌ 缺失 | 需添加 |
| day_of_month | INT | ❌ 缺失 | 需添加 |
| task_type | VARCHAR(100) | ❌ 缺失 | 需添加 |

**修正方案**: 删除重建（字段差异太大）

---

#### 5. schedule_change_notifications 表差异

| 字段 | Supabase | 初始 SQL Server | 状态 |
|------|----------|----------------|------|
| affected_employee_id | UUID FK | ❌ employee_id | 字段名错误 |
| modified_by_employee_id | UUID FK | ❌ changed_by_employee_id | 字段名错误 |
| notification_type | VARCHAR(50) | ❌ change_type | 字段名错误 |
| change_description | TEXT | ❌ description | 字段名错误 |
| is_read | BOOLEAN | ❌ notification_status | 字段名错误 |

**修正方案**: 删除重建（所有主要字段名都不一致）

---

#### 6. tasks 表差异

| 字段 | Supabase | 初始 SQL Server | 状态 |
|------|----------|----------------|------|
| time_slot | VARCHAR(50) DEFAULT 'FULL_DAY' | ❌ 缺失 | 需添加 |
| hours_per_day | NUMERIC | ❌ INT | 类型错误 |
| total_hours | NUMERIC | ❌ INT | 类型错误 |

**修正SQL**:
```sql
ALTER TABLE dbo.tasks ADD time_slot NVARCHAR(50) DEFAULT 'FULL_DAY';
ALTER TABLE dbo.tasks ALTER COLUMN hours_per_day DECIMAL(10,2);
ALTER TABLE dbo.tasks ALTER COLUMN total_hours DECIMAL(10,2);
```

---

#### 7. view_resource_planning_latest 视图缺失

**问题**: 初始脚本只创建了 4 个视图，缺少此视图。

**修正SQL**:
```sql
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
```

---

## 完整迁移步骤

### 阶段 1️⃣: 创建初始表结构（约 10 分钟）

1. **打开 SQL Server Management Studio (SSMS)**
   - 连接到目标服务器（如 10.88.43.154）
   - 选择目标数据库（如 DCCT_BPS_Debug）

2. **执行初始建表脚本**
   ```
   文件: SQLSERVER_SCHEMA.sql
   内容: 创建 10 个业务表 + 2 个认证表 + 4 个视图 + 初始数据
   结果: 12 个表，4 个视图
   ```

3. **验证初始表创建**
   ```sql
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
   WHERE TABLE_TYPE='BASE TABLE' 
   ORDER BY TABLE_NAME;
   ```
   应该看到 10-12 个表（取决于脚本版本）

---

### 阶段 2️⃣: 修正表结构差异（约 5 分钟）

4. **执行表结构修正脚本**
   ```
   文件: SQLSERVER_SCHEMA_修正.sql
   内容: 
     - 修正 1: employees 添加 4 个字段
     - 修正 2: 创建 resource_task_types 表（完整表）
     - 修正 3: 重建 competency_definitions 表
     - 修正 4: 重建 resource_planning_tasks 表
     - 修正 5: 重建 schedule_change_notifications 表
     - 修正 6: tasks 添加字段并修改类型
     - 修正 7: 创建 view_resource_planning_latest 视图
   结果: 13 个表，5 个视图，完全匹配 Supabase
   ```

5. **补充认证表（如果缺失）**
   ```
   文件: SQLSERVER_补充认证表.sql
   内容: 检查并创建 users 和 otp_tokens 表
   ```

6. **验证最终表结构**
   ```sql
   -- 查询所有表
   SELECT TABLE_NAME, 
          (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = t.TABLE_NAME) AS column_count
   FROM INFORMATION_SCHEMA.TABLES t
   WHERE TABLE_TYPE='BASE TABLE'
   ORDER BY TABLE_NAME;
   
   -- 查询所有视图
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS
   ORDER BY TABLE_NAME;
   ```
   
   **预期结果**:
   - **13 个表**: competency_assessments, competency_definitions, departments, employees, factories, otp_tokens, resource_planning_tasks, resource_task_types, schedule_change_notifications, skills, task_types, tasks, users
   - **5 个视图**: view_assessments_full, view_department_gaps, view_employee_gaps, view_resource_planning_latest, view_skill_gaps

---

### 阶段 3️⃣: 导出 Supabase 数据（约 15 分钟）

7. **登录 Supabase Dashboard**
   - 访问: https://supabase.com/dashboard
   - 进入项目: BPS 项目

8. **按顺序导出 CSV 文件**（遵循外键依赖顺序）

   **第一批（无外键依赖，6 个表）**:
   - ✅ departments（14 行）→ `departments.csv`
   - ✅ factories（9 行）→ `factories.csv`
   - ✅ task_types（8 行）→ `task_types.csv`
   - ✅ resource_task_types（11 行）→ `resource_task_types.csv`
   - ✅ skills（104 行）→ `skills.csv`
   - ✅ competency_definitions（39 行）→ `competency_definitions.csv`

   **第二批（依赖第一批，1 个表）**:
   - ✅ employees（18 行）→ `employees.csv`
     依赖: departments.id, factories.id

   **第三批（依赖第二批，4 个表）**:
   - ✅ competency_assessments（375 行）→ `competency_assessments.csv`
     依赖: employees.id, skills.id, competency_definitions.id
   - ✅ tasks（15 行）→ `tasks.csv`
     依赖: task_types.id, employees.id
   - ✅ resource_planning_tasks（2411 行）→ `resource_planning_tasks.csv`
     依赖: employees.id
   - ✅ schedule_change_notifications（9 行）→ `schedule_change_notifications.csv`
     依赖: employees.id, tasks.id

   **导出操作**:
   - Table Editor → 选择表 → "Export to CSV"
   - 确保 CSV 包含所有列，包括 id, created_at, updated_at

---

### 阶段 4️⃣: 导入数据到 SQL Server（约 20 分钟）

9. **导入第一批数据（无外键依赖）**

   **departments（需手动指定 ID）**:
   ```sql
   SET IDENTITY_INSERT dbo.departments ON;
   -- 导入 CSV（SSMS: 右键表 → Tasks → Import Data）
   SET IDENTITY_INSERT dbo.departments OFF;
   ```

   **skills（需手动指定 ID）**:
   ```sql
   SET IDENTITY_INSERT dbo.skills ON;
   -- 导入 CSV
   SET IDENTITY_INSERT dbo.skills OFF;
   ```

   **resource_task_types（需手动指定 ID）**:
   ```sql
   SET IDENTITY_INSERT dbo.resource_task_types ON;
   -- 导入 CSV
   SET IDENTITY_INSERT dbo.resource_task_types OFF;
   ```

   **factories, task_types, competency_definitions**:
   - 直接导入 CSV（SSMS Import Wizard 或 BULK INSERT）

10. **导入第二批数据**
    - ✅ employees.csv
    - 注意: skill_ids 字段是 ARRAY，需转换为 JSON 字符串格式

11. **导入第三批数据**
    - ✅ competency_assessments.csv
    - ✅ tasks.csv（注意 time_slot, required_skills 字段格式）
    - ✅ resource_planning_tasks.csv
    - ✅ schedule_change_notifications.csv

---

### 阶段 5️⃣: 验证数据完整性（约 5 分钟）

12. **验证行数**
    ```sql
    SELECT 'departments' AS table_name, COUNT(*) AS row_count FROM dbo.departments
    UNION ALL SELECT 'employees', COUNT(*) FROM dbo.employees
    UNION ALL SELECT 'factories', COUNT(*) FROM dbo.factories
    UNION ALL SELECT 'task_types', COUNT(*) FROM dbo.task_types
    UNION ALL SELECT 'resource_task_types', COUNT(*) FROM dbo.resource_task_types
    UNION ALL SELECT 'skills', COUNT(*) FROM dbo.skills
    UNION ALL SELECT 'competency_definitions', COUNT(*) FROM dbo.competency_definitions
    UNION ALL SELECT 'competency_assessments', COUNT(*) FROM dbo.competency_assessments
    UNION ALL SELECT 'tasks', COUNT(*) FROM dbo.tasks
    UNION ALL SELECT 'resource_planning_tasks', COUNT(*) FROM dbo.resource_planning_tasks
    UNION ALL SELECT 'schedule_change_notifications', COUNT(*) FROM dbo.schedule_change_notifications
    ORDER BY table_name;
    ```

    **预期结果**:
    | table_name | row_count |
    |------------|-----------|
    | competency_assessments | 375 |
    | competency_definitions | 39 |
    | departments | 14 |
    | employees | 18 |
    | factories | 9 |
    | resource_planning_tasks | 2411 |
    | resource_task_types | 11 |
    | schedule_change_notifications | 9 |
    | skills | 104 |
    | task_types | 8 |
    | tasks | 15 |
    | **总计** | **3013** |

13. **验证外键关系**
    ```sql
    -- 检查孤立记录（外键不存在）
    SELECT 'employees' AS table_name, COUNT(*) AS orphan_count
    FROM dbo.employees e
    WHERE NOT EXISTS (SELECT 1 FROM dbo.departments d WHERE d.id = e.department_id)
    UNION ALL
    SELECT 'competency_assessments', COUNT(*)
    FROM dbo.competency_assessments ca
    WHERE NOT EXISTS (SELECT 1 FROM dbo.employees e WHERE e.id = ca.employee_id);
    ```
    应该所有结果都是 0。

14. **验证视图可用性**
    ```sql
    SELECT COUNT(*) FROM dbo.view_assessments_full;
    SELECT COUNT(*) FROM dbo.view_department_gaps;
    SELECT COUNT(*) FROM dbo.view_employee_gaps;
    SELECT COUNT(*) FROM dbo.view_skill_gaps;
    SELECT COUNT(*) FROM dbo.view_resource_planning_latest;
    ```
    所有视图都应成功返回结果。

---

## 执行脚本说明

### 脚本清单及执行顺序

| 顺序 | 脚本文件名 | 用途 | 执行时机 | 预计时长 |
|------|-----------|------|---------|----------|
| 1 | `SQLSERVER_SCHEMA.sql` | 创建初始表结构（10-12 表 + 4 视图） | 首次迁移 | 2 分钟 |
| 2 | `SQLSERVER_SCHEMA_修正.sql` | 修正所有字段差异，创建缺失表和视图 | 初始表创建后 | 3 分钟 |
| 3 | `SQLSERVER_补充认证表.sql` | 补充创建 users 和 otp_tokens（如缺失） | 修正脚本执行后 | 1 分钟 |

### 脚本详细说明

#### 1. SQLSERVER_SCHEMA.sql

**包含内容**:
- ✅ 删除旧表语句（IF EXISTS）
- ✅ 创建 users 表（8 字段）
- ✅ 创建 otp_tokens 表（8 字段）
- ✅ 创建 departments 表（7 字段）
- ✅ 创建 factories 表（7 字段）
- ✅ 创建 task_types 表（8 字段）
- ✅ 创建 skills 表（7 字段）
- ✅ 创建 employees 表（**11 字段，缺少 4 个**）
- ✅ 创建 competency_definitions 表（**8 字段，字段名错误**）
- ✅ 创建 competency_assessments 表（10 字段）
- ✅ 创建 tasks 表（**14 字段，缺少 1 个**）
- ✅ 创建 resource_planning_tasks 表（**15 字段，缺少 5 个**）
- ❌ **缺少**: resource_task_types 表（完全缺失）
- ❌ **缺少**: schedule_change_notifications 表（完全缺失）
- ✅ 创建 4 个视图（缺少 view_resource_planning_latest）
- ✅ 插入初始数据（部门、工厂、任务类型、技能）

**问题汇总**:
- 缺少 2 个表：resource_task_types, schedule_change_notifications
- 字段差异：employees（4 个字段），competency_definitions（字段名+2字段），resource_planning_tasks（5 个字段），tasks（1 个字段）
- 缺少 1 个视图：view_resource_planning_latest

---

#### 2. SQLSERVER_SCHEMA_修正.sql ⭐

**核心修正内容**:

```sql
-- 修正 1: employees 表 - 添加 4 个缺失字段
ALTER TABLE dbo.employees ADD role NVARCHAR(50) DEFAULT 'BPS_ENGINEER';
ALTER TABLE dbo.employees ADD phone NVARCHAR(50);
ALTER TABLE dbo.employees ADD last_login_at DATETIME2;
ALTER TABLE dbo.employees ADD login_count INT DEFAULT 0;

-- 修正 2: 创建 resource_task_types 表（完全缺失）
DROP TABLE IF EXISTS dbo.resource_task_types;
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

-- 修正 3: competency_definitions 表 - 删除重建（字段名错误）
DROP TABLE dbo.competency_definitions;
CREATE TABLE dbo.competency_definitions (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  module_id INT NOT NULL,
  module_name NVARCHAR(MAX) NOT NULL,
  competency_type NVARCHAR(MAX) NOT NULL,  -- ⚠️ 不是 competency_name
  competency_code NVARCHAR(50),
  description NVARCHAR(MAX),
  owner_engineer NVARCHAR(MAX),             -- ⚠️ 新增
  is_key_competency BIT DEFAULT 0,          -- ⚠️ 新增
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE()
);

-- 修正 4: resource_planning_tasks 表 - 删除重建（字段差异太大）
DROP TABLE dbo.resource_planning_tasks;
CREATE TABLE dbo.resource_planning_tasks (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  employee_id UNIQUEIDENTIFIER NOT NULL,
  task_type_code NVARCHAR(50),
  start_week NVARCHAR(20),
  end_week NVARCHAR(20),
  start_date DATE,
  end_date DATE,
  topic NVARCHAR(MAX),                      -- ⚠️ 不是 task_topic
  location NVARCHAR(255),                   -- ⚠️ 不是 task_location
  notes NVARCHAR(MAX),
  imported_at DATETIME2 DEFAULT GETDATE(),
  import_batch_id UNIQUEIDENTIFIER,
  source_file_name NVARCHAR(500),
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE(),
  task_date DATE,                           -- ⚠️ 新增
  year_month NVARCHAR(10),                  -- ⚠️ 新增
  cw_week NVARCHAR(10),                     -- ⚠️ 新增
  day_of_month INT,                         -- ⚠️ 新增
  task_type NVARCHAR(100),                  -- ⚠️ 新增
  CONSTRAINT fk_resource_tasks_employee FOREIGN KEY (employee_id) 
    REFERENCES dbo.employees(id) ON DELETE CASCADE
);

-- 修正 5: schedule_change_notifications 表 - 删除重建（所有字段名错误）
DROP TABLE IF EXISTS dbo.schedule_change_notifications;
CREATE TABLE dbo.schedule_change_notifications (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  task_id UNIQUEIDENTIFIER,
  affected_employee_id UNIQUEIDENTIFIER NOT NULL,    -- ⚠️ 不是 employee_id
  modified_by_employee_id UNIQUEIDENTIFIER NOT NULL, -- ⚠️ 不是 changed_by_employee_id
  notification_type NVARCHAR(50) NOT NULL,           -- ⚠️ 不是 change_type
  change_description NVARCHAR(MAX),                  -- ⚠️ 不是 description
  is_read BIT DEFAULT 0,                             -- ⚠️ 不是 notification_status
  created_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_schedule_notif_affected_emp FOREIGN KEY (affected_employee_id) 
    REFERENCES dbo.employees(id) ON DELETE NO ACTION,
  CONSTRAINT fk_schedule_notif_modified_emp FOREIGN KEY (modified_by_employee_id) 
    REFERENCES dbo.employees(id) ON DELETE NO ACTION,
  CONSTRAINT fk_schedule_notif_task FOREIGN KEY (task_id) 
    REFERENCES dbo.tasks(id) ON DELETE CASCADE
);

-- 修正 6: tasks 表 - 添加 time_slot 字段，修改数值类型
ALTER TABLE dbo.tasks ADD time_slot NVARCHAR(50) DEFAULT 'FULL_DAY';
ALTER TABLE dbo.tasks ALTER COLUMN hours_per_day DECIMAL(10,2);
ALTER TABLE dbo.tasks ALTER COLUMN total_hours DECIMAL(10,2);

-- 修正 7: 创建 view_resource_planning_latest 视图（缺失）
CREATE VIEW dbo.view_resource_planning_latest AS
SELECT
  rpt.id, rpt.employee_id,
  e.employee_id AS employee_code, e.name AS employee_name,
  e.department_id, d.name AS department_name,
  rpt.task_type_code, rpt.task_type, rpt.topic, rpt.location,
  rpt.task_date, rpt.year_month, rpt.cw_week, rpt.day_of_month,
  rpt.start_date, rpt.end_date, rpt.notes, rpt.created_at
FROM dbo.resource_planning_tasks rpt
LEFT JOIN dbo.employees e ON rpt.employee_id = e.id
LEFT JOIN dbo.departments d ON e.department_id = d.id
WHERE e.is_active = 1;
```

**执行结果**:
- ✅ 13 个表（完全匹配 Supabase 11 个业务表 + 2 个认证表）
- ✅ 5 个视图（完全匹配 Supabase）
- ✅ 字段 100% 匹配

---

#### 3. SQLSERVER_补充认证表.sql

**用途**: 兜底脚本，确保认证表存在。

**包含内容**:
- 检查并创建 users 表（IF NOT EXISTS）
- 检查并创建 otp_tokens 表（IF NOT EXISTS）
- 验证查询（列出所有表）

**执行时机**: 
- 如果执行 `SQLSERVER_SCHEMA.sql` 后没有 users 和 otp_tokens，执行此脚本
- 或者作为保险措施，每次迁移都执行一遍

---

## 验证检查清单

### ✅ 表结构验证

- [ ] **表数量**: 13 个表
  ```sql
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';
  -- 预期: 13
  ```

- [ ] **视图数量**: 5 个视图
  ```sql
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.VIEWS;
  -- 预期: 5
  ```

- [ ] **关键表存在**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_NAME IN ('resource_task_types', 'schedule_change_notifications', 'users', 'otp_tokens')
  ORDER BY TABLE_NAME;
  -- 预期: 4 行结果
  ```

- [ ] **关键视图存在**:
  ```sql
  SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS 
  WHERE TABLE_NAME = 'view_resource_planning_latest';
  -- 预期: 1 行结果
  ```

---

### ✅ 字段验证

- [ ] **employees 表字段**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'employees' AND COLUMN_NAME IN ('role', 'phone', 'last_login_at', 'login_count');
  -- 预期: 4 行结果
  ```

- [ ] **competency_definitions 表字段**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'competency_definitions' 
    AND COLUMN_NAME IN ('competency_type', 'owner_engineer', 'is_key_competency');
  -- 预期: 3 行结果
  ```

- [ ] **resource_planning_tasks 表字段**:
  ```sql
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'resource_planning_tasks' 
    AND COLUMN_NAME IN ('topic', 'location', 'task_date', 'year_month', 'cw_week', 'day_of_month', 'task_type');
  -- 预期: 7 行结果
  ```

- [ ] **tasks 表字段**:
  ```sql
  SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'tasks' 
    AND COLUMN_NAME IN ('time_slot', 'hours_per_day', 'total_hours');
  -- 预期: 3 行，hours_per_day 和 total_hours 类型为 decimal
  ```

---

### ✅ 数据验证

- [ ] **总行数**: 3013 行
  ```sql
  SELECT SUM(row_count) AS total_rows FROM (
    SELECT COUNT(*) AS row_count FROM dbo.departments
    UNION ALL SELECT COUNT(*) FROM dbo.employees
    UNION ALL SELECT COUNT(*) FROM dbo.factories
    UNION ALL SELECT COUNT(*) FROM dbo.task_types
    UNION ALL SELECT COUNT(*) FROM dbo.resource_task_types
    UNION ALL SELECT COUNT(*) FROM dbo.skills
    UNION ALL SELECT COUNT(*) FROM dbo.competency_definitions
    UNION ALL SELECT COUNT(*) FROM dbo.competency_assessments
    UNION ALL SELECT COUNT(*) FROM dbo.tasks
    UNION ALL SELECT COUNT(*) FROM dbo.resource_planning_tasks
    UNION ALL SELECT COUNT(*) FROM dbo.schedule_change_notifications
  ) AS counts;
  -- 预期: 3013
  ```

- [ ] **外键完整性**: 无孤立记录
  ```sql
  -- 检查 employees 的外键
  SELECT COUNT(*) FROM dbo.employees e
  WHERE e.department_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM dbo.departments d WHERE d.id = e.department_id);
  -- 预期: 0
  ```

- [ ] **视图可查询**:
  ```sql
  SELECT COUNT(*) FROM dbo.view_resource_planning_latest;
  -- 预期: > 0，不报错
  ```

---

## 常见问题与注意事项

### ❓ 问题 1: 执行修正脚本后只看到 10-11 个表，缺少 resource_task_types

**原因**: 
- `SQLSERVER_SCHEMA.sql` 初始脚本不包含 `resource_task_types` 表
- 只有 `SQLSERVER_SCHEMA_修正.sql` 才会创建此表

**解决方案**:
```sql
-- 手动创建 resource_task_types
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
```

或者重新执行完整的 `SQLSERVER_SCHEMA_修正.sql`。

---

### ❓ 问题 2: 缺少 users 和 otp_tokens 表

**原因**: 
- 可能只执行了修正脚本，没有执行初始脚本
- 或者初始脚本执行不完整

**解决方案**:
执行 `SQLSERVER_补充认证表.sql` 补充创建。

---

### ❓ 问题 3: 视图查询报错 "Invalid object name"

**原因**: 视图引用的表不存在或字段名不匹配。

**解决方案**:
1. 确保所有表都已创建且字段名正确
2. 删除旧视图并重新创建:
   ```sql
   DROP VIEW IF EXISTS dbo.view_resource_planning_latest;
   -- 然后执行 CREATE VIEW 语句
   ```

---

### ❓ 问题 4: CSV 导入时 UUID 格式错误

**问题描述**: 
SQL Server UNIQUEIDENTIFIER 要求格式为 `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`（带连字符）。

**解决方案**:
- Supabase 导出的 UUID 已经是正确格式，直接导入即可
- 如果格式不对，使用 Excel 或脚本批量添加连字符

---

### ❓ 问题 5: 导入 departments/skills/resource_task_types 时 ID 冲突

**原因**: 这些表的 ID 在 SQL Server 中是 IDENTITY（自增），但 Supabase 是手动指定的。

**解决方案**:
```sql
-- 导入前开启手动插入 ID
SET IDENTITY_INSERT dbo.departments ON;
-- 导入 CSV
-- 导入后关闭
SET IDENTITY_INSERT dbo.departments OFF;

-- 对 skills 和 resource_task_types 执行相同操作
```

---

### ❓ 问题 6: tasks 表的 required_skills 字段格式问题

**原因**: 
- Supabase 中是 ARRAY 类型（如 `{1, 2, 3}`）
- SQL Server 存储为 NVARCHAR(MAX)，需转换为 JSON 格式（如 `[1, 2, 3]`）

**解决方案**:
导入前使用 Excel 或脚本将 PostgreSQL 数组格式转换为 JSON 数组:
- `{1,2,3}` → `[1,2,3]`
- `{10,20}` → `[10,20]`

---

### ⚠️ 重要注意事项

1. **执行顺序不可颠倒**:
   - 必须先执行 `SQLSERVER_SCHEMA.sql`（创建基础表）
   - 再执行 `SQLSERVER_SCHEMA_修正.sql`（修正差异）
   - 最后执行 `SQLSERVER_补充认证表.sql`（补充缺失）

2. **外键依赖导入顺序**:
   - 第一批: 无外键依赖的表（departments, factories, task_types, resource_task_types, skills, competency_definitions）
   - 第二批: 依赖第一批的表（employees）
   - 第三批: 依赖第二批的表（competency_assessments, tasks, resource_planning_tasks, schedule_change_notifications）

3. **IDENTITY_INSERT 必须成对使用**:
   ```sql
   SET IDENTITY_INSERT dbo.table_name ON;
   -- 导入操作
   SET IDENTITY_INSERT dbo.table_name OFF;
   ```
   不关闭会影响后续插入操作。

4. **修正脚本会删除并重建部分表**:
   - `competency_definitions`
   - `resource_planning_tasks`
   - `schedule_change_notifications`
   
   这意味着如果这些表已有数据，执行修正脚本会**清空数据**。建议先备份或在空数据库上执行。

5. **字段名区分大小写**（取决于 SQL Server 配置）:
   - 如果排序规则（Collation）区分大小写，`competency_type` ≠ `Competency_Type`
   - 建议统一使用小写蛇形命名（snake_case）

6. **数组字段的处理**:
   - Supabase: ARRAY 类型（`{1, 2, 3}`）
   - SQL Server: NVARCHAR(MAX) 存储 JSON 数组（`[1, 2, 3]`）
   - 需要在应用层（FastAPI）进行 JSON 解析和序列化

7. **时区问题**:
   - Supabase: `timestamp with time zone`（带时区）
   - SQL Server: `DATETIME2`（不带时区，默认服务器时区）
   - 建议统一使用 UTC 时间存储

---

## 快速参考卡片

### 📊 表结构对比速查

| 表名 | Supabase 字段数 | SQL Server 字段数 | 关键差异 |
|------|----------------|------------------|----------|
| departments | 7 | 7 | ✅ 无差异（ID 不自增） |
| employees | **15** | 11 → **15** | ⚠️ 缺少 4 个字段 |
| factories | 7 | 7 | ✅ 无差异 |
| task_types | 8 | 8 | ✅ 无差异 |
| **resource_task_types** | **8** | **0 → 8** | ❌ **表完全缺失** |
| skills | 7 | 7 | ✅ 无差异（ID 不自增） |
| competency_definitions | **10** | 8 → **10** | ⚠️ 字段名错误+缺少 2 字段 |
| competency_assessments | 10 | 10 | ✅ 无差异 |
| tasks | **15** | 14 → **15** | ⚠️ 缺少 1 字段+类型错误 |
| resource_planning_tasks | **20** | 15 → **20** | ⚠️ 字段名错误+缺少 5 字段 |
| **schedule_change_notifications** | **8** | **0 → 8** | ❌ **表完全缺失**（或字段全错） |
| users (新增) | - | 8 | 🆕 替代 Supabase Auth |
| otp_tokens (新增) | - | 8 | 🆕 OTP 验证 |

---

### 🔧 快速命令速查

**验证表数量**:
```sql
SELECT COUNT(*) AS table_count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE';
-- 预期: 13
```

**验证视图数量**:
```sql
SELECT COUNT(*) AS view_count FROM INFORMATION_SCHEMA.VIEWS;
-- 预期: 5
```

**列出所有表和字段数**:
```sql
SELECT 
    t.TABLE_NAME,
    COUNT(c.COLUMN_NAME) AS column_count
FROM INFORMATION_SCHEMA.TABLES t
LEFT JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
WHERE t.TABLE_TYPE = 'BASE TABLE'
GROUP BY t.TABLE_NAME
ORDER BY t.TABLE_NAME;
```

**验证总行数**:
```sql
DECLARE @total INT = 0;
SELECT @total = @total + SUM(p.rows) 
FROM sys.partitions p
INNER JOIN sys.tables t ON p.object_id = t.object_id
WHERE p.index_id IN (0, 1);
SELECT @total AS total_rows;
-- 预期: 3013
```

**刷新 Object Explorer**:
- 右键 **Tables** → **Refresh**
- 或按 **F5**

---

### 📝 CSV 导入顺序速记

```
第一批（6 表，无外键）:
  departments → factories → task_types → resource_task_types → skills → competency_definitions

第二批（1 表）:
  employees (依赖 departments, factories)

第三批（4 表）:
  competency_assessments → tasks → resource_planning_tasks → schedule_change_notifications
```

**需要 IDENTITY_INSERT 的表**:
- ✅ departments
- ✅ skills
- ✅ resource_task_types

---

## 附录：完整字段清单

### A. Supabase 完整字段清单（CSV 导出时需包含）

#### departments
```
id, code, name, description, is_active, created_at, updated_at
```

#### employees
```
id, employee_id, name, email, department_id, factory_id, skill_ids, 
role, phone, hire_date, is_active, last_login_at, login_count, 
created_at, updated_at
```

#### factories
```
id, code, name, location, is_active, created_at, updated_at
```

#### task_types
```
id, code, name, color_hex, description, is_system, is_active, 
created_at, updated_at
```

#### resource_task_types
```
id, code, name, color_hex, description, is_active, 
created_at, updated_at
```

#### skills
```
id, skill_id, skill_name, category, description, is_active, 
created_at, updated_at
```

#### competency_definitions
```
id, module_id, module_name, competency_type, competency_code, 
description, owner_engineer, is_key_competency, 
created_at, updated_at
```

#### competency_assessments
```
id, employee_id, skill_id, competency_definition_id, level, 
assessed_at, assessed_by, notes, created_at, updated_at
```

#### tasks
```
id, task_name, task_type_id, assigned_employee_id, 
start_date, end_date, time_slot, hours_per_day, total_hours, 
priority, status, required_skills, description, 
created_at, updated_at
```

#### resource_planning_tasks
```
id, employee_id, task_type_code, start_week, end_week, 
start_date, end_date, topic, location, notes, 
imported_at, import_batch_id, source_file_name, 
created_at, updated_at, task_date, year_month, cw_week, 
day_of_month, task_type
```

#### schedule_change_notifications
```
id, task_id, affected_employee_id, modified_by_employee_id, 
notification_type, change_description, is_read, created_at
```

---

### B. SQL Server 完整表结构 SQL

详见 `SQLSERVER_SCHEMA.sql` 和 `SQLSERVER_SCHEMA_修正.sql` 文件。

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2026-01-29 | 初始版本，完整迁移指南 |

---

## 联系信息

如有问题，请参考以下文件：
- `SUPABASE_TO_SQLSERVER_MIGRATION_GUIDE.md`（总体迁移指南）
- `SUPABASE_SQLSERVER_对比报告.md`（详细字段对比）
- `完整对象对比.md`（对象清单对比）

---

**文档结束**
