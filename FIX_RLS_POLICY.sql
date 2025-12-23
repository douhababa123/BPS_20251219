-- ============================================================================
-- 修复资源规划表RLS策略
-- Fix RLS Policy for Resource Planning Tasks
-- ============================================================================
-- 问题：new row violates row-level security policy
-- 原因：RLS策略阻止了数据插入
-- 解决：更新RLS策略，允许认证用户插入数据
-- ============================================================================

-- ============================================================================
-- 方案A：临时禁用RLS（快速测试）
-- ============================================================================
-- 说明：关闭RLS，允许所有操作（仅用于测试和导入）
-- 警告：生产环境需要重新启用RLS

ALTER TABLE resource_planning_tasks DISABLE ROW LEVEL SECURITY;

-- 验证
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'resource_planning_tasks';
-- rowsecurity 应该显示为 false

-- ============================================================================
-- 方案B：修复RLS策略（生产环境推荐）
-- ============================================================================
-- 说明：保持RLS启用，但修改策略允许插入

-- 1. 启用RLS
ALTER TABLE resource_planning_tasks ENABLE ROW LEVEL SECURITY;

-- 2. 删除所有旧策略
DROP POLICY IF EXISTS "Allow authenticated users to read resource_planning_tasks" ON resource_planning_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert resource_planning_tasks" ON resource_planning_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update resource_planning_tasks" ON resource_planning_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete resource_planning_tasks" ON resource_planning_tasks;

-- 3. 创建新策略（宽松版本）
CREATE POLICY "resource_planning_tasks_select_policy"
  ON resource_planning_tasks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "resource_planning_tasks_insert_policy"
  ON resource_planning_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "resource_planning_tasks_update_policy"
  ON resource_planning_tasks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "resource_planning_tasks_delete_policy"
  ON resource_planning_tasks
  FOR DELETE
  TO authenticated
  USING (true);

-- 4. 验证策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'resource_planning_tasks';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS Policy Fixed!';
  RAISE NOTICE '📊 Table: resource_planning_tasks';
  RAISE NOTICE '🔐 Policies: Updated for authenticated users';
  RAISE NOTICE '';
  RAISE NOTICE '💡 建议：';
  RAISE NOTICE '   - 测试阶段：使用方案A（禁用RLS）';
  RAISE NOTICE '   - 生产环境：使用方案B（启用RLS + 修复策略）';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Step:';
  RAISE NOTICE '   重新测试导入功能';
END $$;
