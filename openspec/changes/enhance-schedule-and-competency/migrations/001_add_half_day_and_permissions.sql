-- ========================================
-- 数据库迁移脚本：日程管理半天粒度 + 权限管理
-- 变更ID：enhance-schedule-and-competency
-- 日期：2025-12-23
-- ========================================

-- ========================================
-- 第一步：为 employees 表添加 role 字段
-- ========================================

-- 添加 role 列（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.employees 
    ADD COLUMN role TEXT DEFAULT 'BPS_ENGINEER' 
    CHECK (role IN ('BPS_ENGINEER', 'SITE_PS', 'ADMIN'));
    
    COMMENT ON COLUMN public.employees.role IS '用户角色：BPS_ENGINEER=普通工程师, SITE_PS=Site PS管理员, ADMIN=系统管理员';
  END IF;
END $$;

-- 创建角色索引（提升权限查询性能）
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);

-- ========================================
-- 第二步：配置 Site PS 用户权限
-- ========================================

-- 注意：如果 Liu Kui 尚未在数据库中，需要先添加：
-- INSERT INTO public.employees (employee_id, name, department_id, email, position, is_active)
-- VALUES ('SWa-PS_Liu_Kui', 'Liu Kui', 4, 'liu.kui@bosch.com', 'Site PS', true);

-- 为 Wang Ning 和 Liu Kui 设置 Site PS 权限
UPDATE public.employees 
SET role = 'SITE_PS' 
WHERE employee_id IN ('SWa-PS_Wang_Ning', 'SWa-PS_Liu_Kui');

COMMENT ON TABLE public.employees IS '员工信息表（已扩展：包含角色权限）';

-- ========================================
-- 第三步：为 tasks 表添加 time_slot 字段
-- ========================================

-- 修改 total_hours 和 hours_per_day 为 numeric 类型（支持小数）
ALTER TABLE public.tasks 
ALTER COLUMN total_hours TYPE NUMERIC(6,1);

ALTER TABLE public.tasks 
ALTER COLUMN hours_per_day TYPE NUMERIC(4,1);

-- 添加 time_slot 列（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'time_slot'
  ) THEN
    ALTER TABLE public.tasks 
    ADD COLUMN time_slot TEXT DEFAULT 'FULL_DAY' 
    CHECK (time_slot IN ('AM', 'PM', 'FULL_DAY'));
    
    COMMENT ON COLUMN public.tasks.time_slot IS '时间槽：AM=上午(3.5h), PM=下午(4.5h), FULL_DAY=全天(8h)';
  END IF;
END $$;

-- 创建时间槽索引（提升日历查询性能）
CREATE INDEX IF NOT EXISTS idx_tasks_time_slot ON public.tasks(time_slot);

-- 创建复合索引（按员工和日期查询时间槽）
CREATE INDEX IF NOT EXISTS idx_tasks_employee_date_slot 
ON public.tasks(assigned_employee_id, start_date, time_slot);

-- ========================================
-- 第四步：创建日程变更通知表
-- ========================================

CREATE TABLE IF NOT EXISTS public.schedule_change_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 通知接收人（被修改日程的工程师）
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- 通知发起人（修改日程的 Site PS）
  modifier_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- 关联的任务
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  
  -- 变更类型
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE')),
  
  -- 变更详情（JSON格式，存储修改前后的值）
  change_details JSONB,
  
  -- 已读标记
  is_read BOOLEAN DEFAULT false,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- 约束：修改人和被修改人不能相同（自己修改自己不触发通知）
  CHECK (employee_id != modifier_id)
);

