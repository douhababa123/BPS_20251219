# SQL Server 数据导入操作指南

> **目标**: 将 Supabase 导出的 11 个表（3013 行）导入到 SQL Server  
> **预计时间**: 约 30-40 分钟  
> **工具**: SQL Server Management Studio (SSMS) 20  
> **前置条件**: 已执行 SQLSERVER_SCHEMA.sql 和 SQLSERVER_SCHEMA_修正.sql

---

## 📋 导入概览

### 导入顺序（严格按照外键依赖）

| 批次 | 表名 | 行数 | 导入方式 | 注意事项 |
|------|------|------|----------|----------|
| **第一批** | departments | 14 | IDENTITY_INSERT | ⚠️ 需手动指定 ID |
| | factories | 9 | 直接导入 | - |
| | task_types | 8 | 直接导入 | - |
| | resource_task_types | 11 | IDENTITY_INSERT | ⚠️ 需手动指定 ID |
| | skills | 104 | IDENTITY_INSERT | ⚠️ 需手动指定 ID |
| | competency_definitions | 39 | 直接导入 | - |
| **第二批** | employees | 18 | 直接导入 | 依赖 departments, factories |
| **第三批** | competency_assessments | 375 | 直接导入 | 依赖 employees, skills, competency_definitions |
| | tasks | 15 | 直接导入 | 依赖 task_types, employees |
| | resource_planning_tasks | 2411 | 直接导入 | 依赖 employees（数据量最大）|
| | schedule_change_notifications | 9 | 直接导入 | 依赖 employees, tasks |

---

## 🚀 第一步：准备工作

### 1. 打开 SQL Server Management Studio

1. 启动 **SSMS 20**
2. 连接到服务器: `10.88.43.154`
3. 登录信息:
   - 认证方式: SQL Server Authentication
   - 用户名: `TEST`
   - 密码: `123456`
4. 点击 **Connect**

### 2. 选择数据库

在 Object Explorer 中：
- 展开 **Databases**
- 右键点击 **DCCT_BPS_Debug**
- 选择 **"Set as Default Database"**

### 3. 验证表结构

执行以下 SQL 确保表结构正确：

```sql
USE DCCT_BPS_Debug;

-- 验证表数量（应该是 13 个）
SELECT COUNT(*) AS table_count 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE='BASE TABLE';

-- 列出所有表
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE='BASE TABLE' 
ORDER BY TABLE_NAME;
```

**预期结果**: 13 个表（11 个业务表 + users + otp_tokens）

---

## 📦 第二步：导入第一批数据（6 个表，185 行）

> ⚠️ **重要**: 这批表中，departments, resource_task_types, skills 需要手动指定 ID

---

### 1️⃣ 导入 departments（14 行）⚠️ 需 IDENTITY_INSERT

**步骤 A: 创建临时导入表**

```sql
USE DCCT_BPS_Debug;

-- 创建临时表
CREATE TABLE #temp_departments (
    id BIGINT,
    code NVARCHAR(50),
    name NVARCHAR(MAX),
    description NVARCHAR(MAX),
    is_active BIT,
    created_at DATETIME2,
    updated_at DATETIME2
);
```

**步骤 B: 使用 SSMS Import Wizard 导入到临时表**

1. 在 Object Explorer 中，右键点击 **DCCT_BPS_Debug** 数据库
2. 选择 **Tasks** → **Import Data**
3. **Choose a Data Source**:
   - Data source: **Flat File Source**
   - File name: 浏览到 `C:\Users\DOC2CHZ\Software\BPS_20251219\csv_data\departments.csv`
   - Text qualifier: `"` (双引号)
   - Header rows delimiter: `{CR}{LF}`
   - ✅ 勾选 **"Column names in the first data row"**
   - Code page: **65001 (UTF-8)**
   - 点击 **Next**

4. **Choose a Destination**:
   - Destination: **SQL Server Native Client 11.0**
   - Server name: `10.88.43.154`
   - Authentication: SQL Server Authentication
   - Username: `TEST`, Password: `123456`
   - Database: `DCCT_BPS_Debug`
   - 点击 **Next**

