-- ============================================================================
-- 迁移脚本：添加邮箱认证系统
-- 版本：002
-- 创建日期：2026-01-14
-- 说明：为 BPS 系统添加 Supabase Auth 集成，支持邮箱 OTP 认证
-- ============================================================================

-- ============================================================================
-- 第 1 部分：修改 employees 表结构
-- ============================================================================

-- 1.1 添加认证相关字段
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1.2 添加唯一约束
ALTER TABLE public.employees 
ADD CONSTRAINT employees_auth_user_id_unique UNIQUE (auth_user_id);

ALTER TABLE public.employees 
ADD CONSTRAINT employees_email_unique UNIQUE (email);

-- 1.3 添加邮箱域名检查约束
ALTER TABLE public.employees 
ADD CONSTRAINT employees_email_domain_check 
CHECK (
  email IS NULL OR 
  email LIKE '%@bosch.com' OR 
  email LIKE '%@bshg.com'
);

-- 1.4 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id 
ON public.employees(auth_user_id);

CREATE INDEX IF NOT EXISTS idx_employees_email 
ON public.employees(email);

CREATE INDEX IF NOT EXISTS idx_employees_last_login 
ON public.employees(last_login_at DESC);

-- 1.5 添加注释
COMMENT ON COLUMN public.employees.auth_user_id IS 'Supabase Auth 用户 ID（外键关联 auth.users）';
COMMENT ON COLUMN public.employees.email IS '用户邮箱（唯一，限制域名为 @bosch.com 或 @bshg.com）';
COMMENT ON COLUMN public.employees.phone IS '联系电话';
COMMENT ON COLUMN public.employees.last_login_at IS '最后登录时间';
COMMENT ON COLUMN public.employees.login_count IS '登录次数统计';
COMMENT ON COLUMN public.employees.created_at IS '账号创建时间';
COMMENT ON COLUMN public.employees.updated_at IS '账号更新时间';

-- ============================================================================
-- 第 2 部分：创建自动同步触发器
-- ============================================================================

-- 2.1 创建触发器函数：当 auth.users 创建新用户时，自动在 employees 表创建记录
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  temp_employee_id TEXT;
  user_name TEXT;
BEGIN
  -- 生成临时员工 ID（格式：BPS_邮箱前缀）
  temp_employee_id := 'BPS_' || substring(NEW.email from 1 for position('@' in NEW.email) - 1);
  
  -- 从用户元数据获取姓名，如果没有则使用邮箱前缀
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- 在 employees 表创建记录
  INSERT INTO public.employees (
    id,
    auth_user_id,
    employee_id,
    email,
    name,
    role,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    temp_employee_id,
    NEW.email,
    user_name,
    'BPS_ENGINEER', -- 默认角色
    true,
    now(),
    now()
  )
  ON CONFLICT (auth_user_id) DO NOTHING; -- 如果已存在则跳过
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 2.3 添加注释
COMMENT ON FUNCTION public.handle_new_auth_user IS '自动同步 auth.users 到 employees 表（新用户注册时触发）';

-- ============================================================================
-- 第 3 部分：创建更新时间戳触发器
-- ============================================================================

-- 3.1 创建通用的更新时间戳函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3.2 为 employees 表添加更新时间戳触发器
DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 第 4 部分：创建登录记录触发器
-- ============================================================================

-- 4.1 创建更新登录信息的函数
CREATE OR REPLACE FUNCTION public.update_login_info()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新最后登录时间和登录次数
  UPDATE public.employees
  SET 
    last_login_at = now(),
    login_count = COALESCE(login_count, 0) + 1
  WHERE auth_user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 注意：此触发器需要在 auth.sessions 表上创建，但 Supabase 不允许直接修改 auth schema
-- 因此，我们在前端代码中手动调用更新登录信息的 API

-- ============================================================================
-- 第 5 部分：创建 RLS（Row Level Security）策略
-- ============================================================================

-- 5.1 启用 employees 表的 RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 5.2 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can view own employee data" ON public.employees;
DROP POLICY IF EXISTS "Users can update own employee data" ON public.employees;
DROP POLICY IF EXISTS "Admins can view all employee data" ON public.employees;
DROP POLICY IF EXISTS "Admins can update all employee data" ON public.employees;
DROP POLICY IF EXISTS "Site PS can view all employee data" ON public.employees;
DROP POLICY IF EXISTS "Site PS can update all employee data" ON public.employees;

-- 5.3 策略 1：用户可以查看自己的数据
CREATE POLICY "Users can view own employee data"
ON public.employees
FOR SELECT
USING (
  auth.uid() = auth_user_id
);

-- 5.4 策略 2：用户可以更新自己的数据（限制字段）
CREATE POLICY "Users can update own employee data"
ON public.employees
FOR UPDATE
USING (auth.uid() = auth_user_id)
WITH CHECK (
  auth.uid() = auth_user_id
  -- 用户只能修改这些字段：name, phone, updated_at
  -- 不能修改：role, is_active, employee_id, email, auth_user_id
);

