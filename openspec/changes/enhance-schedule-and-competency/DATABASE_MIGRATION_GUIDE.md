# 数据库迁移操作指南

## 📋 概览

本指南将帮助你完成 `enhance-schedule-and-competency` 变更所需的数据库迁移。

**迁移内容**：
- ✅ 为 `employees` 表添加 `role` 字段（权限管理）
- ✅ 为 `tasks` 表添加 `time_slot` 字段（半天粒度）
- ✅ 创建 `schedule_change_notifications` 表（通知系统）
- ✅ 更新触发器（支持半天工时计算）

**预估时间**：5-10 分钟

---

## ⚠️ 准备工作

### 1. 确认 Wang Ning 和 Liu Kui 的工号

在执行迁移前，你需要确认这两位 Site PS 的准确工号（employee_id），可以通过以下方式查询：

**方法A：在 Supabase Dashboard 查询**
1. 登录 Supabase Dashboard：https://wpbgzcmpwsktoaowwkpj.supabase.co
2. 进入 **SQL Editor**
3. 运行查询：
```sql
SELECT id, employee_id, name, department_id 
FROM public.employees 
WHERE name IN ('Wang Ning', 'Liu Kui')
OR name LIKE '%Wang%' OR name LIKE '%Liu%'
ORDER BY name;
```

**方法B：在应用中查询**
1. 启动应用：`npm run dev`
2. 访问「数据库诊断」页面
3. 查看所有员工列表，找到对应的 `employee_id`

**记录结果**：
```
Wang Ning 的工号：__________________
Liu Kui 的工号：  __________________
```

---

## 🚀 迁移步骤

### 步骤 1：备份数据库（强烈推荐）

在 Supabase Dashboard 中备份数据：

1. 进入 **Database** → **Backups**
2. 点击 **Create backup**
3. 等待备份完成（通常 1-2 分钟）

> 💡 **提示**：如果迁移出现问题，可以从备份恢复

---

### 步骤 2：执行迁移脚本

#### 选项A：通过 Supabase SQL Editor（推荐）

1. **打开 SQL Editor**
   - 登录 Supabase Dashboard
   - 左侧菜单点击 **SQL Editor**
   - 点击 **New query**

2. **复制迁移脚本**
   - 打开文件：`openspec/changes/enhance-schedule-and-competency/migrations/001_add_half_day_and_permissions.sql`
   - 全选并复制内容（Ctrl+A, Ctrl+C）

3. **粘贴并编辑**
   - 粘贴到 SQL Editor（Ctrl+V）
   - **重要**：找到第 34-40 行（Site PS 权限配置部分）
   - 取消注释并填入准确的工号：

   ```sql
   -- 修改前（注释状态）：
   -- UPDATE public.employees SET role = 'SITE_PS' WHERE employee_id IN ('填写工号1', '填写工号2');
   
   -- 修改后（取消注释并填入工号）：
   UPDATE public.employees SET role = 'SITE_PS' WHERE employee_id IN ('WN001', 'LK002');
   ```

4. **执行脚本**
   - 点击右下角的 **Run** 按钮（或按 `Ctrl + Enter`）
   - 等待执行完成（通常 5-10 秒）
   - 查看输出，确认没有错误

5. **验证结果**
   - 如果看到 `✅ Success` 和提示信息，说明迁移成功
   - 如果有错误，请查看本文档末尾的「常见问题」部分

---

#### 选项B：通过命令行（适合熟悉 psql 的用户）

```bash
# 1. 连接到 Supabase 数据库
psql "postgresql://postgres:[YOUR_PASSWORD]@db.wpbgzcmpwsktoaowwkpj.supabase.co:5432/postgres"

# 2. 执行迁移脚本
\i openspec/changes/enhance-schedule-and-competency/migrations/001_add_half_day_and_permissions.sql

# 3. 退出
\q
```

> 📝 **注意**：`[YOUR_PASSWORD]` 需要替换为你的 Supabase 数据库密码

---

### 步骤 3：验证迁移结果