5. **Specify Table Copy or Query**:
   - 选择 **"Copy data from one or more tables or views"**
   - 点击 **Next**

6. **Configure Destination Table**:
   - Destination: `[dbo].[#temp_departments]`
   - 点击 **Edit Mappings** 按钮
   - 确保列映射正确（CSV 列 → 临时表列）
   - 如果 CSV 缺少某些列，在映射中设置为 `<ignore>`
   - 点击 **OK**

7. **Run Package**:
   - 点击 **Finish** 开始导入

8. 等待导入完成，应该显示 **14 rows transferred**

**步骤 C: 从临时表复制到正式表**

```sql
-- 开启 IDENTITY_INSERT
SET IDENTITY_INSERT dbo.departments ON;

-- 从临时表插入数据
INSERT INTO dbo.departments (id, code, name, description, is_active, created_at, updated_at)
SELECT id, code, name, description, is_active, created_at, updated_at
FROM #temp_departments;

-- 关闭 IDENTITY_INSERT
SET IDENTITY_INSERT dbo.departments OFF;

-- 删除临时表
DROP TABLE #temp_departments;

-- 验证
SELECT COUNT(*) AS row_count FROM dbo.departments;
-- 预期: 14
```

---

### 2️⃣ 导入 factories（9 行）

**步骤 A: 使用 SSMS Import Wizard**

1. 右键点击 **DCCT_BPS_Debug** → **Tasks** → **Import Data**
2. **Data Source**: Flat File Source
   - File: `csv_data\factories.csv`
   - ✅ Column names in the first row
   - Code page: 65001 (UTF-8)
3. **Destination**: SQL Server Native Client 11.0
   - Server: `10.88.43.154`
   - Database: `DCCT_BPS_Debug`
4. **Destination Table**: `[dbo].[factories]`
5. **Edit Mappings**: 确保列映射正确
   - `id` → `id` (BIGINT, IDENTITY)
   - `code` → `code`
   - `name` → `name`
   - `location` → `location`
   - `is_active` → `is_active`
   - `created_at` → `created_at`
   - `updated_at` → `updated_at`
6. 点击 **Finish** 执行导入

**步骤 B: 验证**

```sql
SELECT COUNT(*) AS row_count FROM dbo.factories;
-- 预期: 9
```

---

### 3️⃣ 导入 task_types（8 行）

**步骤 A: 使用 SSMS Import Wizard**

1. 右键点击 **DCCT_BPS_Debug** → **Tasks** → **Import Data**
2. **Data Source**: Flat File Source
   - File: `csv_data\task_types.csv`
   - ✅ Column names in the first row
   - Code page: 65001 (UTF-8)
3. **Destination Table**: `[dbo].[task_types]`
4. **Edit Mappings**: 确保所有列映射正确
   - CSV 字段: `id, code, name, color_hex, description, is_system, is_active, created_at, updated_at`
5. 点击 **Finish** 执行导入

**步骤 B: 验证**

```sql
SELECT COUNT(*) AS row_count FROM dbo.task_types;
-- 预期: 8
```

---

### 4️⃣ 导入 resource_task_types（11 行）⚠️ 需 IDENTITY_INSERT

**步骤 A: 创建临时表**

```sql
CREATE TABLE #temp_resource_task_types (
    id BIGINT,
    code NVARCHAR(50),
    name NVARCHAR(MAX),
    color_hex NVARCHAR(50),
    description NVARCHAR(MAX),
    is_active BIT,
    created_at DATETIME2,
    updated_at DATETIME2
);
```

**步骤 B: 导入到临时表**

使用 SSMS Import Wizard 导入 `csv_data\resource_task_types.csv` 到 `#temp_resource_task_types`

**步骤 C: 从临时表复制到正式表**

