-- ============================================================================
-- Schedule Module - Data Check and Fix
-- ============================================================================

-- ============================================================================

-- Step 0: Ensure required tables exist (minimal schema)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS task_types (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  color_hex text NOT NULL,
  description text,
  is_system boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS factories (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text,
  region text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_name text,
  task_type text,
  task_location text,
  assigned_employee_id uuid,
  start_date date,
  end_date date,
  days_count int,
  hours_per_day int DEFAULT 8,
  total_hours int,
  source text,
  status text,
  is_cross_factory boolean,
  request_factory text,
  required_skills text[],
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- Step 1: Inspect data volumes
-- ============================================================================

=======

-- Step 0: Ensure required tables exist (minimal schema)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS task_types (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  color_hex text NOT NULL,
  description text,
  is_system boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS factories (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text,
  region text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_name text,
  task_type text,
  task_location text,
  assigned_employee_id uuid,
  start_date date,
  end_date date,
  days_count int,
  hours_per_day int DEFAULT 8,
  total_hours int,
  source text,
  status text,
  is_cross_factory boolean,
  request_factory text,
  required_skills text[],
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- Step 1: Inspect data volumes
-- ============================================================================

=======
-- Step 1: Inspect data volumes
-- ============================================================================


SELECT 'task_types row count' AS check_item, COUNT(*) AS count FROM task_types;
SELECT 'factories row count' AS check_item, COUNT(*) AS count FROM factories;
SELECT 'tasks row count' AS check_item, COUNT(*) AS count FROM tasks;

-- ============================================================================
-- Step 2: Seed task_types (skips rows that already exist)
-- ============================================================================



INSERT INTO task_types (code, name, color_hex, is_system, is_active)
VALUES
  ('workshop', 'Workshop', '#3B82F6', true, true),
  ('speed_week', 'Speed week', '#8B5CF6', true, true),
  ('project', 'Project', '#10B981', true, true),
  ('training', 'Training', '#F59E0B', true, true),
  ('coaching', 'Coaching', '#EF4444', true, true),
  ('meeting', 'Meeting', '#6366F1', true, true),
  ('leave', 'Leave', '#64748B', true, true),
  ('self_develop', 'Self-develop', '#14B8A6', true, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================

-- Step 3: Seed factories (codes only, skip existing codes; label = code)
-- ============================================================================

WITH new_factories(code, is_active) AS (
  VALUES
    ('FLCNa', true),
    ('FLCCh', true),
    ('FCGNa', true),
    ('FEDNa', true),
    ('FCLCh', true),
    ('FDCCh', true),
    ('GPU-SU', true),
    ('EA', true),
    ('HA', true)
)
INSERT INTO factories (code, name, is_active)
SELECT code, code AS name, is_active FROM new_factories

-- Step 3: Seed factories (codes only, skip existing codes)
-- ============================================================================

INSERT INTO factories (code, is_active)
VALUES
  ('FLCNa', true),
  ('FLCCh', true),
  ('FCGNa', true),
  ('FEDNa', true),
  ('FCLCh', true),
  ('FDCCh', true),
  ('GPU-SU', true),
  ('EA', true),
  ('HA', true)

ON CONFLICT (code) DO NOTHING;

WITH new_task_types(code, name, color_hex, is_system, is_active) AS (
  VALUES
    ('workshop', 'Workshop', '#3B82F6', true, true),
    ('speed_week', 'Speed week', '#8B5CF6', true, true),
    ('project', 'Project', '#10B981', true, true),
    ('training', 'Training', '#F59E0B', true, true),
    ('coaching', 'Coaching', '#EF4444', true, true),
    ('meeting', 'Meeting', '#6366F1', true, true),
    ('leave', 'Leave', '#64748B', true, true),
    ('self_develop', 'Self-develop', '#14B8A6', true, true)
)
INSERT INTO task_types (code, name, color_hex, is_system, is_active)
SELECT code, name, color_hex, is_system, is_active
FROM new_task_types nts
WHERE NOT EXISTS (
  SELECT 1 FROM task_types t WHERE t.code = nts.code
);

-- Backfill labels for any pre-existing rows that lack a name
UPDATE factories
SET name = COALESCE(NULLIF(name, ''), code)
WHERE name IS NULL OR name = '';

-- ============================================================================

-- Step 4: Validate seeded data
-- ============================================================================

SELECT 'task_types active rows (expected 8)' AS check_item, COUNT(*) AS count FROM task_types WHERE is_active = true;
SELECT 'factories active rows (expected 9)' AS check_item, COUNT(*) AS count FROM factories WHERE is_active = true;
SELECT id, code, name, color_hex FROM task_types ORDER BY id;
SELECT id, code, name, is_active FROM factories ORDER BY id;

-- Step 3: Seed factories (English-only labels, skip existing codes)
-- ============================================================================

WITH new_factories(code, name, region, is_active) AS (
  VALUES
    ('FLCNa', 'Ford Lincoln North America', 'North America', true),
    ('FLCCh', 'Ford Lincoln China', 'China', true),
    ('FCGNa', 'Ford Commercial North America', 'North America', true),
    ('FEDNa', 'Ford Electric North America', 'North America', true),
    ('FCLCh', 'Ford Commercial China', 'China', true),
    ('FDCCh', 'Ford Design China', 'China', true),
    ('GPU-SU', 'GPU Supplier', 'Global', true),
    ('EA', 'EA', 'Global', true),
    ('HA', 'HA', 'Global', true)
)
INSERT INTO factories (code, name, region, is_active)
SELECT code, name, region, is_active
FROM new_factories nf
WHERE NOT EXISTS (
  SELECT 1 FROM factories f WHERE f.code = nf.code
);


-- ============================================================================
-- Step 4: Validate seeded data
-- ============================================================================

SELECT 'task_types active rows (expected 8)' AS check_item, COUNT(*) AS count FROM task_types WHERE is_active = true;
SELECT 'factories active rows (expected 9)' AS check_item, COUNT(*) AS count FROM factories WHERE is_active = true;
SELECT id, code, name, color_hex FROM task_types ORDER BY id;
SELECT id, code, name, region FROM factories ORDER BY id;


-- ============================================================================
-- Completion notes
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Schedule Module Data Check and Fix Complete!';
  RAISE NOTICE '📊 Task Types: review the query results above';
  RAISE NOTICE '🏭 Factories: review the query results above';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '   1. Confirm task_types has 8 active records';
  RAISE NOTICE '   2. Confirm factories has 9 active records';
  RAISE NOTICE '   3. Refresh the browser (Ctrl+Shift+R)';
  RAISE NOTICE '   4. Test the "New Task" form – dropdowns should have options';
END $$;
