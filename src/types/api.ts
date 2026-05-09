/**
 * API 类型定义
 * 与后端 Pydantic 模型对应的 TypeScript 接口
 */

// ============================================================================
// 通用类型
// ============================================================================

export interface MessageResponse {
  message: string;
  detail?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// 认证相关类型
// ============================================================================

export interface OTPRequest {
  email: string;
}

export interface OTPVerifyRequest {
  email: string;
  otp: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  role: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  role?: string;
}

// ============================================================================
// 部门 (Departments)
// ============================================================================

export interface Department {
  id: number;
  name: string;
  code?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentCreate {
  name: string;
  code?: string;
  description?: string;
}

export interface DepartmentUpdate {
  name?: string;
  code?: string;
  description?: string;
}

// ============================================================================
// 工厂 (Factories)
// ============================================================================

export interface Factory {
  id: number;
  code: string;
  name: string;
  region?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FactoryCreate {
  code: string;
  name: string;
  region?: string;
  is_active?: boolean;
}

export interface FactoryUpdate {
  code?: string;
  name?: string;
  region?: string;
  is_active?: boolean;
}

// ============================================================================
// 任务类型 (Task Types)
// ============================================================================

export interface TaskType {
  id: number;
  code: string;
  name: string;
  color_hex?: string;
  description?: string;
  is_active: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TaskTypeCreate {
  code: string;
  name: string;
  color_hex?: string;
  description?: string;
  is_active?: boolean;
}

export interface TaskTypeUpdate {
  code?: string;
  name?: string;
  color_hex?: string;
  description?: string;
  is_active?: boolean;
}

// ============================================================================
// 技能 (Skills)
// ============================================================================

export interface Skill {
  id: number;
  module_id: number;
  module_name: string;
  skill_name: string;
  skill_code?: string;
  description?: string;
  display_order?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SkillCreate {
  module_id: number;
  module_name: string;
  skill_name: string;
  skill_code?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface SkillUpdate {
  module_id?: number;
  module_name?: string;
  skill_name?: string;
  skill_code?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

// ============================================================================
// 员工 (Employees)
// ============================================================================

export interface Employee {
  id: string; // UUID
  employee_id: string;
  name: string;
  email: string;
  department_id: number;
  hire_date?: string;
  is_active: boolean;
  skills?: number[];
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeCreate {
  employee_id: string;
  name: string;
  email: string;
  department_id: number;
  hire_date?: string;
  is_active?: boolean;
  skills?: number[];
}

export interface EmployeeUpdate {
  employee_id?: string;
  name?: string;
  email?: string;
  department_id?: number;
  hire_date?: string;
  is_active?: boolean;
  skills?: number[];
}

// ============================================================================
// 能力定义 (Competency Definitions)
// ============================================================================

export interface CompetencyDefinition {
  id: number;
  module_id: number;
  module_name: string;
  competency_type: string;
  competency_code?: string;
  competency_name: string;
  level_1_description?: string;
  level_2_description?: string;
  level_3_description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CompetencyDefinitionCreate {
  module_id: number;
  module_name: string;
  competency_type: string;
  competency_code?: string;
  competency_name: string;
  level_1_description?: string;
  level_2_description?: string;
  level_3_description?: string;
  is_active?: boolean;
}

export interface CompetencyDefinitionUpdate {
  module_id?: number;
  module_name?: string;
  competency_type?: string;
  competency_code?: string;
  competency_name?: string;
  level_1_description?: string;
  level_2_description?: string;
  level_3_description?: string;
  is_active?: boolean;
}

// ============================================================================
// 能力评估 (Competency Assessments)
// ============================================================================

export interface CompetencyAssessment {
  id: string; // UUID
  employee_id: string;
  skill_id: number;
  current_level: number; // 0-3
  target_level: number; // 0-3
  assessment_date?: string;
  assessor_notes?: string;
  gap?: number;
  last_assessment_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompetencyAssessmentCreate {
  employee_id: string;
  skill_id: number;
  current_level: number;
  target_level: number;
  assessment_date?: string;
  assessor_notes?: string;
}

export interface CompetencyAssessmentUpdate {
  current_level?: number;
  target_level?: number;
  assessment_date?: string;
  assessor_notes?: string;
}

// ============================================================================
// 任务 (Tasks)
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'active'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'pending_approval'   // 等待 Site PS 审批
  | 'rejected'           // admin 拒绝
  | 'confirmed'          // 工程师已确认接受
  | 'employee_rejected'; // 工程师拒绝

export interface Task {
  id: string; // UUID
  task_name: string;
  task_type: string;
  task_location: string;
  assigned_employee_id?: string;
  start_date?: string;
  end_date?: string;
  hours_per_day?: number;
  total_hours?: number;
  status: TaskStatus;
  required_skills?: number[];
  notes?: string;
  time_slot?: string;
  competence?: string;
  // 审批工作流字段
  rejection_reason?: string;
  requester_id?: string;
  rejected_by?: 'admin' | 'employee';
  created_at?: string;
  updated_at?: string;
}

export interface TaskCreate {
  task_name: string;
  task_type: string;
  task_location: string;
  assigned_employee_id?: string;
  start_date?: string;
  end_date?: string;
  hours_per_day?: number;
  total_hours?: number;
  status?: TaskStatus;
  required_skills?: number[];
  notes?: string;
  time_slot?: string;
  competence?: string;
}

export interface TaskUpdate {
  task_name?: string;
  task_type?: string;
  task_location?: string;
  assigned_employee_id?: string;
  start_date?: string;
  end_date?: string;
  hours_per_day?: number;
  total_hours?: number;
  status?: TaskStatus;
  required_skills?: number[];
  notes?: string;
  time_slot?: string;
  competence?: string;
  rejection_reason?: string;
}

// ============================================================================
// 通知 (Notifications)
// ============================================================================

export type NotificationType =
  | 'task_submitted'
  | 'task_approved'
  | 'task_rejected'
  | 'task_confirmed'
  | 'task_employee_rejected';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  task_id?: string;
  is_read: boolean;
  created_at?: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unread_count: number;
}

// ============================================================================
// 资源任务类型 (Resource Task Types)
// ============================================================================

export interface ResourceTaskType {
  id: number;
  code: string;
  name: string;
  color_hex?: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ResourceTaskTypeCreate {
  code: string;
  name: string;
  color_hex?: string;
  description?: string;
  is_active?: boolean;
}

export interface ResourceTaskTypeUpdate {
  code?: string;
  name?: string;
  color_hex?: string;
  description?: string;
  is_active?: boolean;
}

// ============================================================================
// 资源规划任务 (Resource Planning Tasks)
// ============================================================================

export interface ResourcePlanningTask {
  id: number;
  employee_id: string;
  task_type_code: string;
  start_week: string;
  end_week: string;
  factory_code: string;
  hours: number;
  is_cross_factory: boolean;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  year?: number;
  week_number?: number;
  employee_name?: string;
  department_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ResourcePlanningTaskCreate {
  employee_id: string;
  task_type_code: string;
  start_week: string;
  end_week: string;
  factory_code: string;
  hours: number;
  is_cross_factory?: boolean;
  notes?: string;
}

export interface ResourcePlanningTaskUpdate {
  employee_id?: string;
  task_type_code?: string;
  start_week?: string;
  end_week?: string;
  factory_code?: string;
  hours?: number;
  is_cross_factory?: boolean;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

// ============================================================================
// 计划变更通知 (Schedule Change Notifications)
// ============================================================================

export interface ScheduleChangeNotification {
  id: string; // UUID
  task_id: string;
  affected_employee_id: string;
  modified_by_employee_id: string;
  notification_type: string;
  change_description?: string;
  is_read: boolean;
  notification_date?: string;
  created_at?: string;
}

export interface ScheduleChangeNotificationCreate {
  task_id: string;
  affected_employee_id: string;
  modified_by_employee_id: string;
  notification_type: string;
  change_description?: string;
  is_read?: boolean;
}

export interface ScheduleChangeNotificationUpdate {
  is_read?: boolean;
}

// ============================================================================
// 业务视图查询类型
// ============================================================================

export interface EmployeeCompetencyMatrix {
  employee_id: string;
  employee_name: string;
  skill_id: number;
  skill_name: string;
  current_level: number;
  target_level: number;
}

export interface SkillGapAnalysis {
  employee_id: string;
  employee_name: string;
  skill_id: number;
  skill_name: string;
  current_level: number;
  target_level: number;
  gap: number;
}

export interface EmployeeWorkload {
  employee_id: string;
  employee_name: string;
  total_tasks: number;
  total_hours: number;
  active_tasks: number;
}

export interface ResourcePlanningOverview {
  employee_id: string;
  employee_name: string;
  week: string;
  task_type_code: string;
  factory_code: string;
  hours: number;
  is_cross_factory: boolean;
}

export interface DepartmentSkillDistribution {
  department_id: number;
  department_name: string;
  skill_id: number;
  skill_name: string;
  employee_count: number;
  avg_level: number;
}

export interface TaskTimeline {
  task_id: string;
  task_name: string;
  task_type: string;
  employee_name?: string;
  start_date?: string;
  end_date?: string;
  status: string;
}