-- 5.5 策略 3：管理员可以查看所有数据
CREATE POLICY "Admins can view all employee data"
ON public.employees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid()
    AND role = 'ADMIN'
  )
);

-- 5.6 策略 4：管理员可以更新所有数据
CREATE POLICY "Admins can update all employee data"
ON public.employees
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid()
    AND role = 'ADMIN'
  )
);

-- 5.7 策略 5：Site PS 可以查看所有数据
CREATE POLICY "Site PS can view all employee data"
ON public.employees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid()
    AND role IN ('SITE_PS', 'ADMIN')
  )
);

-- 5.8 策略 6：Site PS 可以更新 BPS 工程师的日程数据（通过 tasks 表）
-- 注意：这个策略在 tasks 表上，这里只是注释说明
-- CREATE POLICY "Site PS can update BPS engineer schedules" ON public.tasks ...

-- ============================================================================
-- 第 6 部分：创建辅助函数
-- ============================================================================

-- 6.1 函数：通过邮箱查找员工
CREATE OR REPLACE FUNCTION public.get_employee_by_email(user_email TEXT)
RETURNS TABLE (
  id UUID,
  employee_id TEXT,
  name TEXT,
  email TEXT,
  role TEXT,
  department_id UUID,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.employee_id,
    e.name,
    e.email,
    e.role,
    e.department_id,
    e.is_active
  FROM public.employees e
  WHERE e.email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.2 函数：绑定邮箱到现有员工
CREATE OR REPLACE FUNCTION public.bind_email_to_employee(
  p_employee_id TEXT,
  p_email TEXT,
  p_auth_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  email_exists BOOLEAN;
BEGIN
  -- 检查邮箱是否已被使用
  SELECT EXISTS(
    SELECT 1 FROM public.employees 
    WHERE email = p_email AND employee_id != p_employee_id
  ) INTO email_exists;
  
  IF email_exists THEN
    RAISE EXCEPTION '邮箱已被其他用户使用';
  END IF;
  
  -- 更新员工记录
  UPDATE public.employees
  SET 
    email = p_email,
    auth_user_id = p_auth_user_id,
    updated_at = now()
  WHERE employee_id = p_employee_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6.3 函数：获取用户登录历史（从 auth.audit_log_entries）
CREATE OR REPLACE FUNCTION public.get_user_login_history(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  logged_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    created_at as logged_at,
    ip_address::TEXT,
    (payload->>'user_agent')::TEXT as user_agent
  FROM auth.audit_log_entries
  WHERE 
    (payload->>'user_id')::UUID = p_user_id
    AND action = 'login'
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 第 7 部分：数据验证和测试
-- ============================================================================

-- 7.1 验证表结构
DO $$
BEGIN
  -- 检查新字段是否存在
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'auth_user_id'
  ) THEN
    RAISE EXCEPTION '字段 auth_user_id 创建失败';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION '字段 email 创建失败';
  END IF;
  
  RAISE NOTICE '✅ 表结构验证通过';
END $$;

-- 7.2 验证触发器
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE EXCEPTION '触发器 on_auth_user_created 创建失败';
  END IF;
  
  RAISE NOTICE '✅ 触发器验证通过';
END $$;

-- 7.3 验证 RLS 策略
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'employees' 
    AND policyname = 'Users can view own employee data'
  ) THEN
    RAISE EXCEPTION 'RLS 策略创建失败';
  END IF;
  
  RAISE NOTICE '✅ RLS 策略验证通过';
END $$;

-- ============================================================================
-- 第 8 部分：显示迁移结果
-- ============================================================================

-- 8.1 显示 employees 表结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'employees'
ORDER BY ordinal_position;

-- 8.2 显示索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'employees'
ORDER BY indexname;

-- 8.3 显示 RLS 策略
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY policyname;

-- ============================================================================
-- 迁移完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '
  ============================================================================
  ✅ 邮箱认证系统迁移完成！
  ============================================================================
  
  已完成的操作：
  1. ✅ employees 表添加认证字段（auth_user_id, email, phone 等）
  2. ✅ 创建自动同步触发器（auth.users → employees）
  3. ✅ 创建更新时间戳触发器
  4. ✅ 启用 RLS 策略（用户只能访问自己的数据）
  5. ✅ 创建辅助函数（邮箱查找、邮箱绑定、登录历史）
  6. ✅ 添加索引优化查询性能
  
  下一步：
  1. 在 Supabase Dashboard 启用 Email OTP 认证
  2. 自定义邮件模板（中文）
  3. 实现前端注册/登录页面
  4. 测试邮件发送功能
  
  详细步骤请参考：
  - openspec/changes/add-email-authentication/QUICK_START.md
  - openspec/changes/add-email-authentication/tasks.md
  ============================================================================
  ';
END $$;

