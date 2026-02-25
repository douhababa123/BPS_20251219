# Supabase 数据导出到 SQL Server 操作指南

> **目标**: 从 Supabase 手动导出 11 个表的数据（3013 行），按正确顺序导入到 SQL Server
> **预计时间**: 约 30-40 分钟
> **工具**: Supabase Dashboard + SQL Server Management Studio (SSMS)

---

## 📋 导出概览

### 数据总量

- **11 个业务表**
- **3013 行数据**（2026-01-29 统计）
- **分 3 批导出**（遵循外键依赖顺序）

### 导出顺序（重要！⚠️）


| 批次       | 表名                          | 行数        | 依赖关系                                  | 说明                   |
| ---------- | ----------------------------- | ----------- | ----------------------------------------- | ---------------------- |
| **第一批** | departments                   | 14          | 无                                        | 部门表                 |
|            | factories                     | 9           | 无                                        | 工厂表                 |
|            | task_types                    | 8           | 无                                        | 任务类型（系统级）     |
|            | resource_task_types           | 11          | 无                                        | 资源任务类型（业务级） |
|            | skills                        | 104         | 无                                        | 技能表                 |
|            | competency_definitions        | 39          | 无                                        | 能力定义               |
| **小计**   | **6 个表**                    | **185 行**  | -                                         | -                      |
| **第二批** | employees                     | 18          | departments, factories                    | 员工表                 |
| **小计**   | **1 个表**                    | **18 行**   | -                                         | -                      |
| **第三批** | competency_assessments        | 375         | employees, skills, competency_definitions | 能力评估               |
|            | tasks                         | 15          | task_types, employees                     | 任务表                 |
|            | resource_planning_tasks       | 2411        | employees                                 | 资源规划任务           |
|            | schedule_change_notifications | 9           | employees, tasks                          | 排班变更通知           |
| **小计**   | **4 个表**                    | **2810 行** | -                                         | -                      |
| **总计**   | **11 个表**                   | **3013 行** | -                                         | -                      |

---

## 🚀 第一步：登录 Supabase Dashboard

1. **打开浏览器**，访问: https://supabase.com/dashboard
2. **登录账号**

   - 使用您的 Supabase 账号登录
3. **选择项目**

   - 找到 BPS 项目
   - 项目 URL: `https://wpbgzcmpwsktoaowwkpj.supabase.co`
4. **进入 Table Editor**

   - 左侧菜单 → **Table Editor**

---

## 📦 第二步：导出第一批数据（6 个表，185 行）

> ⚠️ **注意**: 这些表没有外键依赖，可以任意顺序导出和导入

### 1️⃣ 导出 departments（部门表，14 行）

**操作步骤**:

1. Table Editor → 选择 **departments** 表
2. 点击右上角 **"⋮"（三个点）** → **"Export to CSV"**
3. 保存文件为: `departments.csv`
4. 保存位置建议: `C:\Users\DOC2CHZ\Software\BPS_20251219\csv_data\departments.csv`

**字段清单**（确保包含）:

```
id, code, name, description, is_active, created_at, updated_at
```

**示例数据**（前 3 行）:


| id | code  | name           | is_active |
| -- | ----- | -------------- | --------- |
| 1  | PS    | Product System | true      |
| 2  | PS-CI | CI             | true      |
| 3  | PS-TP | TP             | true      |

**验证**: CSV 应该有 **14 行数据**（不含表头）

---

### 2️⃣ 导出 factories（工厂表，9 行）

**操作步骤**:

1. Table Editor → 选择 **factories** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `factories.csv`

**字段清单**:

```
id, code, name, location, is_active, created_at, updated_at
```

**验证**: CSV 应该有 **9 行数据**

---

### 3️⃣ 导出 task_types（任务类型表，8 行）

**操作步骤**:

1. Table Editor → 选择 **task_types** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `task_types.csv`

**字段清单**:

```
id, code, name, color_hex, description, is_system, is_active, created_at, updated_at
```

**验证**: CSV 应该有 **8 行数据**

---

### 4️⃣ 导出 resource_task_types（资源任务类型表，11 行）

**操作步骤**:

1. Table Editor → 选择 **resource_task_types** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `resource_task_types.csv`

**字段清单**:

```
id, code, name, color_hex, description, is_active, created_at, updated_at
```

**验证**: CSV 应该有 **11 行数据**

---

### 5️⃣ 导出 skills（技能表，104 行）

**操作步骤**:

1. Table Editor → 选择 **skills** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `skills.csv`

**字段清单**:

```
id, skill_id, skill_name, category, description, is_active, created_at, updated_at
```

**验证**: CSV 应该有 **104 行数据**

---

### 6️⃣ 导出 competency_definitions（能力定义表，39 行）

**操作步骤**:

1. Table Editor → 选择 **competency_definitions** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `competency_definitions.csv`

**字段清单**（注意字段名）:

```
id, module_id, module_name, competency_type, competency_code, description, 
owner_engineer, is_key_competency, created_at, updated_at
```

**⚠️ 重要**: 确保字段名是 `competency_type`（不是 `competency_name`）

