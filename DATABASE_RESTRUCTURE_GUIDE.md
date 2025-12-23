# 🔄 数据库重构完整指南

## 📅 创建日期
2025-11-24

## 🎯 重构目标

将数据库从**2张表**重构为**4张表**，实现：
1. ✅ 规范化数据库设计（符合第三范式）
2. ✅ 支持矩阵视图（Excel样式的总览）
3. ✅ 更灵活的查询和统计能力
4. ✅ 更好的数据完整性和维护性

---

## 📊 架构对比

### 重构前（2张表）

```
competency_definitions
├─ id
├─ module_id
├─ module_name
├─ competency_type
└─ ...

competency_assessments
├─ id
├─ engineer_id (文本)
├─ engineer_name
├─ department (文本)
├─ module_name (冗余)
├─ competency_type (冗余)
├─ current_score
├─ target_score
└─ ...
```

**问题**：
- ❌ 数据冗余（模块名、部门名重复存储）
- ❌ 无法统一管理员工和部门
- ❌ 难以生成矩阵视图

### 重构后（4张表）

```
departments (部门表)
├─ id (自增主键)
├─ name (部门名称)
└─ code (部门编码)

employees (员工表)
├─ id (UUID主键)
├─ employee_id (工号)
├─ name (姓名)
└─ department_id (外键 → departments.id)

skills (技能表)
├─ id (自增主键)
├─ module_id (模块ID: 1-9)
├─ module_name (模块名称)
├─ skill_name (技能名称)
└─ display_order (排序)

competency_assessments (评估表)
├─ id (UUID主键)
├─ employee_id (外键 → employees.id)
├─ skill_id (外键 → skills.id)
├─ current_level (1-5)
├─ target_level (1-5)
├─ gap (自动计算 = target - current)
└─ assessment_year (评估年度)
```

**优势**：
- ✅ 消除数据冗余
- ✅ 统一管理员工、部门、技能
- ✅ 支持多对多关系
- ✅ 易于生成统计和矩阵视图

---

## 🚀 执行步骤

### 第一步：在Supabase中执行SQL脚本 ⚠️

**重要提示：请在测试环境先验证，再在生产环境执行！**

#### 1.1 登录Supabase

