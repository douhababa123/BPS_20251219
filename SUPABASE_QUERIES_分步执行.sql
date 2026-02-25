-- ============================================================================
-- Supabase 表结构查询 - 分步执行版本
-- 在 Supabase Dashboard → SQL Editor 中逐个复制执行以下查询
-- ============================================================================

-- ============================================================================
-- 查询 1：查看所有表及精确行数（推荐先运行此查询）
-- ============================================================================
SELECT 'departments' AS table_name, COUNT(*) AS row_count FROM departments
UNION ALL
SELECT 'employees', COUNT(*) FROM employees
UNION ALL
SELECT 'factories', COUNT(*) FROM factories
UNION ALL
SELECT 'task_types', COUNT(*) FROM task_types
UNION ALL
SELECT 'skills', COUNT(*) FROM skills
UNION ALL
SELECT 'competency_definitions', COUNT(*) FROM competency_definitions
UNION ALL
SELECT 'competency_assessments', COUNT(*) FROM competency_assessments
UNION ALL
SELECT 'resource_task_types', COUNT(*) FROM resource_task_types
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'resource_planning_tasks', COUNT(*) FROM resource_planning_tasks
UNION ALL
SELECT 'schedule_change_notifications', COUNT(*) FROM schedule_change_notifications
ORDER BY table_name;


-- ============================================================================
-- 查询 2：查看所有表的字段详情（字段名、类型、是否可空、默认值）
-- ============================================================================
SELECT 
    table_name,
    ordinal_position AS position,
    column_name,
    data_type,
    CASE 
        WHEN character_maximum_length IS NOT NULL THEN data_type || '(' || character_maximum_length || ')'
        WHEN data_type = 'uuid' THEN 'uuid'
        WHEN data_type = 'timestamp with time zone' THEN 'timestamptz'
        WHEN data_type = 'timestamp without time zone' THEN 'timestamp'
        ELSE data_type
    END AS full_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'departments',
    'employees',
    'factories',
    'task_types',
    'skills',
    'competency_definitions',
    'competency_assessments',
    'resource_task_types',
    'tasks',
    'resource_planning_tasks',
    'schedule_change_notifications'
  )
ORDER BY table_name, ordinal_position;


-- ============================================================================
-- 查询 3：查看外键关系（了解表之间的依赖）
-- ============================================================================
SELECT
    tc.table_name AS from_table,
    kcu.column_name AS from_column,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'departments',
    'employees',
    'factories',
    'task_types',
    'skills',
    'competency_definitions',
    'competency_assessments',
    'resource_task_types',
    'tasks',
    'resource_planning_tasks',
    'schedule_change_notifications'
  )
ORDER BY tc.table_name, kcu.ordinal_position;


-- ============================================================================
-- 查询 4：查看主键信息
-- ============================================================================
SELECT 
    tc.table_name,
    kcu.column_name AS primary_key_column,
    c.data_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.columns c
    ON c.table_schema = kcu.table_schema
    AND c.table_name = kcu.table_name
    AND c.column_name = kcu.column_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'departments',
    'employees',
    'factories',
    'task_types',
    'skills',
    'competency_definitions',
    'competency_assessments',
    'resource_task_types',
    'tasks',
    'resource_planning_tasks',
    'schedule_change_notifications'
  )
ORDER BY tc.table_name;


-- ============================================================================
-- 快速导出清单
-- ============================================================================
-- 复制下面的结果，按顺序在 Table Editor 中导出 CSV：

/*
导出顺序（避免外键冲突）：

第一批（无依赖）：
1. departments
2. factories
3. task_types
4. resource_task_types
5. skills
6. competency_definitions

第二批（依赖第一批）：
7. employees (依赖 departments)

第三批（依赖 employees）：
8. competency_assessments
9. tasks
10. resource_planning_tasks
11. schedule_change_notifications
*/