```sql
SET IDENTITY_INSERT dbo.resource_task_types ON;

INSERT INTO dbo.resource_task_types (id, code, name, color_hex, description, is_active, created_at, updated_at)
SELECT id, code, name, color_hex, description, is_active, created_at, updated_at
FROM #temp_resource_task_types;

SET IDENTITY_INSERT dbo.resource_task_types OFF;

DROP TABLE #temp_resource_task_types;

-- 验证
SELECT COUNT(*) AS row_count FROM dbo.resource_task_types;
-- 预期: 11
```

---

### 5️⃣ 导入 skills（104 行）⚠️ 需 IDENTITY_INSERT

**步骤 A: 创建临时表**

```sql
CREATE TABLE #temp_skills (
    id BIGINT,
    skill_id NVARCHAR(50),
    skill_name NVARCHAR(MAX),
    category NVARCHAR(MAX),
    description NVARCHAR(MAX),
    is_active BIT,
    created_at DATETIME2,
    updated_at DATETIME2
);
```

**步骤 B: 导入到临时表**

使用 SSMS Import Wizard 导入 `csv_data\skills.csv` 到 `#temp_skills`

**步骤 C: 从临时表复制到正式表**

```sql
SET IDENTITY_INSERT dbo.skills ON;

INSERT INTO dbo.skills (id, skill_id, skill_name, category, description, is_active, created_at, updated_at)
SELECT id, skill_id, skill_name, category, description, is_active, created_at, updated_at
FROM #temp_skills;

SET IDENTITY_INSERT dbo.skills OFF;

DROP TABLE #temp_skills;

-- 验证
SELECT COUNT(*) AS row_count FROM dbo.skills;
-- 预期: 104
```

---

### 6️⃣ 导入 competency_definitions（39 行）

**步骤 A: 使用 SSMS Import Wizard**

1. 导入 `csv_data\competency_definitions.csv` 到 `[dbo].[competency_definitions]`
2. **重要字段映射**:
   - `id` → `id` (自增，自动生成)
   - `module_id` → `module_id`
   - `module_name` → `module_name`
   - `competency_type` → `competency_type` (⚠️ 不是 competency_name)
   - `competency_code` → `competency_code`
   - `description` → `description`
   - `owner_engineer` → `owner_engineer`
   - `is_key_competency` → `is_key_competency`
   - `created_at` → `created_at`
   - `updated_at` → `updated_at`

**步骤 B: 验证**

```sql
SELECT COUNT(*) AS row_count FROM dbo.competency_definitions;
-- 预期: 39
```

---

### ✅ 第一批导入完成验证

```sql
-- 验证第一批所有表的行数
SELECT 'departments' AS table_name, COUNT(*) AS row_count FROM dbo.departments
UNION ALL SELECT 'factories', COUNT(*) FROM dbo.factories
UNION ALL SELECT 'task_types', COUNT(*) FROM dbo.task_types
UNION ALL SELECT 'resource_task_types', COUNT(*) FROM dbo.resource_task_types
UNION ALL SELECT 'skills', COUNT(*) FROM dbo.skills
UNION ALL SELECT 'competency_definitions', COUNT(*) FROM dbo.competency_definitions
ORDER BY table_name;
```

**预期结果**:
```
competency_definitions    39
departments               14
factories                  9
resource_task_types       11
skills                   104
task_types                 8
总计:                    185
```

---

## 👥 第三步：导入第二批数据（1 个表，18 行）

### 7️⃣ 导入 employees（18 行）

**注意事项**:
- ⚠️ CSV 文件中的字段可能与 SQL Server 表不完全匹配
- 缺少的字段在导入时设置为 NULL 或默认值

**步骤 A: 检查 CSV 字段**

查看 `employees.csv` 第一行（表头）：
```
id,employee_id,name,department_id,email,position,is_active,created_at,updated_at,role,auth_user_id,phone,last_login_at,login_count
```

**步骤 B: 使用 SSMS Import Wizard**