**验证**: CSV 应该有 **39 行数据**

---

### ✅ 第一批导出完成检查

完成后，您应该有以下 6 个 CSV 文件：

```
csv_data/
├── departments.csv           (14 行)
├── factories.csv             (9 行)
├── task_types.csv            (8 行)
├── resource_task_types.csv   (11 行)
├── skills.csv                (104 行)
└── competency_definitions.csv (39 行)

总计: 185 行数据
```

---

## 👥 第三步：导出第二批数据（1 个表，18 行）

> ⚠️ **依赖关系**: employees 表依赖 departments 和 factories

### 7️⃣ 导出 employees（员工表，18 行）

**操作步骤**:

1. Table Editor → 选择 **employees** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `employees.csv`

**字段清单**（共 15 个字段）:

```
id, employee_id, name, email, department_id, factory_id, skill_ids, 
role, phone, hire_date, is_active, last_login_at, login_count, 
created_at, updated_at
```

**⚠️ 特殊字段处理**:

- **skill_ids**: 这是一个数组字段（如 `{1, 2, 3}`）
  - Supabase 导出格式: `{1,2,3}` 或 `"{1,2,3}"`
  - 导入 SQL Server 时需要转换为 JSON 格式: `[1,2,3]`
  - **处理方式**: 先导出，导入前用 Excel 或脚本批量替换 `{` → `[` 和 `}` → `]`

**示例数据**:


| id     | employee_id | name | email              | department_id | skill_ids |
| ------ | ----------- | ---- | ------------------ | ------------- | --------- |
| uuid-1 | EMP001      | 张三 | zhangsan@bosch.com | 1             | {1,2,3}   |

**验证**: CSV 应该有 **18 行数据**

---

## 📊 第四步：导出第三批数据（4 个表，2810 行）

> ⚠️ **依赖关系**: 所有表都依赖 employees 表

### 8️⃣ 导出 competency_assessments（能力评估表，375 行）

**操作步骤**:

1. Table Editor → 选择 **competency_assessments** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `competency_assessments.csv`

**字段清单**:

```
id, employee_id, skill_id, competency_definition_id, level, 
assessed_at, assessed_by, notes, created_at, updated_at
```

**验证**: CSV 应该有 **375 行数据**

---

### 9️⃣ 导出 tasks（任务表，15 行）

**操作步骤**:

1. Table Editor → 选择 **tasks** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `tasks.csv`

**字段清单**:

```
id, task_name, task_type_id, assigned_employee_id, 
start_date, end_date, time_slot, hours_per_day, total_hours, 
priority, status, required_skills, description, 
created_at, updated_at
```

**⚠️ 特殊字段处理**:

- **required_skills**: 数组字段（如 `{1, 2, 3}`）
  - 导入前需转换为 JSON: `[1,2,3]`

**验证**: CSV 应该有 **15 行数据**

---

### 🔟 导出 resource_planning_tasks（资源规划任务表，2411 行）⭐

**操作步骤**:

1. Table Editor → 选择 **resource_planning_tasks** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `resource_planning_tasks.csv`

**⚠️ 数据量最大**: 2411 行，导出可能需要 1-2 分钟

**字段清单**（共 20 个字段）:

```
id, employee_id, task_type_code, start_week, end_week, 
start_date, end_date, topic, location, notes, 
imported_at, import_batch_id, source_file_name, 
created_at, updated_at, task_date, year_month, cw_week, 
day_of_month, task_type
```

**验证**: CSV 应该有 **2411 行数据**

---

### 1️⃣1️⃣ 导出 schedule_change_notifications（排班变更通知表，9 行）

**操作步骤**:

1. Table Editor → 选择 **schedule_change_notifications** 表
2. 点击右上角 **"⋮"** → **"Export to CSV"**
3. 保存文件为: `schedule_change_notifications.csv`

**字段清单**:

```
id, task_id, affected_employee_id, modified_by_employee_id, 
notification_type, change_description, is_read, created_at
```

**⚠️ 重要**: 确保字段名正确（参考完整指南中的字段差异对比）

**验证**: CSV 应该有 **9 行数据**

---

## ✅ 导出完成总检查

完成所有导出后，您应该有以下 **11 个 CSV 文件**：

### 文件清单及大小

```
csv_data/
├── 第一批（无外键依赖）
│   ├── departments.csv           (14 行)
│   ├── factories.csv             (9 行)
│   ├── task_types.csv            (8 行)
│   ├── resource_task_types.csv   (11 行)
│   ├── skills.csv                (104 行)
│   └── competency_definitions.csv (39 行)
│
├── 第二批（依赖第一批）
│   └── employees.csv             (18 行)
│
└── 第三批（依赖第二批）
    ├── competency_assessments.csv (375 行)
    ├── tasks.csv                  (15 行)
    ├── resource_planning_tasks.csv (2411 行) ⭐ 最大
    └── schedule_change_notifications.csv (9 行)

总计: 11 个文件，3013 行数据
```

### 验证命令（PowerShell）

在 csv_data 目录下执行：

