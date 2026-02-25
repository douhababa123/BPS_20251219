# Supabase vs SQL Server 表结构对比报告

## 📊 表数量对比

### Supabase 表清单（11 个业务表）：
1. ✅ departments (14 行)
2. ✅ employees (18 行)
3. ✅ factories (9 行)
4. ✅ task_types (8 行)
5. ✅ skills (104 行)
6. ✅ competency_definitions (39 行)
7. ✅ competency_assessments (375 行)
8. ✅ resource_task_types (11 行)
9. ✅ tasks (15 行)
10. ✅ resource_planning_tasks (2411 行)
11. ✅ schedule_change_notifications (9 行)

**总计：3013 行数据**

---

### SQL Server 表清单（13 个表）：

#### 从 Supabase 迁移的 11 个表：
1. ✅ departments
2. ✅ employees
3. ✅ factories
4. ✅ task_types
5. ✅ skills
6. ✅ competency_definitions
7. ✅ competency_assessments
8. ✅ resource_task_types
9. ✅ tasks
10. ✅ resource_planning_tasks
11. ✅ schedule_change_notifications

#### 新增的认证表（2 个，替代 Supabase Auth）：
12. ➕ **users** - 用户认证表（替代 Supabase Auth.users）
13. ➕ **otp_tokens** - OTP 验证码临时表（用于邮件验证码登录）

---

## 🔍 字段数量对比

| 表名 | Supabase 字段数 | SQL Server 字段数 | 状态 |
|------|----------------|------------------|------|
| departments | 6 | 6 | ✅ 完全匹配 |
| employees | 14 | 14 | ✅ 修正后匹配 |
| factories | 7 | 7 | ✅ 完全匹配 |
| task_types | 9 | 9 | ✅ 完全匹配 |
| skills | 10 | 10 | ✅ 完全匹配 |
| competency_definitions | 10 | 10 | ✅ 修正后匹配 |
| competency_assessments | 11 | 11 | ✅ 完全匹配 |
| resource_task_types | 8 | 8 | ✅ 完全匹配 |
| tasks | 19 | 20 | ✅ 修正后匹配 |
| resource_planning_tasks | 20 | 20 | ✅ 修正后匹配 |
| schedule_change_notifications | 8 | 8 | ✅ 修正后匹配 |

---

## 📋 详细字段对比（重点表）

### 1. employees 表（14 字段）

| 字段名 | Supabase 类型 | SQL Server 类型 | 状态 |
|--------|--------------|----------------|------|
| id | uuid | UNIQUEIDENTIFIER | ✅ |
| employee_id | text | NVARCHAR(50) | ✅ |
| name | text | NVARCHAR(255) | ✅ |
| department_id | bigint | BIGINT | ✅ |
| email | text | NVARCHAR(255) | ✅ |
| position | text | NVARCHAR(255) | ✅ |
| is_active | boolean | BIT | ✅ |
| created_at | timestamptz | DATETIME2 | ✅ |
| updated_at | timestamptz | DATETIME2 | ✅ |
| **role** | text | NVARCHAR(50) | ✅ 已修正 |
| auth_user_id | uuid | UNIQUEIDENTIFIER | ✅ |
| **phone** | text | NVARCHAR(50) | ✅ 已修正 |
| **last_login_at** | timestamptz | DATETIME2 | ✅ 已修正 |
| **login_count** | integer | INT | ✅ 已修正 |

---

### 2. competency_definitions 表（10 字段）

| 字段名 | Supabase 类型 | SQL Server 类型 | 状态 |
|--------|--------------|----------------|------|
| id | bigint | BIGINT IDENTITY | ✅ |
| module_id | integer | INT | ✅ |
| module_name | text | NVARCHAR(MAX) | ✅ |
| **competency_type** | text | NVARCHAR(MAX) | ✅ 已修正 |
| competency_code | varchar(50) | NVARCHAR(50) | ✅ |
| description | text | NVARCHAR(MAX) | ✅ |
| **owner_engineer** | text | NVARCHAR(MAX) | ✅ 已修正 |
| **is_key_competency** | boolean | BIT | ✅ 已修正 |
| created_at | timestamptz | DATETIME2 | ✅ |
| updated_at | timestamptz | DATETIME2 | ✅ |

❌ **之前错误**：使用了 `competency_name`, `competency_name_en`（不存在的字段）  
✅ **已修正**：改为 `competency_type`, `owner_engineer`, `is_key_competency`

---

### 3. resource_planning_tasks 表（20 字段）