1. 导入 `csv_data\employees.csv` 到 `[dbo].[employees]`
2. **字段映射** (Edit Mappings):
   - CSV `id` → SQL `id` (UNIQUEIDENTIFIER)
   - CSV `employee_id` → SQL `employee_id`
   - CSV `name` → SQL `name`
   - CSV `department_id` → SQL `department_id`
   - CSV `email` → SQL `email`
   - CSV `position` → SQL `position` (如果 SQL 中没有此字段，忽略)
   - CSV `is_active` → SQL `is_active`
   - CSV `role` → SQL `role`
   - CSV `phone` → SQL `phone`
   - CSV `last_login_at` → SQL `last_login_at`
   - CSV `login_count` → SQL `login_count`
   - CSV `created_at` → SQL `created_at`
   - CSV `updated_at` → SQL `updated_at`
   
   **缺少的 SQL 字段**（设置为 NULL）:
   - `factory_id` → NULL
   - `skill_ids` → NULL
   - `hire_date` → NULL

3. 点击 **Finish** 执行导入

**步骤 C: 验证**

```sql
SELECT COUNT(*) AS row_count FROM dbo.employees;
-- 预期: 18

-- 检查外键完整性
SELECT COUNT(*) FROM dbo.employees e
WHERE e.department_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM dbo.departments d WHERE d.id = e.department_id);
-- 预期: 0 (无孤立记录)
```

---

## 📊 第四步：导入第三批数据（4 个表，2810 行）

> ⚠️ **依赖关系**: 所有表都依赖 employees 表

---

### 8️⃣ 导入 competency_assessments（375 行）

**步骤 A: 使用 SSMS Import Wizard**

1. 导入 `csv_data\competency_assessments.csv` 到 `[dbo].[competency_assessments]`
2. **字段映射**:
   - `id` → `id` (自增)
   - `employee_id` → `employee_id` (UNIQUEIDENTIFIER)
   - `skill_id` → `skill_id` (BIGINT)
   - `competency_definition_id` → `competency_definition_id` (BIGINT)
   - `level` → `level` (INT)
   - `assessed_at` → `assessed_at`
   - `assessed_by` → `assessed_by`
   - `notes` → `notes`
   - `created_at` → `created_at`
   - `updated_at` → `updated_at`

**步骤 B: 验证**

```sql
SELECT COUNT(*) AS row_count FROM dbo.competency_assessments;
-- 预期: 375
```

---

### 9️⃣ 导入 tasks（15 行）

**注意**: CSV 字段名可能与 SQL Server 不完全匹配

**步骤 A: 检查 CSV 字段**

查看 `tasks.csv` 表头：
```
id,task_name,task_type,task_location,assigned_employee_id,start_date,end_date,
days_count,hours_per_day,total_hours,source,status,is_cross_factory,
request_factory,required_skills,notes,created_at,updated_at,time_slot
```

**步骤 B: 字段映射问题**

| CSV 字段 | SQL Server 字段 | 说明 |
|----------|----------------|------|
| task_type | ❌ task_type_id | CSV 是字符串，SQL 需要 INT（外键） |
| task_location | ✅ (可能没有此字段) | 忽略或映射到 description |
| required_skills | ✅ required_skills | 数组字段，需要 JSON 格式 |

**步骤 C: 使用临时表处理**

```sql
-- 创建临时表（匹配 CSV 结构）
CREATE TABLE #temp_tasks (
    id UNIQUEIDENTIFIER,
    task_name NVARCHAR(MAX),
    task_type NVARCHAR(50),  -- CSV 中是字符串
    task_location NVARCHAR(255),
    assigned_employee_id UNIQUEIDENTIFIER,
    start_date DATE,
    end_date DATE,
    days_count INT,
    hours_per_day DECIMAL(10,2),
    total_hours DECIMAL(10,2),
    source NVARCHAR(50),
    status NVARCHAR(50),
    is_cross_factory BIT,
    request_factory NVARCHAR(100),
    required_skills NVARCHAR(MAX),
    notes NVARCHAR(MAX),
    created_at DATETIME2,
    updated_at DATETIME2,
    time_slot NVARCHAR(50)
);
```

**步骤 D: 导入到临时表**

使用 SSMS Import Wizard 导入 `csv_data\tasks.csv` 到 `#temp_tasks`

**步骤 E: 转换后插入到正式表**

