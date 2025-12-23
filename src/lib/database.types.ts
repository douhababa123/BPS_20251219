// ========================================
// 新数据库类型定义
// 对应重构后的4张表结构
// 日期：2025-11-24
// ========================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ========================================
// 数据库表接口定义
// ========================================

export interface Database {
  public: {
    Tables: {
      // 1. 部门表
      departments: {
        Row: {
          id: number
          name: string
          code: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          code?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          code?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // 2. 员工表
      employees: {
        Row: {
          id: string  // UUID
          employee_id: string
          name: string
          department_id: number | null
          email: string | null
          position: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          name: string
          department_id?: number | null
          email?: string | null
          position?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          name?: string
          department_id?: number | null
          email?: string | null
          position?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      
      // 3. 技能表
      skills: {
        Row: {
          id: number
          module_id: number
          module_name: string
          skill_name: string
          skill_code: string | null
          description: string | null
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          module_id: number
          module_name: string
          skill_name: string
          skill_code?: string | null
          description?: string | null
          display_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          module_id?: number
          module_name?: string
          skill_name?: string
          skill_code?: string | null
          description?: string | null
          display_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      
      // 4. 能力评估表
      competency_assessments: {
        Row: {
          id: string  // UUID
          employee_id: string  // UUID reference
          skill_id: number
          current_level: number
          target_level: number
          gap: number  // 自动计算字段
          assessment_year: number
          assessment_date: string  // Date
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          skill_id: number
          current_level: number
          target_level: number
          assessment_year?: number
          assessment_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          skill_id?: number
          current_level?: number
          target_level?: number
          assessment_year?: number
          assessment_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // 5. 任务类型表
      task_types: {
        Row: {
          id: number
          code: string
          name: string
          color_hex: string
          description: string | null
          is_system: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          code: string
          name: string
          color_hex: string
          description?: string | null
          is_system?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          code?: string
          name?: string
          color_hex?: string
          description?: string | null
          is_system?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      
      // 6. 工厂/地点表
      factories: {
        Row: {
          id: number
          code: string
          name: string
          region: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          code: string
          name: string
          region?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          code?: string
          name?: string
          region?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      
      // 7. 任务表
      tasks: {
        Row: {
          id: string  // UUID
          task_name: string
          task_type: string
          task_location: string
          assigned_employee_id: string | null  // UUID reference
          start_date: string  // Date
          end_date: string  // Date
          days_count: number | null
          hours_per_day: number
          total_hours: number | null
          source: 'manual' | 'system'
          status: 'pending' | 'active' | 'completed' | 'cancelled'
          is_cross_factory: boolean
          request_factory: string | null
          required_skills: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_name: string
          task_type: string
          task_location: string
          assigned_employee_id?: string | null
          start_date: string
          end_date: string
          hours_per_day?: number
          source?: 'manual' | 'system'
          status?: 'pending' | 'active' | 'completed' | 'cancelled'
          is_cross_factory?: boolean
          request_factory?: string | null
          required_skills?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_name?: string
          task_type?: string
          task_location?: string
          assigned_employee_id?: string | null
          start_date?: string
          end_date?: string
          hours_per_day?: number
          source?: 'manual' | 'system'
          status?: 'pending' | 'active' | 'completed' | 'cancelled'
          is_cross_factory?: boolean
          request_factory?: string | null
          required_skills?: string[] | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    
    // 视图定义
    Views: {
      // 完整评估数据视图
      view_assessments_full: {
        Row: {
          id: string
          employee_id: string
          employee_code: string
          employee_name: string
          department_name: string | null
          department_code: string | null
          skill_id: number
          module_id: number
          module_name: string
          skill_name: string
          display_order: number
          current_level: number
          target_level: number
          gap: number
          assessment_year: number
          assessment_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      
      // 员工Gap统计视图
      view_employee_gaps: {
        Row: {
          employee_id: string
          employee_code: string
          employee_name: string
          department_name: string | null
          assessment_year: number
          total_skills: number
          skills_with_gap: number
          total_gap_score: number
          avg_current_level: number
          avg_target_level: number
          avg_gap: number
        }
      }
      
      // 技能Gap统计视图
      view_skill_gaps: {
        Row: {
          skill_id: number
          module_id: number
          module_name: string
          skill_name: string
          assessment_year: number
          total_employees: number
          avg_current_level: number
          avg_target_level: number
          avg_gap: number
          employees_with_gap: number
        }
      }
      
      // 部门Gap统计视图
      view_department_gaps: {
        Row: {
          department_id: number
          department_name: string
          department_code: string | null
          assessment_year: number
          total_employees: number
          total_assessments: number
          total_gap_score: number
          avg_current_level: number
          avg_target_level: number
          avg_gap: number
        }
      }
    }
  }
}

// ========================================
// 便捷类型别名
// ========================================

// 表类型
export type Department = Database['public']['Tables']['departments']['Row']
export type DepartmentInsert = Database['public']['Tables']['departments']['Insert']
export type DepartmentUpdate = Database['public']['Tables']['departments']['Update']

export type Employee = Database['public']['Tables']['employees']['Row']
export type EmployeeInsert = Database['public']['Tables']['employees']['Insert']
export type EmployeeUpdate = Database['public']['Tables']['employees']['Update']

export type Skill = Database['public']['Tables']['skills']['Row']
export type SkillInsert = Database['public']['Tables']['skills']['Insert']
export type SkillUpdate = Database['public']['Tables']['skills']['Update']

export type CompetencyAssessment = Database['public']['Tables']['competency_assessments']['Row']
export type CompetencyAssessmentInsert = Database['public']['Tables']['competency_assessments']['Insert']
export type CompetencyAssessmentUpdate = Database['public']['Tables']['competency_assessments']['Update']

// 视图类型
export type AssessmentFull = Database['public']['Views']['view_assessments_full']['Row']
export type EmployeeGap = Database['public']['Views']['view_employee_gaps']['Row']
export type SkillGap = Database['public']['Views']['view_skill_gaps']['Row']
export type DepartmentGap = Database['public']['Views']['view_department_gaps']['Row']

// ========================================
// 扩展类型（用于前端业务逻辑）
// ========================================

// 带关联信息的员工
export interface EmployeeWithDepartment extends Employee {
  department?: Department | null
}

// 带关联信息的评估
export interface AssessmentWithDetails extends CompetencyAssessment {
  employee?: Employee
  skill?: Skill
  department?: Department
}

// 矩阵视图数据行（用于总览视图）
export interface MatrixRow {
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName: string | null
  skills: Record<number, {  // skill_id -> score
    skillId: number
    currentLevel: number
    targetLevel: number
    gap: number
  }>
}

// 矩阵视图列定义
export interface MatrixColumn {
  skillId: number
  moduleId: number
  moduleName: string
  skillName: string
  displayOrder: number
}

// 筛选条件
export interface MatrixFilters {
  departments?: string[]  // 部门名称列表
  moduleIds?: number[]    // 模块ID列表
  year?: number           // 评估年度
  minGap?: number         // 最小gap
  maxGap?: number         // 最大gap
}

// 统计数据
export interface AssessmentStats {
  totalEmployees: number
  totalSkills: number
  totalAssessments: number
  avgCurrentLevel: number
  avgTargetLevel: number
  avgGap: number
  totalGapScore: number
}

// ========================================
// 日程管理相关类型
// ========================================

export type TaskType = Database['public']['Tables']['task_types']['Row'];
export type TaskTypeInsert = Database['public']['Tables']['task_types']['Insert'];
export type TaskTypeUpdate = Database['public']['Tables']['task_types']['Update'];

export type Factory = Database['public']['Tables']['factories']['Row'];
export type FactoryInsert = Database['public']['Tables']['factories']['Insert'];
export type FactoryUpdate = Database['public']['Tables']['factories']['Update'];

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

// 任务完整信息（含员工和部门）
export interface TaskFull extends Task {
  employee_code?: string;
  employee_name?: string;
  department_name?: string;
  department_code?: string;
}

// 饱和度统计
export interface SaturationStats {
  employee_id: string;
  employee_name: string;
  department_name?: string;
  period: string;  // 'YYYY-MM' for month, 'YYYY-WW' for week
  total_hours: number;
  working_hours: number;  // 标准工时
  saturation_percent: number;
  task_count: number;
}

// 任务类型统计
export interface TaskTypeStats {
  task_type: string;
  count: number;
  total_hours: number;
  percentage: number;
}

// 任务地点统计
export interface TaskLocationStats {
  location: string;
  count: number;
  total_hours: number;
  percentage: number;
}

// ========================================
// 资源规划相关类型
// ========================================

// 资源规划任务类型
export type ResourceTaskType = {
  id: number;
  code: string;
  name: string;
  color_hex: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ResourceTaskTypeInsert = {
  id?: number;
  code: string;
  name: string;
  color_hex: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ResourceTaskTypeUpdate = {
  id?: number;
  code?: string;
  name?: string;
  color_hex?: string;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

// 资源规划任务
export type ResourcePlanningTask = {
  id: number;
  employee_id: string;
  task_type_code: string;
  start_week: string;
  end_week: string;
  start_date: string;
  end_date: string;
  topic: string | null;
  location: string | null;
  notes: string | null;
  imported_at: string;
  import_batch_id: string | null;
  source_file_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ResourcePlanningTaskInsert = {
  id?: number;
  employee_id: string;
  task_type_code: string;
  start_week: string;
  end_week: string;
  start_date: string;
  end_date: string;
  topic?: string | null;
  location?: string | null;
  notes?: string | null;
  imported_at?: string;
  import_batch_id?: string | null;
  source_file_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ResourcePlanningTaskUpdate = {
  id?: number;
  employee_id?: string;
  task_type_code?: string;
  start_week?: string;
  end_week?: string;
  start_date?: string;
  end_date?: string;
  topic?: string | null;
  location?: string | null;
  notes?: string | null;
  imported_at?: string;
  import_batch_id?: string | null;
  source_file_name?: string | null;
  created?: string;
  updated_at?: string;
};

// 资源规划最新版本视图
export type ResourcePlanningLatest = {
  id: number;
  employee_id: string;
  employee_name: string | null;
  employee_code: string | null;
  department_name: string | null;
  task_type_code: string;
  task_type_name: string | null;
  task_type_color: string | null;
  start_week: string;
  end_week: string;
  start_date: string;
  end_date: string;
  topic: string | null;
  location: string | null;
  notes: string | null;
  imported_at: string;
  import_batch_id: string | null;
  source_file_name: string | null;
  created_at: string;
  updated_at: string;
};

// Excel解析结果
export interface ExcelParseResult {
  success: boolean;
  data?: ExcelTaskData[];
  errors?: string[];
  warnings?: string[];
  fileName: string;
  batchId: string;
  totalRows: number;
  parsedRows: number;
}

// Excel任务数据（解析后）
export interface ExcelTaskData {
  employeeName: string;
  employeeCode?: string;
  department?: string;
  taskTypeCode: string;
  startWeek: string;
  endWeek: string;
  topic?: string;
  location?: string;
  rowIndex: number;  // Excel行号，用于错误追踪
}

// 导入统计
export interface ImportStats {
  totalTasks: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  batchId: string;
  importedAt: string;
  fileName: string;
}
