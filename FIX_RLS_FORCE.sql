-- ============================================================================
-- 强制修复RLS策略
-- Force Fix RLS Policy
-- ============================================================================

-- 第1步：删除所有现有策略
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'resource_planning_tasks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON resource_planning_tasks', r.policyname);
    RAISE NOTICE '🗑️ 删除策略: %', r.policyname;
  END LOOP;
END $$;

-- 第2步：禁用RLS
ALTER TABLE resource_planning_tasks DISABLE ROW LEVEL SECURITY;

-- 第3步：验证RLS状态
SELECT 
  schemaname,
  tablename,
  rowsecurity AS "RLS启用状态（应为false）"
FROM pg_tables 
WHERE tablename = 'resource_planning_tasks';

-- 第4步：验证没有策略
SELECT 
  COUNT(*) AS "策略数量（应为0）"
FROM pg_policies 
WHERE tablename = 'resource_planning_tasks';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS已强制禁用！';
  RAISE NOTICE '📊 Table: resource_planning_tasks';
  RAISE NOTICE '🔓 RLS Status: DISABLED';
  RAISE NOTICE '🗑️ All policies: REMOVED';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Step:';
  RAISE NOTICE '   1. 刷新浏览器（Ctrl+F5 或 Cmd+Shift+R）';
  RAISE NOTICE '   2. 重新测试导入功能';
  RAISE NOTICE '';
END $$;
