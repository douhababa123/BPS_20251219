# 🔧 修复 RLS 策略错误

## ❌ 错误信息
```
new row violates row-level security policy for table "employees"
Status: 403 Forbidden
```

## 🔍 问题原因

Supabase 的 **Row Level Security (RLS)** 策略阻止了新用户创建员工记录。

当前的 RLS 策略只允许：
- ✅ 查看（SELECT）自己的员工记录
- ✅ 更新（UPDATE）自己的员工记录
- ❌ **插入（INSERT）自己的员工记录** ← 缺少这个！

---

## ✅ 解决方案

### 步骤 1: 打开 Supabase SQL Editor

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 选择您的项目
3. 点击左侧菜单 **SQL Editor**
4. 点击 **New query**

### 步骤 2: 执行修复 SQL

复制以下 SQL 并执行：

```sql
-- 添加 INSERT 策略：允许已认证用户创建自己的员工记录
CREATE POLICY "Users can insert own employee record"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);
```

### 步骤 3: 验证策略

执行以下查询，确认策略已添加：

```sql
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY policyname;
```

**预期结果**：应该看到以下策略：

| policyname | cmd | qual | with_check |
|-----------|-----|------|------------|
| Admins can update all employee data | UPDATE | ... | ... |
| Admins can view all employee data | SELECT | ... | ... |
| Public read on active employees | SELECT | ... | ... |
| Site PS can view all employee data | SELECT | ... | ... |
| **Users can insert own employee record** | **INSERT** | | **auth.uid() = auth_user_id** |
| Users can update own employee data | UPDATE | ... | ... |
| Users can view own employee data | SELECT | ... | ... |

---

## 🎯 快速修复（复制粘贴）

### 完整的 SQL 脚本

我已经创建了 `fix_rls_policy.sql` 文件，内容如下：

```sql
-- 添加 INSERT 策略：允许已认证用户创建自己的员工记录
CREATE POLICY "Users can insert own employee record"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

-- 验证策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY policyname;
```

---

## 📋 执行步骤

### 方法 1: 使用 Supabase Dashboard（推荐）

1. **打开 Supabase Dashboard**
   - 访问：https://app.supabase.com
   - 登录您的账号
   - 选择项目

2. **打开 SQL Editor**
   - 左侧菜单 → **SQL Editor**
   - 点击 **New query**

3. **执行 SQL**
   - 复制 `fix_rls_policy.sql` 的内容
   - 粘贴到编辑器
   - 点击 **Run** 或按 **Ctrl+Enter**

4. **查看结果**
   - 应该看到"Success"消息
   - 下方显示所有策略列表

### 方法 2: 使用 Supabase CLI（如果已安装）

```bash
# 执行 SQL 文件
supabase db execute -f fix_rls_policy.sql
```

---

## 🧪 测试修复

### 步骤 1: 刷新应用
1. 回到浏览器
2. 刷新页面（F5）
3. 应该仍然在 ProfileSetupScreen

### 步骤 2: 重新提交
1. 填写表单（如果已填写，直接点击）
2. 点击 **"完成设置"**
3. 应该成功创建员工记录

### 步骤 3: 验证成功
成功后应该：
- ✅ 不再显示错误
- ✅ 自动跳转到主界面
- ✅ 显示您的员工信息

---

## 🔍 为什么会出现这个问题？

### RLS 策略的工作原理

Row Level Security (RLS) 是 PostgreSQL 的安全功能，用于控制谁可以访问表中的哪些行。

#### 我们的 RLS 策略

**之前的策略**（缺少 INSERT）：
```sql
-- ✅ 允许查看自己的记录
CREATE POLICY "Users can view own employee data"
FOR SELECT USING (auth.uid() = auth_user_id);

-- ✅ 允许更新自己的记录
CREATE POLICY "Users can update own employee data"
FOR UPDATE USING (auth.uid() = auth_user_id);

-- ❌ 缺少：允许插入自己的记录
```