```sql
-- 将 task_type 字符串转换为 task_type_id
-- 假设 task_type 是 task_types 表中的 code 或 name
INSERT INTO dbo.tasks (
    id, task_name, task_type_id, assigned_employee_id, 
    start_date, end_date, time_slot, hours_per_day, total_hours,
    priority, status, required_skills, description, 
    created_at, updated_at
)
SELECT 
    t.id,
    t.task_name,
    tt.id AS task_type_id,  -- 从 task_types 表匹配
    t.assigned_employee_id,
    t.start_date,
    t.end_date,
    t.time_slot,
    t.hours_per_day,
    t.total_hours,
    3 AS priority,  -- 默认优先级
    t.status,
    t.required_skills,
    CONCAT(ISNULL(t.notes, ''), ' ', ISNULL(t.task_location, '')) AS description,
    t.created_at,
    t.updated_at
FROM #temp_tasks t
LEFT JOIN dbo.task_types tt ON t.task_type = tt.name OR t.task_type = tt.code;

DROP TABLE #temp_tasks;

-- 验证
SELECT COUNT(*) AS row_count FROM dbo.tasks;
-- 预期: 15
```

---

### 🔟 导入 resource_planning_tasks（2411 行）⭐ 最大表

**步骤 A: 使用 SSMS Import Wizard**

1. 导入 `csv_data\resource_planning_tasks.csv` 到 `[dbo].[resource_planning_tasks]`
2. **字段映射**（20 个字段）:
   - `id` → `id` (自增)
   - `employee_id` → `employee_id`
   - `task_type_code` → `task_type_code`
   - `start_week` → `start_week`
   - `end_week` → `end_week`
   - `start_date` → `start_date`
   - `end_date` → `end_date`
   - `topic` → `topic`
   - `location` → `location`
   - `notes` → `notes`
   - `imported_at` → `imported_at`
   - `import_batch_id` → `import_batch_id`
   - `source_file_name` → `source_file_name`
   - `created_at` → `created_at`
   - `updated_at` → `updated_at`
   - `task_date` → `task_date`
   - `year_month` → `year_month`
   - `cw_week` → `cw_week`
   - `day_of_month` → `day_of_month`
   - `task_type` → `task_type`

3. ⏱️ **数据量较大**，导入可能需要 1-2 分钟

**步骤 B: 验证**

```sql
SELECT COUNT(*) AS row_count FROM dbo.resource_planning_tasks;
-- 预期: 2411
```

---

### 1️⃣1️⃣ 导入 schedule_change_notifications（9 行）

**步骤 A: 使用 SSMS Import Wizard**

1. 导入 `csv_data\schedule_change_notifications.csv` 到 `[dbo].[schedule_change_notifications]`
2. **字段映射**:
   - `id` → `id` (UNIQUEIDENTIFIER)
   - `task_id` → `task_id`
   - `affected_employee_id` → `affected_employee_id`
   - `modified_by_employee_id` → `modified_by_employee_id`
   - `notification_type` → `notification_type`
   - `change_description` → `change_description`
   - `is_read` → `is_read`
   - `created_at` → `created_at`

**步骤 B: 验证**

```sql
SELECT COUNT(*) AS row_count FROM dbo.schedule_change_notifications;
-- 预期: 9
```

---

## ✅ 第五步：最终验证

### 1. 验证所有表的行数

```sql
USE DCCT_BPS_Debug;

SELECT 'departments' AS table_name, COUNT(*) AS row_count FROM dbo.departments
UNION ALL SELECT 'factories', COUNT(*) FROM dbo.factories
UNION ALL SELECT 'task_types', COUNT(*) FROM dbo.task_types
UNION ALL SELECT 'resource_task_types', COUNT(*) FROM dbo.resource_task_types
UNION ALL SELECT 'skills', COUNT(*) FROM dbo.skills
UNION ALL SELECT 'competency_definitions', COUNT(*) FROM dbo.competency_definitions
UNION ALL SELECT 'employees', COUNT(*) FROM dbo.employees
UNION ALL SELECT 'competency_assessments', COUNT(*) FROM dbo.competency_assessments
UNION ALL SELECT 'tasks', COUNT(*) FROM dbo.tasks
UNION ALL SELECT 'resource_planning_tasks', COUNT(*) FROM dbo.resource_planning_tasks
UNION ALL SELECT 'schedule_change_notifications', COUNT(*) FROM dbo.schedule_change_notifications
ORDER BY table_name;
```