```powershell
# 统计所有 CSV 文件的行数（减去表头）
Get-ChildItem *.csv | ForEach-Object { 
    $lines = (Get-Content $_.Name | Measure-Object -Line).Lines - 1
    [PSCustomObject]@{
        文件名 = $_.Name
        数据行数 = $lines
    }
} | Format-Table -AutoSize

# 计算总行数
$total = 0
Get-ChildItem *.csv | ForEach-Object { 
    $total += (Get-Content $_.Name | Measure-Object -Line).Lines - 1
}
Write-Host "总数据行数: $total" -ForegroundColor Green
# 预期: 3013
```

---

## 🔧 数据预处理（导入前必做）

### 1. 处理数组字段

**涉及表**:

- `employees.csv` → `skill_ids` 字段
- `tasks.csv` → `required_skills` 字段

**转换规则**:

- **原格式**（PostgreSQL 数组）: `{1,2,3}` 或 `"{1,2,3}"`
- **目标格式**（JSON 数组）: `[1,2,3]`

**Excel 批量替换方法**:

1. 用 Excel 打开 CSV 文件
2. Ctrl+H 打开"查找和替换"
3. 查找: `{` → 替换为: `[`
4. 查找: `}` → 替换为: `]`
5. 保存文件

**PowerShell 脚本方法**:

```powershell
# 自动转换数组字段格式
$files = @('employees.csv', 'tasks.csv')
foreach ($file in $files) {
    $content = Get-Content "csv_data\$file" -Raw
    $content = $content -replace '\{', '[' -replace '\}', ']'
    Set-Content "csv_data\${file}_processed.csv" -Value $content
    Write-Host "已处理: $file" -ForegroundColor Green
}
```

---

### 2. 验证 UUID 格式

**涉及字段**: 所有 UUID 类型字段（如 `id`, `employee_id`, `task_id`）

**正确格式**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`（带连字符）

**验证方法**:

1. 打开任一 CSV 文件
2. 检查 UUID 字段是否包含连字符
3. Supabase 默认导出格式已正确，无需处理

---

### 3. 检查特殊字符

**潜在问题**:

- CSV 中的逗号（`,`）可能导致列错位
- 换行符（`\n`）可能导致行错位
- 引号（`"`）可能导致解析错误

**处理方法**:

- 用 Excel 打开，检查列数是否正确
- 如果有错位，使用 Excel 的"文本导入向导"（数据 → 从文本/CSV）
- 选择"逗号"分隔符，文本识别符为双引号

---

## 📝 导出清单（打印使用）

打印此清单，逐个勾选完成：

```
□ 1. departments.csv (14 行)
□ 2. factories.csv (9 行)
□ 3. task_types.csv (8 行)
□ 4. resource_task_types.csv (11 行)
□ 5. skills.csv (104 行)
□ 6. competency_definitions.csv (39 行)
□ 7. employees.csv (18 行)
□ 8. competency_assessments.csv (375 行)
□ 9. tasks.csv (15 行)
□ 10. resource_planning_tasks.csv (2411 行)
□ 11. schedule_change_notifications.csv (9 行)

总计: 3013 行 ✓
```

---

## ⚠️ 常见问题

### Q1: Supabase Table Editor 显示不全所有行怎么办？

**A**: Table Editor 默认分页显示（通常 100-500 行/页）。但"Export to CSV"会导出**所有行**，无需翻页。

---

### Q2: 导出的 CSV 文件用记事本打开是乱码？

**A**:

- CSV 文件编码可能是 UTF-8（带 BOM）
- **解决方案**: 用 Excel 打开，或用 Notepad++ 设置编码为 UTF-8
- **不影响导入**: SSMS 导入时会自动识别编码

---

### Q3: 某些表导出失败或超时？

**A**:

- 可能是网络问题或数据量过大
- **解决方案**: 刷新页面重试，或使用"Filters"分批导出（如按 `created_at` 范围过滤）

---

### Q4: 导出的 CSV 缺少某些字段？

**A**:

- Table Editor 可能隐藏了某些列
- **解决方案**: 点击表头右侧的"列选择器"（图标），确保所有列都勾选

---

### Q5: CSV 文件大小多少正常？

**A**: 参考大小（仅供参考）：

- departments.csv: ~2 KB
- employees.csv: ~3 KB
- skills.csv: ~15 KB
- competency_assessments.csv: ~60 KB
- **resource_planning_tasks.csv: ~500 KB - 1 MB**（最大）
- 其他表: 几 KB

---

## 🎯 下一步

导出完成后，继续执行：

1. **数据预处理**（处理数组字段）
2. **导入第一批数据到 SQL Server**（6 个表）
3. **导入第二批数据**（1 个表）
4. **导入第三批数据**（4 个表）
5. **验证数据完整性**（行数、外键、视图）

详细导入步骤请参考：`SUPABASE_数据导入操作指南.md`（即将创建）

---

## 📞 需要帮助？

如遇到问题，请参考：

- `SUPABASE_TO_SQLSERVER_表结构迁移完整指南.md`（完整技术文档）
- `SUPABASE_SQLSERVER_对比报告.md`（字段差异对比）

---

**导出愉快！🚀**