在 SQL Editor 中运行以下验证查询：

```sql
-- 验证1：检查 employees 表的 role 字段
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'employees' 
AND column_name = 'role';
-- 预期结果：应返回 1 行，显示 role 列已存在

-- 验证2：检查 tasks 表的 time_slot 字段
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'tasks' 
AND column_name = 'time_slot';
-- 预期结果：应返回 1 行，显示 time_slot 列已存在

-- 验证3：检查通知表是否创建
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name = 'schedule_change_notifications';
-- 预期结果：应返回 1 行

-- 验证4：查看所有员工的角色分配
SELECT id, employee_id, name, role 
FROM public.employees 
ORDER BY role, name;
-- 预期结果：Wang Ning 和 Liu Kui 的 role 应为 'SITE_PS'，其他人为 'BPS_ENGINEER'

-- 验证5：查看现有任务的时间槽（应全为 FULL_DAY）
SELECT task_name, start_date, time_slot, total_hours 
FROM public.tasks 
ORDER BY start_date DESC
LIMIT 10;
-- 预期结果：所有现有任务的 time_slot 应为 'FULL_DAY'
```

---

### 步骤 4：更新 TypeScript 类型定义

迁移脚本只修改了数据库，前端代码需要同步更新类型定义：

1. **打开文件**：`src/lib/database.types.ts`

2. **查找并修改 Employee 类型**（大约在第 120-130 行）：
   ```typescript
   export type Employee = {
     id: string;
     employee_id: string;
     name: string;
     department_id: number | null;
     email: string | null;
     position: string | null;
     is_active: boolean;
     role: 'BPS_ENGINEER' | 'SITE_PS' | 'ADMIN';  // 👈 新增
     created_at: string;
     updated_at: string;
   };
   ```

3. **查找并修改 Task 类型**（大约在第 474-490 行）：
   ```typescript
   export type Task = {
     id: string;
     task_name: string;
     task_type: string;
     task_location: string;
     assigned_employee_id: string | null;
     start_date: string;
     end_date: string;
     days_count: number | null;
     hours_per_day: number;
     total_hours: number | null;
     time_slot: 'AM' | 'PM' | 'FULL_DAY';  // 👈 新增
     source: string;
     status: string;
     is_cross_factory: boolean;
     request_factory: string | null;
     required_skills: string[] | null;
     notes: string | null;
     created_at: string;
     updated_at: string;
   };
   ```

4. **在文件末尾添加新类型**：
   ```typescript
   // 日程变更通知类型
   export interface ScheduleChangeNotification {
     id: string;
     employee_id: string;
     modifier_id: string;
     task_id: string | null;
     change_type: 'CREATE' | 'UPDATE' | 'DELETE';
     change_details: Record<string, any> | null;
     is_read: boolean;
     created_at: string;
   }
   
   export type ScheduleChangeNotificationInsert = Omit<ScheduleChangeNotification, 'id' | 'created_at'>;
   export type ScheduleChangeNotificationUpdate = Partial<ScheduleChangeNotificationInsert>;
   ```

---

## ✅ 完成检查清单

迁移完成后，请确认以下事项：

- [ ] ✅ 备份数据库已创建
- [ ] ✅ 迁移脚本执行成功（无错误）
- [ ] ✅ Wang Ning 和 Liu Kui 的 role 已设置为 'SITE_PS'
- [ ] ✅ 验证查询全部通过
- [ ] ✅ TypeScript 类型定义已更新
- [ ] ✅ 应用可正常编译（`npm run typecheck`）
- [ ] ✅ 现有数据未受影响（现有任务仍可查看）

---

## 🔧 测试数据（可选）

如果你想快速测试半天任务功能，可以手动插入一些测试数据：

