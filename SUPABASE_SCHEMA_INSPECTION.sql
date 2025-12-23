-- Purpose: 快速查看 Supabase 现有表/视图的结构与索引，不做任何写操作。
-- How to use: 直接在 Supabase SQL 编辑器运行整份脚本，按需复制输出结果。
-- Notes: 仅依赖 information_schema 与系统视图，安全可重复执行。
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('pg_temp.tmp_target_tables') IS NULL THEN
    CREATE TEMP TABLE tmp_target_tables(table_name text PRIMARY KEY);
  END IF;
  TRUNCATE tmp_target_tables;
  INSERT INTO tmp_target_tables(table_name) VALUES
    ('competency_assessments'),
    ('competency_definitions'),
    ('departments'),
    ('employees'),
    ('factories'),
    ('resource_planning_tasks'),
    ('resource_task_types'),
    ('skills'),
    ('task_types'),
    ('tasks'),
    ('test_table'),
    ('view_assessments_full'),
    ('view_department_gaps'),
    ('view_employee_gaps'),
    ('view_resource_planning_latest'),
    ('view_skill_gaps');
END $$;

-- --------------------------------------------------------------------------
-- Column definitions for all target tables
-- --------------------------------------------------------------------------
SELECT tt.table_name,
       c.ordinal_position,
       c.column_name,
       c.data_type,
       c.is_nullable,
       c.column_default
FROM tmp_target_tables tt
JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = tt.table_name
ORDER BY tt.table_name, c.ordinal_position;

-- --------------------------------------------------------------------------
-- Indexes for all target tables
-- --------------------------------------------------------------------------
SELECT idx.schemaname,
       idx.tablename,
       idx.indexname,
       idx.indexdef
FROM pg_indexes idx
JOIN tmp_target_tables tt
  ON idx.schemaname = 'public' AND idx.tablename = tt.table_name
ORDER BY idx.tablename, idx.indexname;

-- --------------------------------------------------------------------------
-- Foreign keys for all target tables
-- --------------------------------------------------------------------------
SELECT con.conname AS constraint_name,
       conrelid::regclass AS table_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN tmp_target_tables tt
  ON con.conrelid = ('public.' || tt.table_name)::regclass
WHERE con.contype = 'f'
ORDER BY conrelid::regclass::text, con.conname;

-- --------------------------------------------------------------------------
-- View definitions (only returns rows for views in the list)
-- --------------------------------------------------------------------------
SELECT v.table_name,
       pg_get_viewdef((quote_ident(v.table_schema) || '.' || quote_ident(v.table_name))::regclass, true) AS view_definition
FROM information_schema.views v
JOIN tmp_target_tables tt
  ON v.table_schema = 'public' AND v.table_name = tt.table_name
ORDER BY v.table_name;

-- --------------------------------------------------------------------------
-- Sample row query helper (produces ready-to-run SELECT statements)
-- --------------------------------------------------------------------------
SELECT format('SELECT * FROM %I.%I LIMIT 10;', 'public', table_name) AS sample_query
FROM tmp_target_tables
ORDER BY table_name;