**预期总行数: 3013**

---

### 2. 验证外键完整性

```sql
-- 检查 employees 的 department_id
SELECT 'employees→departments' AS relationship, COUNT(*) AS orphan_count
FROM dbo.employees e
WHERE e.department_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM dbo.departments d WHERE d.id = e.department_id)

UNION ALL

-- 检查 competency_assessments 的外键
SELECT 'competency_assessments→employees', COUNT(*)
FROM dbo.competency_assessments ca
WHERE NOT EXISTS (SELECT 1 FROM dbo.employees e WHERE e.id = ca.employee_id)

UNION ALL

SELECT 'competency_assessments→skills', COUNT(*)
FROM dbo.competency_assessments ca
WHERE NOT EXISTS (SELECT 1 FROM dbo.skills s WHERE s.id = ca.skill_id)

UNION ALL

-- 检查 tasks 的外键
SELECT 'tasks→employees', COUNT(*)
FROM dbo.tasks t
WHERE t.assigned_employee_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.employees e WHERE e.id = t.assigned_employee_id)

UNION ALL

-- 检查 resource_planning_tasks 的外键
SELECT 'resource_planning_tasks→employees', COUNT(*)
FROM dbo.resource_planning_tasks rpt
WHERE NOT EXISTS (SELECT 1 FROM dbo.employees e WHERE e.id = rpt.employee_id);
```

**预期**: 所有 orphan_count 都应该是 **0**

---

### 3. 验证视图可查询

```sql
-- 测试所有视图
SELECT COUNT(*) AS count_assessments FROM dbo.view_assessments_full;
SELECT COUNT(*) AS count_department_gaps FROM dbo.view_department_gaps;
SELECT COUNT(*) AS count_employee_gaps FROM dbo.view_employee_gaps;
SELECT COUNT(*) AS count_skill_gaps FROM dbo.view_skill_gaps;
SELECT COUNT(*) AS count_resource_planning FROM dbo.view_resource_planning_latest;
```

所有查询都应成功返回结果（不报错）

---

### 4. 生成验证报告

```sql
-- 完整验证报告
PRINT '========================================';
PRINT '数据导入验证报告';
PRINT '========================================';
PRINT '';

DECLARE @totalRows INT;
SELECT @totalRows = SUM(row_count) FROM (
    SELECT COUNT(*) AS row_count FROM dbo.departments
    UNION ALL SELECT COUNT(*) FROM dbo.factories
    UNION ALL SELECT COUNT(*) FROM dbo.task_types
    UNION ALL SELECT COUNT(*) FROM dbo.resource_task_types
    UNION ALL SELECT COUNT(*) FROM dbo.skills
    UNION ALL SELECT COUNT(*) FROM dbo.competency_definitions
    UNION ALL SELECT COUNT(*) FROM dbo.employees
    UNION ALL SELECT COUNT(*) FROM dbo.competency_assessments
    UNION ALL SELECT COUNT(*) FROM dbo.tasks
    UNION ALL SELECT COUNT(*) FROM dbo.resource_planning_tasks
    UNION ALL SELECT COUNT(*) FROM dbo.schedule_change_notifications
) AS counts;

PRINT '总行数: ' + CAST(@totalRows AS NVARCHAR(10));
PRINT '预期行数: 3013';

IF @totalRows = 3013
    PRINT '✅ 数据完整性检查通过！';
ELSE
    PRINT '⚠️ 数据行数不匹配！';

PRINT '';
PRINT '========================================';
```

---

## 🔧 常见问题与解决方案

### Q1: Import Wizard 提示 "Error converting data type"

**原因**: CSV 字段类型与 SQL Server 表字段类型不匹配