```sql
-- 插入测试任务：上午任务
INSERT INTO public.tasks (
  task_name, 
  task_type, 
  task_location, 
  assigned_employee_id,
  start_date, 
  end_date, 
  time_slot,
  status
) VALUES (
  '测试上午任务', 
  'meeting', 
  'FLCNa', 
  (SELECT id FROM public.employees LIMIT 1),  -- 取第一个员工
  CURRENT_DATE,
  CURRENT_DATE,
  'AM',
  'active'
);

-- 插入测试任务：下午任务
INSERT INTO public.tasks (
  task_name, 
  task_type, 
  task_location, 
  assigned_employee_id,
  start_date, 
  end_date, 
  time_slot,
  status
) VALUES (
  '测试下午任务', 
  'training', 
  'FLCCh', 
  (SELECT id FROM public.employees LIMIT 1),
  CURRENT_DATE,
  CURRENT_DATE,
  'PM',
  'active'
);

-- 查看测试任务
SELECT task_name, time_slot, total_hours, start_date 
FROM public.tasks 
WHERE task_name LIKE '测试%'
ORDER BY start_date DESC;
```

预期结果：
- 上午任务的 `total_hours` 应为 `3.5`
- 下午任务的 `total_hours` 应为 `4.5`

---

## ❓ 常见问题 FAQ

### Q1: 执行脚本时提示 "permission denied"
**原因**：当前数据库用户没有足够权限

**解决方案**：
1. 确认你使用的是 Supabase Dashboard 的 SQL Editor（自动使用管理员权限）
2. 如果通过命令行，确保使用 `postgres` 用户连接

---

### Q2: 找不到 Wang Ning 或 Liu Kui 的记录
**原因**：员工数据可能尚未导入，或姓名拼写不同

**解决方案**：
1. 查询所有员工：`SELECT * FROM public.employees ORDER BY name;`
2. 确认正确的姓名拼写（可能是中文或英文）
3. 如果员工不存在，可以先跳过此步骤，后续手动添加

---

### Q3: 触发器创建失败
**原因**：可能已存在同名触发器或函数

**解决方案**：
脚本已包含 `DROP TRIGGER IF EXISTS`，应该不会冲突。如果仍有问题，可以手动删除：
```sql
DROP TRIGGER IF EXISTS trigger_calculate_task_hours ON public.tasks;
DROP FUNCTION IF EXISTS calculate_task_hours();
```
然后重新执行脚本。

---

### Q4: 如何回滚迁移？
**方法1**：从备份恢复（最安全）

**方法2**：执行回滚脚本（在迁移脚本末尾）：
```sql
DROP INDEX IF EXISTS idx_employees_role;
ALTER TABLE public.employees DROP COLUMN IF EXISTS role;

DROP INDEX IF EXISTS idx_tasks_time_slot;
DROP INDEX IF EXISTS idx_tasks_employee_date_slot;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS time_slot;

DROP TABLE IF EXISTS public.schedule_change_notifications CASCADE;
```

---

### Q5: 现有任务的 time_slot 都是 FULL_DAY，会影响功能吗？
**回答**：不会影响。

- `FULL_DAY` 是默认值，表示整天任务（8小时）
- 现有数据和功能完全兼容
- 用户可以在界面中创建新的 AM/PM 任务
- 也可以编辑现有任务，将其改为半天任务

---

### Q6: 迁移后应用报类型错误
**原因**：TypeScript 类型定义未更新

**解决方案**：
1. 确认已按「步骤 4」更新 `database.types.ts`
2. 重启开发服务器：`npm run dev`
3. 运行类型检查：`npm run typecheck`

---

## 📞 需要帮助？

如果遇到其他问题，请提供以下信息：

1. **错误信息截图**（SQL Editor 的完整输出）
2. **数据库版本**：在 SQL Editor 运行 `SELECT version();`
3. **验证查询结果**：运行「步骤 3」中的验证查询

---

## 🎉 下一步

迁移完成后，你可以：

1. ✅ 开始实施前端功能（参考 `tasks.md`）
2. ✅ 在应用中测试半天任务创建
3. ✅ 配置 Wang Ning 和 Liu Kui 的账户登录
4. ✅ 测试权限控制和通知功能

**祝迁移顺利！** 🚀