**修复后的策略**（完整）：
```sql
-- ✅ 允许查看自己的记录
CREATE POLICY "Users can view own employee data"
FOR SELECT USING (auth.uid() = auth_user_id);

-- ✅ 允许更新自己的记录
CREATE POLICY "Users can update own employee data"
FOR UPDATE USING (auth.uid() = auth_user_id);

-- ✅ 允许插入自己的记录（新增！）
CREATE POLICY "Users can insert own employee record"
FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
```

### 为什么之前没有这个策略？

在原始的数据库迁移脚本中，我们假设员工记录是由管理员创建的，而不是用户自己创建。但现在我们允许用户注册并创建自己的记录，所以需要添加这个策略。

---

## 🛡️ 安全性说明

### 这个策略是安全的吗？

**是的！** 这个策略确保：

1. **只有已认证用户可以插入**
   - `TO authenticated` - 必须登录

2. **只能插入自己的记录**
   - `WITH CHECK (auth.uid() = auth_user_id)` - auth_user_id 必须等于当前用户的 ID

3. **不能插入其他人的记录**
   - 如果尝试插入 `auth_user_id` 不等于自己的记录，会被拒绝

### 示例

```sql
-- ✅ 允许：用户创建自己的记录
INSERT INTO employees (auth_user_id, name, ...)
VALUES ('5f45df36-...', 'John', ...);  -- auth_user_id = 当前用户 ID

-- ❌ 拒绝：用户尝试创建其他人的记录
INSERT INTO employees (auth_user_id, name, ...)
VALUES ('other-user-id', 'Jane', ...);  -- auth_user_id ≠ 当前用户 ID
```

---

## 📊 完整的 RLS 策略列表

修复后，`employees` 表应该有以下策略：

### 1. 查看（SELECT）策略
- ✅ `Public read on active employees` - 所有人可以查看活跃员工
- ✅ `Users can view own employee data` - 用户可以查看自己的记录
- ✅ `Site PS can view all employee data` - Site PS 可以查看所有记录
- ✅ `Admins can view all employee data` - 管理员可以查看所有记录

### 2. 插入（INSERT）策略
- ✅ `Users can insert own employee record` - 用户可以创建自己的记录 **（新增！）**

### 3. 更新（UPDATE）策略
- ✅ `Users can update own employee data` - 用户可以更新自己的记录
- ✅ `Admins can update all employee data` - 管理员可以更新所有记录

### 4. 删除（DELETE）策略
- （暂无，使用软删除 `is_active = false`）

---

## ✅ 检查清单

执行修复前：
- [ ] 已打开 Supabase Dashboard
- [ ] 已找到 SQL Editor
- [ ] 已复制 SQL 脚本

执行修复后：
- [ ] SQL 执行成功
- [ ] 看到新的策略在列表中
- [ ] 刷新应用页面
- [ ] 重新提交表单
- [ ] 成功创建员工记录
- [ ] 进入主界面

---

## 🆘 如果仍然失败

### 检查 1: 确认策略已创建
```sql
SELECT COUNT(*) 
FROM pg_policies 
WHERE tablename = 'employees' 
AND policyname = 'Users can insert own employee record';
```
**预期结果**: 1

### 检查 2: 确认 RLS 已启用
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'employees';
```
**预期结果**: `rowsecurity = true`

### 检查 3: 测试策略
```sql
-- 模拟插入（不会真正插入）
EXPLAIN (VERBOSE, COSTS OFF)
INSERT INTO employees (auth_user_id, employee_id, name, email, is_active)
VALUES (auth.uid(), 'TEST_001', 'Test User', 'test@bosch.com', true);
```

---

## 💡 替代方案（如果不想使用 RLS）

如果您不想使用 RLS，可以临时禁用：

```sql
-- ⚠️ 警告：这会降低安全性！
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
```

**不推荐**，因为这会允许任何人访问所有员工数据。

---

## 🎉 总结

**问题**: RLS 策略缺少 INSERT 权限  
**解决**: 添加 `Users can insert own employee record` 策略  
**结果**: 用户可以创建自己的员工记录

**现在请：**
1. 打开 Supabase Dashboard
2. 执行 `fix_rls_policy.sql`
3. 刷新应用并重新提交
4. 告诉我结果！

---

**生成时间**: 2026-01-15  
**状态**: 🔧 等待执行  
**预计时间**: 2 分钟

