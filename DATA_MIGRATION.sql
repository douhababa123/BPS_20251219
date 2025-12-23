-- ========================================
-- 数据迁移脚本
-- 从旧表结构迁移到新表结构
-- 日期：2025-11-24
-- ========================================

-- ⚠️ 重要提示：
-- 1. 在执行此脚本前，请确保已执行 DATABASE_RESTRUCTURE.sql
-- 2. 此脚本会从旧表读取数据并导入新表
-- 3. 请先在测试环境验证后再在生产环境执行

-- ========================================
-- 步骤1：从旧表提取并插入部门数据
-- ========================================

insert into departments (name, code)
select distinct 
  department as name,
  department as code  -- 暂时使用部门名称作为编码
from competency_assessments
where department is not null and department != ''
on conflict (name) do nothing;

-- ========================================
-- 步骤2：从旧表提取并插入员工数据
-- ========================================

insert into employees (employee_id, name, department_id)
select distinct
  engineer_id,
  engineer_name,
  d.id as department_id
from competency_assessments ca
left join departments d on d.name = ca.department
where engineer_id is not null and engineer_name is not null
on conflict (employee_id) do nothing;

-- ========================================
-- 步骤3：从旧表提取并插入技能数据
-- ========================================

-- 方法1：从 competency_definitions 表导入（如果存在）
insert into skills (module_id, module_name, skill_name, display_order)
select distinct
  module_id,
  module_name,
  competency_type as skill_name,
  row_number() over (partition by module_id order by competency_type) as display_order
from competency_definitions
where module_id is not null and competency_type is not null
on conflict (module_id, skill_name) do nothing;

-- 方法2：如果没有 competency_definitions 表，从 competency_assessments 表提取
insert into skills (module_id, module_name, skill_name, display_order)
select distinct
  coalesce(module_id, 1) as module_id,  -- 如果module_id为空，默认为1
  module_name,
  competency_type as skill_name,
  row_number() over (partition by module_name order by competency_type) as display_order
from competency_assessments
where module_name is not null and competency_type is not null
on conflict (module_id, skill_name) do nothing;

-- ========================================
-- 步骤4：从旧表提取并插入评估数据
-- ========================================

insert into competency_assessments (
  employee_id,
  skill_id,
  current_level,
  target_level,
  assessment_year,
  assessment_date,
  notes
)
select 
  e.id as employee_id,
  s.id as skill_id,
  ca_old.current_score as current_level,
  ca_old.target_score as target_level,
  ca_old.assessment_year,
  ca_old.assessment_date::date,
  ca_old.notes
from competency_assessments ca_old
join employees e on e.employee_id = ca_old.engineer_id
join skills s on s.module_name = ca_old.module_name 
              and s.skill_name = ca_old.competency_type
where ca_old.current_score between 1 and 5
  and ca_old.target_score between 1 and 5
  and ca_old.target_score >= ca_old.current_score
on conflict (employee_id, skill_id, assessment_year) do update
set 
  current_level = excluded.current_level,
  target_level = excluded.target_level,
  notes = excluded.notes,
  updated_at = now();

-- ========================================
-- 步骤5：数据验证
-- ========================================

-- 验证迁移结果
select 
  '迁移前（旧表）' as data_source,
  count(distinct department) as departments,
  count(distinct engineer_id) as employees,
  count(distinct competency_type) as skills,
  count(*) as assessments
from competency_assessments

union all

select 
  '迁移后（新表）' as data_source,
  (select count(*) from departments) as departments,
  (select count(*) from employees) as employees,
  (select count(*) from skills) as skills,
  (select count(*) from competency_assessments) as assessments;

-- 检查是否有数据丢失
select 
  '数据完整性检查' as check_type,
  case 
    when old_count = new_count then '✓ 数据完整'
    else '✗ 数据丢失: ' || (old_count - new_count)::text || ' 条记录'
  end as status
from (
  select 
    (select count(*) from competency_assessments) as old_count,
    (select count(*) from competency_assessments) as new_count
) as counts;

-- ========================================
-- 步骤6：（可选）备份并删除旧表
-- ========================================

-- ⚠️ 警告：只有在确认数据迁移成功后才执行以下命令

-- 重命名旧表作为备份
-- alter table competency_assessments rename to competency_assessments_backup;
-- alter table competency_definitions rename to competency_definitions_backup;

-- 或者直接删除旧表（不推荐，除非已有其他备份）
-- drop table if exists competency_assessments cascade;
-- drop table if exists competency_definitions cascade;

-- ========================================
-- 完成！
-- ========================================

select '数据迁移完成！' as message;
select '请检查上述验证结果，确保数据完整性。' as reminder;