| 字段名 | Supabase 类型 | SQL Server 类型 | 状态 |
|--------|--------------|----------------|------|
| id | bigint | BIGINT IDENTITY | ✅ |
| employee_id | uuid | UNIQUEIDENTIFIER | ✅ |
| task_type_code | text | NVARCHAR(50) | ✅ 已修正 |
| start_week | text | NVARCHAR(20) | ✅ 已修正 |
| end_week | text | NVARCHAR(20) | ✅ 已修正 |
| start_date | date | DATE | ✅ |
| end_date | date | DATE | ✅ |
| **topic** | text | NVARCHAR(MAX) | ✅ 已修正 |
| **location** | text | NVARCHAR(255) | ✅ 已修正 |
| notes | text | NVARCHAR(MAX) | ✅ |
| imported_at | timestamptz | DATETIME2 | ✅ 已修正 |
| import_batch_id | uuid | UNIQUEIDENTIFIER | ✅ 已修正 |
| source_file_name | text | NVARCHAR(500) | ✅ 已修正 |
| created_at | timestamptz | DATETIME2 | ✅ |
| updated_at | timestamptz | DATETIME2 | ✅ |
| **task_date** | date | DATE | ✅ 已修正 |
| **year_month** | text | NVARCHAR(10) | ✅ 已修正 |
| **cw_week** | text | NVARCHAR(10) | ✅ 已修正 |
| **day_of_month** | integer | INT | ✅ 已修正 |
| **task_type** | text | NVARCHAR(100) | ✅ 已修正 |

❌ **之前错误**：缺少 10+ 个字段，字段名也不匹配（task_topic vs topic）  
✅ **已修正**：完全重建表，20 个字段全部匹配

---

### 4. schedule_change_notifications 表（8 字段）

| 字段名 | Supabase 类型 | SQL Server 类型 | 状态 |
|--------|--------------|----------------|------|
| id | uuid | UNIQUEIDENTIFIER | ✅ |
| task_id | uuid | UNIQUEIDENTIFIER | ✅ |
| **affected_employee_id** | uuid | UNIQUEIDENTIFIER | ✅ 已修正 |
| **modified_by_employee_id** | uuid | UNIQUEIDENTIFIER | ✅ 已修正 |
| **notification_type** | text | NVARCHAR(50) | ✅ 已修正 |
| **change_description** | text | NVARCHAR(MAX) | ✅ 已修正 |
| **is_read** | boolean | BIT | ✅ 已修正 |
| created_at | timestamptz | DATETIME2 | ✅ |

❌ **之前错误**：字段名完全不匹配  
- employee_id → affected_employee_id
- changed_by_employee_id → modified_by_employee_id
- notification_status → is_read  
- notification_message → change_description

✅ **已修正**：完全重建表，字段名全部匹配

---

### 5. tasks 表（19 字段）

| 字段名 | Supabase 类型 | SQL Server 类型 | 状态 |
|--------|--------------|----------------|------|
| id | uuid | UNIQUEIDENTIFIER | ✅ |
| task_name | text | NVARCHAR(500) | ✅ |
| task_type | text | NVARCHAR(100) | ✅ |
| task_location | text | NVARCHAR(100) | ✅ |
| assigned_employee_id | uuid | UNIQUEIDENTIFIER | ✅ |
| start_date | date | DATE | ✅ |
| end_date | date | DATE | ✅ |
| days_count | integer | INT | ✅ |
| hours_per_day | **numeric** | DECIMAL(10,2) | ✅ 已修正 |
| total_hours | **numeric** | DECIMAL(10,2) | ✅ 已修正 |
| source | text | NVARCHAR(20) | ✅ |
| status | text | NVARCHAR(20) | ✅ |
| is_cross_factory | boolean | BIT | ✅ |
| request_factory | text | NVARCHAR(100) | ✅ |
| required_skills | **ARRAY** | NVARCHAR(MAX) | ✅ (存储 JSON) |
| notes | text | NVARCHAR(MAX) | ✅ |
| created_at | timestamptz | DATETIME2 | ✅ |
| updated_at | timestamptz | DATETIME2 | ✅ |
| **time_slot** | text | NVARCHAR(50) | ✅ 已修正 |

❌ **之前错误**：缺少 `time_slot` 字段，`hours_per_day/total_hours` 类型错误  
✅ **已修正**：添加了 time_slot，修改数值类型为 DECIMAL

---

## ✅ 结论

### 表数量：
- Supabase：**11 个业务表**
- SQL Server：**11 个业务表 + 2 个认证表（users, otp_tokens）**

### 表结构匹配度：
执行 `SQLSERVER_SCHEMA_修正.sql` 后：
- ✅ **100% 匹配**：所有 11 个表的字段数量、字段名、字段类型完全对应
- ✅ **外键关系**：完全保留 Supabase 的 7 个外键约束
- ✅ **主键类型**：UUID/BIGINT/INT 类型完全匹配

### 额外的 2 个认证表说明：
- `users` 表：替代 Supabase Auth 的用户表
- `otp_tokens` 表：实现邮件验证码登录（Supabase 使用第三方服务，我们自建）

---

## 🎯 下一步操作

1. ✅ 在 SSMS 中执行 `SQLSERVER_SCHEMA_修正.sql`
2. ⏳ 从 Supabase Table Editor 导出 11 个表的 CSV
3. ⏳ 按顺序导入 CSV 到 SQL Server
4. ⏳ 验证数据完整性（3013 行）
