-- ============================================================================
-- 数据库迁移验证脚本
-- 用途：验证 002_add_email_authentication.sql 是否成功执行
-- ============================================================================

-- 1. 检查 employees 表的新字段
SELECT 
  '1. employees 表新字段' as check_item,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'employees'
AND column_name IN ('auth_user_id', 'email', 'phone', 'last_login_at', 'login_count', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- 2. 检查唯一约束
SELECT 
  '2. 唯一约束' as check_item,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name = 'employees'
AND constraint_name IN ('employees_auth_user_id_unique', 'employees_email_unique');

-- 3. 检查邮箱域名约束
SELECT 
  '3. 邮箱域名约束' as check_item,
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
AND constraint_name = 'employees_email_domain_check';

-- 4. 检查索引
SELECT 
  '4. 索引' as check_item,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'employees'
AND indexname IN ('idx_employees_auth_user_id', 'idx_employees_email', 'idx_employees_last_login')
ORDER BY indexname;

-- 5. 检查触发器
SELECT 
  '5. 触发器' as check_item,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND trigger_schema = 'auth'
AND trigger_name = 'on_auth_user_created'
UNION ALL
SELECT 
  '5. 触发器' as check_item,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'employees'
AND trigger_schema = 'public'
AND trigger_name = 'update_employees_updated_at';

-- 6. 检查函数
SELECT 
  '6. 函数' as check_item,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'handle_new_auth_user',
  'update_updated_at_column',
  'get_employee_by_email',
  'bind_email_to_employee',
  'get_user_login_history'
)
ORDER BY routine_name;

-- 7. 检查 RLS 策略
SELECT 
  '7. RLS 策略' as check_item,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING 子句已设置'
    ELSE '无 USING 子句'
  END as has_using_clause
FROM pg_policies
WHERE tablename = 'employees'
ORDER BY policyname;

-- 8. 检查 RLS 是否启用
SELECT 
  '8. RLS 状态' as check_item,
  tablename,
  CASE 
    WHEN rowsecurity THEN 'RLS 已启用'
    ELSE 'RLS 未启用'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'employees';

-- ============================================================================
-- 验证总结
-- ============================================================================
DO $$
DECLARE
  field_count INT;
  constraint_count INT;
  index_count INT;
  trigger_count INT;
  function_count INT;
  policy_count INT;
BEGIN
  -- 统计各项数量
  SELECT COUNT(*) INTO field_count
  FROM information_schema.columns
  WHERE table_schema = 'public' 
  AND table_name = 'employees'
  AND column_name IN ('auth_user_id', 'email', 'phone', 'last_login_at', 'login_count', 'created_at', 'updated_at');
  
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
  AND table_name = 'employees'
  AND constraint_name IN ('employees_auth_user_id_unique', 'employees_email_unique', 'employees_email_domain_check');
  
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'employees'
  AND indexname IN ('idx_employees_auth_user_id', 'idx_employees_email', 'idx_employees_last_login');
  
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name IN (
    'handle_new_auth_user',
    'update_updated_at_column',
    'get_employee_by_email',
    'bind_email_to_employee',
    'get_user_login_history'
  );
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'employees';
  
  -- 输出验证结果
  RAISE NOTICE '
  ============================================================================
  📊 数据库迁移验证结果
  ============================================================================
  
  ✅ 新字段: % / 7 (预期 7 个)
  ✅ 约束: % / 3 (预期 3 个)
  ✅ 索引: % / 3 (预期 3 个)
  ✅ 函数: % / 5 (预期 5 个)
  ✅ RLS 策略: % / 6 (预期 6 个)
  
  %
  ============================================================================
  ', 
  field_count,
  constraint_count,
  index_count,
  function_count,
  policy_count,
  CASE 
    WHEN field_count = 7 AND constraint_count = 3 AND index_count = 3 AND function_count = 5 AND policy_count >= 6
    THEN '🎉 迁移完全成功！所有组件已正确创建。'
    ELSE '⚠️ 部分组件缺失，请检查上面的详细信息。'
  END;
END $$;