1. 打开 [https://supabase.com](https://supabase.com)
2. 进入您的项目
3. 点击左侧菜单的 **SQL Editor**

#### 1.2 执行建表脚本

1. 打开文件：`DATABASE_RESTRUCTURE.sql`
2. 复制全部内容
3. 粘贴到SQL Editor
4. 点击 **Run** 执行

**预期结果**：
```
✓ 创建 departments 表
✓ 创建 employees 表
✓ 创建 skills 表
✓ 创建 competency_assessments 表
✓ 创建 4 个视图
✓ 启用 RLS
✓ 插入示例技能数据（27条）
✓ 创建触发器
```

#### 1.3 执行数据迁移脚本（如果有旧数据）

**⚠️ 只有当您的旧表中有数据时才执行此步骤**

1. 打开文件：`DATA_MIGRATION.sql`
2. 复制全部内容
3. 粘贴到SQL Editor
4. 点击 **Run** 执行

**预期结果**：
```
✓ 迁移部门数据
✓ 迁移员工数据
✓ 迁移技能数据
✓ 迁移评估数据
✓ 数据验证通过
```

#### 1.4 验证数据

执行以下查询验证数据：

```sql
-- 查看表数据量
select 'Departments' as table_name, count(*) as row_count from departments
union all
select 'Employees', count(*) from employees
union all
select 'Skills', count(*) from skills
union all
select 'Assessments', count(*) from competency_assessments;

-- 查看视图
select * from view_assessments_full limit 10;
select * from view_employee_gaps limit 10;
```

---

### 第二步：更新前端代码

#### 2.1 替换类型定义文件

```bash
# 在项目根目录执行
mv src/lib/database.types.ts src/lib/database.types.old.ts
mv src/lib/database.types.new.ts src/lib/database.types.ts
```

#### 2.2 更新代码库

接下来我会为您：
1. ✅ 重写 `supabaseService.ts`（适配新表）
2. ✅ 创建矩阵视图组件 `MatrixView.tsx`
3. ✅ 更新 `CompetencyAssessment.tsx`（添加矩阵视图标签页）
4. ✅ 更新 `ImportNew.tsx`（适配新表导入逻辑）

---

## 📋 新表结构详解

### 1. departments 表（部门）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键（自增） |
| name | text | 部门名称（唯一） |
| code | text | 部门编码（如 SNa-PS） |
| description | text | 部门描述 |

**示例数据**：
```sql
insert into departments (name, code) values
  ('SCh-PS', 'SCh-PS'),
  ('SCh-QA', 'SCh-QA'),
  ('SCh-Mfg', 'SCh-Mfg');
```

### 2. employees 表（员工）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| employee_id | text | 员工工号（唯一） |
| name | text | 员工姓名 |
| department_id | bigint | 所属部门（外键） |
| email | text | 邮箱（可选） |
| position | text | 职位（可选） |
| is_active | boolean | 是否在职 |

**示例数据**：
```sql
insert into employees (employee_id, name, department_id) values
  ('E001', '张三', 1),
  ('E002', '李四', 2);
```

### 3. skills 表（技能）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键（自增） |
| module_id | int | 模块ID（1-9） |
| module_name | text | 模块名称 |
| skill_name | text | 技能名称 |
| skill_code | text | 技能编码（可选） |
| description | text | 技能描述 |
| display_order | int | 显示顺序 |
| is_active | boolean | 是否启用 |

**模块映射**：
| module_id | module_name | 说明 |
|-----------|-------------|------|
| 1 | TPM基础 | 设备管理相关 |
| 2 | 精益流程 | 精益生产 |
| 3 | 问题解决 | 问题分析方法 |
| 4 | 项目管理 | 项目计划执行 |
| 5 | 数据分析 | 统计和分析 |
| 6 | 团队领导 | 团队管理 |
| 7 | 质量管理 | 质量控制 |
| 8 | 设备管理 | 设备维护 |
| 9 | 流程优化 | 流程改进 |

**示例数据**（已在建表脚本中插入27条示例技能）

### 4. competency_assessments 表（评估）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| employee_id | uuid | 员工ID（外键） |
| skill_id | bigint | 技能ID（外键） |
| current_level | int | 现状得分（1-5） |
| target_level | int | 目标得分（1-5） |
| gap | int | 差距（自动计算） |
| assessment_year | int | 评估年度 |
| assessment_date | date | 评估日期 |
| notes | text | 备注 |

**约束**：
- ✅ `current_level` 和 `target_level` 必须在 1-5 之间
- ✅ `target_level` 必须 ≥ `current_level`
- ✅ 同一员工对同一技能在同一年度只能有一条记录

**示例数据**：
```sql
insert into competency_assessments (employee_id, skill_id, current_level, target_level) values
  ('uuid-of-zhang-san', 1, 3, 4),  -- 张三的"设备管理"：3→4
  ('uuid-of-zhang-san', 2, 4, 5);  -- 张三的"预防维护"：4→5
```

---

## 🔍 4个视图说明

### 1. view_assessments_full（完整评估数据）

包含所有关联信息的评估数据，用于详细查询。

**字段**：员工信息、部门信息、技能信息、评估得分

**示例查询**：
```sql
select * from view_assessments_full
where department_name = 'SCh-PS'
  and assessment_year = 2025
order by employee_name, display_order;
```

### 2. view_employee_gaps（员工Gap统计）

按员工统计Gap情况。

**字段**：
- `total_skills`: 评估的技能总数
- `skills_with_gap`: 有差距的技能数
- `total_gap_score`: 总差距分数
- `avg_current_level`: 平均现状得分
- `avg_target_level`: 平均目标得分
- `avg_gap`: 平均差距

**示例查询**：
```sql
select * from view_employee_gaps
where assessment_year = 2025
order by total_gap_score desc
limit 10;  -- 查看Gap最大的10个员工
```

### 3. view_skill_gaps（技能Gap统计）

按技能统计Gap情况，找出最需要培训的技能。

**示例查询**：
```sql
select * from view_skill_gaps
where assessment_year = 2025
order by avg_gap desc
limit 10;  -- 查看差距最大的10个技能
```

### 4. view_department_gaps（部门Gap统计）

按部门统计Gap情况，用于部门间对比。

**示例查询**：
```sql
select * from view_department_gaps
where assessment_year = 2025
order by avg_gap desc;
```

---

## 🧪 测试SQL查询

### 查询1：获取矩阵视图数据

```sql
-- 获取所有员工的所有技能评估（用于前端渲染矩阵）
select 
  e.id as employee_id,
  e.employee_id as employee_code,
  e.name as employee_name,
  d.name as department_name,
  s.id as skill_id,
  s.module_id,
  s.module_name,
  s.skill_name,
  s.display_order,
  ca.current_level,
  ca.target_level,
  ca.gap
from employees e
cross join skills s
left join competency_assessments ca 
  on ca.employee_id = e.id 
  and ca.skill_id = s.id
  and ca.assessment_year = 2025
left join departments d on e.department_id = d.id
where e.is_active = true 
  and s.is_active = true
order by d.name, e.name, s.display_order;
```

### 查询2：按部门筛选

```sql
select * from view_assessments_full
where department_name in ('SCh-PS', 'SCh-QA')
  and module_id = 1  -- 只看TPM基础模块
  and assessment_year = 2025;
```

### 查询3：找出需要重点培训的员工

```sql
select 
  employee_name,
  department_name,
  total_gap_score,
  skills_with_gap,
  avg_gap
from view_employee_gaps
where assessment_year = 2025
  and avg_gap > 1.0  -- 平均差距大于1
order by total_gap_score desc;
```

---

## 📊 矩阵视图实现原理

### 前端数据流

```
1. 从Supabase查询数据
   ↓
2. 获取所有员工 × 所有技能的评估数据（包括空值）
   ↓
3. 前端进行数据透视（Pivot）
   ↓
4. 渲染为表格：
   - 行：员工
   - 列：技能
   - 单元格：C/T得分
```

### 数据结构示例

**查询结果（扁平数据）**：
```json
[
  { "employee_name": "张三", "skill_name": "设备管理", "current_level": 3, "target_level": 4 },
  { "employee_name": "张三", "skill_name": "预防维护", "current_level": 4, "target_level": 5 },
  { "employee_name": "李四", "skill_name": "设备管理", "current_level": 2, "target_level": 3 }
]
```

**转换为矩阵**：
```
         | 设备管理 | 预防维护 |
---------|---------|---------|
张三     | 3/4     | 4/5     |
李四     | 2/3     | -       |
```

---

## ⚙️ 性能优化建议

### 1. 索引已创建

```sql
-- 以下索引已在建表脚本中创建
create index idx_employees_department on employees(department_id);
create index idx_assessments_employee on competency_assessments(employee_id);
create index idx_assessments_skill on competency_assessments(skill_id);
create index idx_assessments_year on competency_assessments(assessment_year);
```

### 2. 查询优化

- ✅ 使用视图进行复杂查询（已预先JOIN）
- ✅ 矩阵视图数据使用 `CROSS JOIN` 确保所有组合
- ✅ 在前端缓存数据，减少重复查询

### 3. 数据量估算

假设：
- 100名员工
- 30个技能
- 1年数据

**评估表记录数**：100 × 30 = 3,000 条
**矩阵单元格数**：100 × 30 = 3,000 个

预计查询时间：< 100ms（有索引）

---

## 🔐 权限管理（RLS）

当前策略：**公开读取**（适合测试）

```sql
-- 所有表都设置为公开读取
create policy "Public read access" on employees for select using (true);
```

### 生产环境建议

根据实际需求修改策略：

```sql
-- 示例：只能查看自己部门的数据
create policy "Read own department" on employees 
  for select using (
    department_id = (
      select department_id from employees 
      where employee_id = auth.jwt()->>'employee_id'
    )
  );
```

---

## 📌 常见问题

### Q1: 如何删除旧表？

A: 在确认数据迁移成功后：
```sql
-- 方案1：重命名作为备份
alter table competency_assessments rename to competency_assessments_backup;

-- 方案2：直接删除（确保已有其他备份）
drop table if exists competency_assessments cascade;
drop table if exists competency_definitions cascade;
```

### Q2: 如何回滚？

A: 重建旧表结构，并从备份表恢复数据。建议在执行前先在测试环境验证。

### Q3: 导入Excel时如何处理？

A: 解析器会自动：
1. 提取部门 → 插入/更新 `departments` 表
2. 提取员工 → 插入/更新 `employees` 表
3. 提取技能 → 插入/更新 `skills` 表
4. 提取评估 → 插入/更新 `competency_assessments` 表

### Q4: 如何添加新技能？

A: 两种方式：
```sql
-- 方式1：直接插入
insert into skills (module_id, module_name, skill_name, display_order) 
values (1, 'TPM基础', '新技能名称', 28);

-- 方式2：通过导入功能（Excel包含新技能时自动创建）
```

---

## ✅ 重构完成检查清单

- [ ] 在Supabase执行 `DATABASE_RESTRUCTURE.sql`
- [ ] 验证4张表已创建
- [ ] 验证4个视图已创建
- [ ] 执行 `DATA_MIGRATION.sql`（如有旧数据）
- [ ] 验证数据迁移完整性
- [ ] 替换前端类型定义文件
- [ ] 测试矩阵视图查询
- [ ] 测试导入功能
- [ ] 测试筛选功能
- [ ] 备份并删除旧表（可选）

---

## 📚 相关文档

- [DATABASE_RESTRUCTURE.sql](./DATABASE_RESTRUCTURE.sql) - 建表脚本
- [DATA_MIGRATION.sql](./DATA_MIGRATION.sql) - 数据迁移脚本
- [database.types.new.ts](./src/lib/database.types.new.ts) - 新类型定义

---

## 🆘 需要帮助？

如果遇到问题：
1. 检查Supabase SQL Editor的错误信息
2. 验证数据完整性查询结果
3. 查看浏览器控制台错误
4. 向我提供具体错误信息

---

*最后更新：2025-11-24*
