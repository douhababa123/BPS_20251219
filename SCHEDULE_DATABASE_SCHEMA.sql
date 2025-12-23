-- ========================================
-- BPS工程师日程管理模块 - 数据库表结构
-- 日期：2025-11-24
-- 功能：任务管理、饱和度分析、跨工厂任务
-- ========================================

-- ========================================
-- 1. 任务类型表 (task_types)
-- ========================================
create table if not exists task_types (
  id serial primary key,
  code text not null unique,
  name text not null,
  color_hex text not null,
  description text,
  is_system boolean default true,  -- true=系统预设, false=用户自定义
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 初始化8种系统预设任务类型
insert into task_types (code, name, color_hex, is_system) values
  ('workshop', 'Workshop', '#3B82F6', true),
  ('speed_week', 'Speed week', '#8B5CF6', true),
  ('project', 'Project', '#10B981', true),
  ('training', 'Training', '#F59E0B', true),
  ('coaching', 'Coaching', '#EF4444', true),
  ('meeting', 'Meeting', '#6366F1', true),
  ('leave', 'Leave', '#64748B', true),
  ('self_develop', 'Self-develop', '#14B8A6', true)
on conflict (code) do nothing;

-- 索引
create index if not exists idx_task_types_active on task_types(is_active);

-- ========================================
-- 2. 工厂/地点表 (factories)
-- ========================================
create table if not exists factories (
  id serial primary key,
  code text not null unique,
  name text not null,
  region text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 初始化9个工厂
insert into factories (code, name) values
  ('FLCNa', 'FLCNa'),
  ('FLCCh', 'FLCCh'),
  ('FCGNa', 'FCGNa'),
  ('FEDNa', 'FEDNa'),
  ('FCLCh', 'FCLCh'),
  ('FDCCh', 'FDCCh'),
  ('GPU-SU', 'GPU-SU'),
  ('EA', 'EA'),
  ('HA', 'HA')
on conflict (code) do nothing;

-- 索引
create index if not exists idx_factories_active on factories(is_active);

-- ========================================
-- 3. 任务表 (tasks)
-- ========================================
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  
  -- 基本信息
  task_name text not null,
  task_type text not null,  -- 任务类型（可以是预设或自定义）
  task_location text not null,  -- 任务地点/工厂
  
  -- 分配信息
  assigned_employee_id uuid references employees(id) on delete set null,
  
  -- 时间信息（按天计算）
  start_date date not null,
  end_date date not null,
  days_count int,  -- 任务天数（自动计算）
  hours_per_day int default 8,  -- 每天工时
  total_hours int,  -- 总工时（自动计算）
  
  -- 来源和状态
  source text default 'manual' check (source in ('manual', 'system')),
  status text default 'active' check (status in ('pending', 'active', 'completed', 'cancelled')),
  
  -- 跨工厂任务相关（简化版）
  is_cross_factory boolean default false,
  request_factory text,  -- 发起工厂
  required_skills text[],  -- 需要的能力标签
  
  -- 备注
  notes text,
  
  -- 时间戳
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- 约束
  constraint valid_date_range check (end_date >= start_date)
);

-- 索引
create index if not exists idx_tasks_employee on tasks(assigned_employee_id);
create index if not exists idx_tasks_dates on tasks(start_date, end_date);
create index if not exists idx_tasks_type on tasks(task_type);
create index if not exists idx_tasks_location on tasks(task_location);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_source on tasks(source);

-- ========================================
-- 4. 触发器：自动计算天数和工时
-- ========================================
create or replace function calculate_task_hours()
returns trigger as $$
begin
  -- 计算任务天数
  new.days_count := new.end_date - new.start_date + 1;
  
  -- 计算总工时
  new.total_hours := new.days_count * new.hours_per_day;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_calculate_task_hours on tasks;
create trigger trigger_calculate_task_hours
  before insert or update of start_date, end_date, hours_per_day
  on tasks
  for each row
  execute function calculate_task_hours();

-- ========================================
-- 5. 触发器：更新时间戳
-- ========================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_task_types_updated_at on task_types;
create trigger update_task_types_updated_at before update on task_types
  for each row execute function update_updated_at_column();

drop trigger if exists update_factories_updated_at on factories;
create trigger update_factories_updated_at before update on factories
  for each row execute function update_updated_at_column();

drop trigger if exists update_tasks_updated_at on tasks;
create trigger update_tasks_updated_at before update on tasks
  for each row execute function update_updated_at_column();

-- ========================================
-- 6. 启用RLS (Row Level Security)
-- ========================================
alter table task_types enable row level security;
alter table factories enable row level security;
alter table tasks enable row level security;

-- 公开读取策略
create policy if not exists "Public read on task_types" 
  on task_types for select using (is_active = true);

create policy if not exists "Public read on factories" 
  on factories for select using (is_active = true);

create policy if not exists "Public read on tasks" 
  on tasks for select using (true);

-- 公开写入策略（生产环境需要根据实际权限调整）
create policy if not exists "Public insert on task_types" 
  on task_types for insert with check (true);

create policy if not exists "Public update on task_types" 
  on task_types for update using (true);

create policy if not exists "Public insert on tasks" 
  on tasks for insert with check (true);

create policy if not exists "Public update on tasks" 
  on tasks for update using (true);

create policy if not exists "Public delete on tasks" 
  on tasks for delete using (true);

-- ========================================
-- 7. 数据视图：任务详情（含员工和部门信息）
-- ========================================
create or replace view view_tasks_full as
select 
  t.id,
  t.task_name,
  t.task_type,
  t.task_location,
  t.assigned_employee_id,
  e.employee_id as employee_code,
  e.name as employee_name,
  d.name as department_name,
  d.code as department_code,
  t.start_date,
  t.end_date,
  t.days_count,
  t.hours_per_day,
  t.total_hours,
  t.source,
  t.status,
  t.is_cross_factory,
  t.request_factory,
  t.required_skills,
  t.notes,
  t.created_at,
  t.updated_at
from tasks t
left join employees e on t.assigned_employee_id = e.id
left join departments d on e.department_id = d.id
where t.status != 'cancelled'
order by t.start_date desc, t.created_at desc;

-- ========================================
-- 8. 数据视图：员工饱和度统计（月度）
-- ========================================
create or replace view view_employee_saturation_monthly as
select 
  e.id as employee_id,
  e.employee_id as employee_code,
  e.name as employee_name,
  d.name as department_name,
  date_trunc('month', t.start_date) as month,
  count(t.id) as task_count,
  sum(t.total_hours) as total_hours,
  -- 假设每月工作日20天，每天8小时，总工时160小时
  round((sum(t.total_hours)::numeric / 160) * 100, 2) as saturation_percent
from employees e
left join departments d on e.department_id = d.id
left join tasks t on e.id = t.assigned_employee_id 
  and t.status = 'active'
where e.is_active = true
group by e.id, e.employee_id, e.name, d.name, date_trunc('month', t.start_date)
order by month desc, saturation_percent desc;

-- ========================================
-- 完成提示
-- ========================================
select 'Schedule Management Database Setup Complete!' as status;

select 'Tables:' as info;
select table_name 
from information_schema.tables 
where table_schema = 'public' 
  and table_name in ('task_types', 'factories', 'tasks')
order by table_name;

select 'Initial Data:' as info;
select 'task_types' as table_name, count(*) as row_count from task_types
union all
select 'factories', count(*) from factories
union all
select 'tasks', count(*) from tasks;