**解决方案**:
1. 在 Edit Mappings 中，检查 **Type** 列
2. 常见问题:
   - CSV 的 `true/false` → SQL Server `BIT` (应自动转换)
   - CSV 的空值 → SQL Server NOT NULL 字段（需要提供默认值）
3. 如果无法自动转换，使用临时表方法（参考 tasks 表导入）

---

### Q2: 导入时提示 "Cannot insert explicit value for identity column"

**原因**: 尝试向 IDENTITY 列插入数据，但未开启 IDENTITY_INSERT

**解决方案**:
- 使用临时表方法（参考 departments, skills, resource_task_types）
- 先导入到临时表，再用 `SET IDENTITY_INSERT ON` 复制到正式表

---

### Q3: 外键约束冲突 "FOREIGN KEY constraint failed"

**原因**: 导入顺序错误，子表先于父表导入

**解决方案**:
- 严格按照本指南的导入顺序执行
- 第一批 → 第二批 → 第三批

---

### Q4: CSV 文件包含特殊字符导致导入失败

**原因**: CSV 编码问题或字段中包含分隔符

**解决方案**:
1. 确保 CSV 编码为 **UTF-8 (with BOM)** 或 **UTF-8**
2. 在 Import Wizard 中设置 Code page: **65001 (UTF-8)**
3. 设置 Text qualifier: `"` (双引号)
4. 如果仍有问题，用 Excel 打开 CSV，另存为新的 CSV 文件

---

### Q5: UUID 格式不正确 "Conversion failed when converting from a character string to uniqueidentifier"

**原因**: UUID 格式不符合 SQL Server 要求

**解决方案**:
- SQL Server 要求格式: `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
- Supabase 导出的格式已经正确，无需处理
- 如果确实有问题，检查 CSV 中是否有空值（NULL）

---

### Q6: 导入速度很慢（特别是 resource_planning_tasks）

**原因**: 
- 数据量大（2411 行）
- 表有多个索引和外键

**解决方案**:
1. **临时禁用约束**（可选，仅当速度极慢时）:
   ```sql
   -- 禁用外键约束
   ALTER TABLE dbo.resource_planning_tasks NOCHECK CONSTRAINT ALL;
   
   -- 导入数据...
   
   -- 重新启用约束
   ALTER TABLE dbo.resource_planning_tasks CHECK CONSTRAINT ALL;
   ```

2. **使用 BULK INSERT**（高级方法）:
   ```sql
   BULK INSERT dbo.resource_planning_tasks
   FROM 'C:\Users\DOC2CHZ\Software\BPS_20251219\csv_data\resource_planning_tasks.csv'
   WITH (
       FIELDTERMINATOR = ',',
       ROWTERMINATOR = '\n',
       FIRSTROW = 2,  -- 跳过表头
       TABLOCK
   );
   ```

---

## 📝 导入清单（打印使用）

```
□ 第一批（6 个表，185 行）
  □ 1. departments (14 行) - IDENTITY_INSERT
  □ 2. factories (9 行)
  □ 3. task_types (8 行)
  □ 4. resource_task_types (11 行) - IDENTITY_INSERT
  □ 5. skills (104 行) - IDENTITY_INSERT
  □ 6. competency_definitions (39 行)

□ 第二批（1 个表，18 行）
  □ 7. employees (18 行)

□ 第三批（4 个表，2810 行）
  □ 8. competency_assessments (375 行)
  □ 9. tasks (15 行) - 需要临时表处理
  □ 10. resource_planning_tasks (2411 行) - 最大表
  □ 11. schedule_change_notifications (9 行)

□ 验证
  □ 总行数 = 3013
  □ 外键完整性检查通过
  □ 所有视图可查询
```

---

## 🎯 下一步

导入完成后：

1. **✅ 数据迁移完成**
2. **搭建 FastAPI 后端**（参考 SUPABASE_TO_SQLSERVER_MIGRATION_GUIDE.md）
3. **前端改造**（替换 Supabase SDK 为 HTTP 请求）
4. **端到端测试**

---

**祝导入顺利！🚀**