-- 注释
COMMENT ON TABLE public.schedule_change_notifications IS '日程变更通知表（Site PS修改工程师日程时触发）';
COMMENT ON COLUMN public.schedule_change_notifications.employee_id IS '接收通知的工程师ID';
COMMENT ON COLUMN public.schedule_change_notifications.modifier_id IS '修改人（Site PS）ID';
COMMENT ON COLUMN public.schedule_change_notifications.change_type IS '变更类型：CREATE=新建, UPDATE=修改, DELETE=删除';
COMMENT ON COLUMN public.schedule_change_notifications.change_details IS '变更详情JSON，格式：{"field": {"old": "旧值", "new": "新值"}}';

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_notifications_employee_unread 
ON public.schedule_change_notifications(employee_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON public.schedule_change_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_modifier 
ON public.schedule_change_notifications(modifier_id);

-- ========================================
-- 第五步：更新现有触发器（兼容半天任务）
-- ========================================

-- 修改工时计算触发器，支持半天任务
CREATE OR REPLACE FUNCTION calculate_task_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- 计算任务天数
  NEW.days_count := NEW.end_date - NEW.start_date + 1;
  
  -- 根据时间槽计算总工时
  IF NEW.time_slot IS NULL OR NEW.time_slot = 'FULL_DAY' THEN
    -- 整天任务：使用 hours_per_day（通常为8小时）
    NEW.total_hours := NEW.days_count * COALESCE(NEW.hours_per_day, 8);
  ELSIF NEW.time_slot = 'AM' THEN
    -- 上午任务：3.5小时 × 天数
    NEW.total_hours := NEW.days_count * 3.5;
  ELSIF NEW.time_slot = 'PM' THEN
    -- 下午任务：4.5小时 × 天数
    NEW.total_hours := NEW.days_count * 4.5;
  ELSE
    -- 默认兜底
    NEW.total_hours := NEW.days_count * COALESCE(NEW.hours_per_day, 8);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 重新创建触发器
DROP TRIGGER IF EXISTS trigger_calculate_task_hours ON public.tasks;
CREATE TRIGGER trigger_calculate_task_hours
  BEFORE INSERT OR UPDATE OF start_date, end_date, hours_per_day, time_slot
  ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION calculate_task_hours();

-- ========================================
-- 第六步：数据验证查询（迁移后验证）
-- ========================================

-- 查询1：验证 role 字段已添加
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'employees' AND column_name = 'role';

-- 查询2：验证 time_slot 字段已添加
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'tasks' AND column_name = 'time_slot';

-- 查询3：验证通知表已创建
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'schedule_change_notifications';

-- 查询4：检查现有员工的角色分配
-- SELECT id, employee_id, name, role FROM public.employees ORDER BY role, name;

-- 查询5：检查现有任务的时间槽（应全为 FULL_DAY）
-- SELECT task_name, start_date, time_slot, total_hours FROM public.tasks LIMIT 10;

-- ========================================
-- 回滚脚本（如需回滚，请执行以下命令）
-- ========================================

-- 警告：回滚会删除新增的字段和表，请谨慎操作！

-- DROP INDEX IF EXISTS idx_employees_role;
-- ALTER TABLE public.employees DROP COLUMN IF EXISTS role;

-- DROP INDEX IF EXISTS idx_tasks_time_slot;
-- DROP INDEX IF EXISTS idx_tasks_employee_date_slot;
-- ALTER TABLE public.tasks DROP COLUMN IF EXISTS time_slot;

-- DROP TABLE IF EXISTS public.schedule_change_notifications CASCADE;

-- DROP TRIGGER IF EXISTS trigger_calculate_task_hours ON public.tasks;
-- (需要恢复原始的 calculate_task_hours 函数)

-- ========================================
-- 迁移完成提示
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '数据库迁移完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '下一步操作：';
  RAISE NOTICE '1. 确认 Wang Ning 和 Liu Kui 的工号';
  RAISE NOTICE '2. 取消注释并执行 Site PS 权限配置（第二步）';
  RAISE NOTICE '3. 在 Supabase Dashboard 中验证表结构';
  RAISE NOTICE '4. 运行验证查询（第六步）';
  RAISE NOTICE '========================================';
END $$;

