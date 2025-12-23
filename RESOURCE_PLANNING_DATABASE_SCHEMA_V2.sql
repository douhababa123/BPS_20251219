-- ============================================================================
-- 资源规划模块数据库Schema V2 - 按天存储版本
-- Resource Planning Module Database Schema V2 - Daily Storage
-- ============================================================================
-- 创建日期: 2025-11-24
-- 说明: 修改为按天存储，支持TOPIC/TYPE/LOCATION结构
-- 变更: 从周范围改为单独日期存储
-- ============================================================================

-- ============================================================================
-- 1. 修改任务表结构（添加按天存储字段）
-- ============================================================================

-- 添加新字段
ALTER TABLE resource_planning_tasks
  ADD COLUMN IF NOT EXISTS task_date DATE,              -- 任务日期（按天）
  ADD COLUMN IF NOT EXISTS year_month TEXT,             -- 年月（如"2025-01"）
  ADD COLUMN IF NOT EXISTS cw_week TEXT,                -- 周数（如"CW01"）
  ADD COLUMN IF NOT EXISTS day_of_month INT,            -- 几号（1-31）
  ADD COLUMN IF NOT EXISTS task_type TEXT;              -- 任务类型（从TYPE行读取）

-- 添加注释
COMMENT ON COLUMN resource_planning_tasks.task_date IS '任务日期（按天存储）';
COMMENT ON COLUMN resource_planning_tasks.year_month IS '年月（YYYY-MM格式，用于分组）';
COMMENT ON COLUMN resource_planning_tasks.cw_week IS '周数（CW格式，用于显示）';
COMMENT ON COLUMN resource_planning_tasks.day_of_month IS '月份中的日期（1-31）';
COMMENT ON COLUMN resource_planning_tasks.task_type IS '任务类型（从Excel TYPE行读取）';

-- ============================================================================
-- 2. 创建新索引（按天查询优化）
-- ============================================================================

-- 按日期查询
CREATE INDEX IF NOT EXISTS idx_resource_tasks_date 
  ON resource_planning_tasks(task_date);

-- 按年月分组
CREATE INDEX IF NOT EXISTS idx_resource_tasks_year_month 
  ON resource_planning_tasks(year_month);

-- 按周数查询
CREATE INDEX IF NOT EXISTS idx_resource_tasks_cw_week 
  ON resource_planning_tasks(cw_week);

-- 复合索引：员工+日期（高频查询）
DROP INDEX IF EXISTS idx_resource_tasks_emp_date;
DROP INDEX IF EXISTS idx_resource_tasks_emp_date_v2;
CREATE INDEX IF NOT EXISTS idx_resource_tasks_emp_date_v2
  ON resource_planning_tasks(employee_id, task_date);

-- ============================================================================
-- 3. 更新视图：按天显示最新版本
-- ============================================================================

DROP VIEW IF EXISTS view_resource_planning_latest;

CREATE OR REPLACE VIEW view_resource_planning_latest AS
WITH ranked_tasks AS (
  SELECT 
    rpt.*,
    e.name AS employee_name,
    e.employee_id AS employee_code,
    d.name AS department_name,
    ROW_NUMBER() OVER (
      PARTITION BY rpt.employee_id, rpt.task_date
      ORDER BY rpt.imported_at DESC
    ) AS rn
  FROM resource_planning_tasks rpt
  LEFT JOIN employees e ON rpt.employee_id = e.id
  LEFT JOIN departments d ON e.department_id = d.id
  WHERE rpt.task_date IS NOT NULL  -- 只显示按天存储的记录
)
SELECT 
  id,
  employee_id,
  employee_name,
  employee_code,
  department_name,
  task_date,
  year_month,
  cw_week,
  day_of_month,
  topic,
  task_type,
  location,
  notes,
  imported_at,
  import_batch_id,
  source_file_name,
  created_at,
  updated_at
FROM ranked_tasks
WHERE rn = 1;

COMMENT ON VIEW view_resource_planning_latest IS '资源规划最新版本任务视图（按天存储）';

-- ============================================================================
-- 4. 辅助函数：日期转周数
-- ============================================================================

CREATE OR REPLACE FUNCTION date_to_cw_week(input_date DATE)
RETURNS TEXT AS $$
DECLARE
  week_num INT;
BEGIN
  -- 计算ISO周数
  week_num := EXTRACT(WEEK FROM input_date);
  RETURN 'CW' || LPAD(week_num::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION date_to_cw_week IS '将日期转换为CW格式周数';

-- ============================================================================
-- 5. 辅助函数：提取年月
-- ============================================================================

CREATE OR REPLACE FUNCTION date_to_year_month(input_date DATE)
RETURNS TEXT AS $$
BEGIN
  RETURN TO_CHAR(input_date, 'YYYY-MM');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION date_to_year_month IS '将日期转换为年月字符串';

-- ============================================================================
-- 6. 触发器：自动填充年月和周数
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_fill_date_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_date IS NOT NULL THEN
    NEW.year_month := date_to_year_month(NEW.task_date);
    NEW.cw_week := date_to_cw_week(NEW.task_date);
    NEW.day_of_month := EXTRACT(DAY FROM NEW.task_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_fill_date_fields ON resource_planning_tasks;
CREATE TRIGGER trigger_auto_fill_date_fields
  BEFORE INSERT OR UPDATE OF task_date
  ON resource_planning_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_date_fields();

-- ============================================================================
-- 7. 验证和约束
-- ============================================================================

-- 添加约束：task_date必须有值（新导入模式）
-- 注意：为了兼容旧数据，暂不添加NOT NULL约束

-- 添加注释
COMMENT ON TABLE resource_planning_tasks IS '资源规划任务表（支持按天和按范围两种模式）';

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Resource Planning Database Schema V2 Updated Successfully!';
  RAISE NOTICE '📊 Table: resource_planning_tasks (modified)';
  RAISE NOTICE '📅 New Storage Mode: Daily (task_date field)';
  RAISE NOTICE '🔍 View: view_resource_planning_latest (updated)';
  RAISE NOTICE '🎯 New Fields: task_date, year_month, cw_week, day_of_month, task_type';
  RAISE NOTICE '⚡ Indexes: Created for daily queries';
  RAISE NOTICE '🔄 Triggers: Auto-fill year_month, cw_week, day_of_month';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '   1. Run this SQL in Supabase SQL Editor';
  RAISE NOTICE '   2. Update excelResourceParser.ts for 3-header-row format';
  RAISE NOTICE '   3. Test import with real Excel file';
END $$;
