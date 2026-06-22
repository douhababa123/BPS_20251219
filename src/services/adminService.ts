/**
 * BPS Admin API 服务层
 * 
 * 封装后端 Admin 路由的所有 CRUD 操作：
 * - Departments 管理
 * - Employees 管理
 * - Skills 管理
 * - Audit Logs 导入历史
 * 
 * 功能：
 * - 基础 CRUD (Create, Read, Update, Delete)
 * - 批量删除 (Batch Delete)
 * - CSV/Excel 导入 (Import)
 * - CSV 导出 (Export)
 * - 导入历史查询 (Import History)
 */

import apiClient, { createUploadConfig, formatErrorMessage } from '@/lib/apiClient';
import type { 
  Department, 
  Employee, 
  Skill 
} from '@/lib/database.types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Admin API 通用响应类型
 */
interface MessageResponse {
  message: string;
  detail?: string;
}

interface BatchDeleteResponse {
  deleted: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

interface ImportResponse {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * 导入历史记录项
 */
export interface ImportHistoryItem {
  batch_id: string;              // 批次ID（时间窗口）
  table_name: string;             // 表名
  operation_count: number;        // 操作总数
  success_count: number;          // 成功数量
  failed_count: number;           // 失败数量
  operator_name: string;          // 操作人姓名
  operator_email: string;         // 操作人邮箱
  operated_at: string;            // 操作时间
  preview: string;                // 记录预览
}

/**
 * 审计日志详情
 */
export interface AuditLogDetail {
  id: string;
  table_name: string;
  record_id: string;
  operation_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  operator_name: string;
  operator_email: string;
  operated_at: string;
}

/**
 * 部门创建/更新请求
 */
export interface DepartmentCreateRequest {
  name: string;
  code?: string;
  description?: string;
}

export interface DepartmentUpdateRequest {
  name?: string;
  code?: string;
  description?: string;
}

/**
 * 员工创建/更新请求
 */
export interface EmployeeCreateRequest {
  employee_id: string;
  name: string;
  department_id: number;
  email?: string;
  position?: string;
  phone?: string;
}

export interface EmployeeUpdateRequest {
  employee_id?: string;
  name?: string;
  department_id?: number;
  email?: string;
  position?: string;
  phone?: string;
}

/**
 * 技能创建/更新请求
 */
export interface SkillCreateRequest {
  module_id: number;
  module_name: string;
  skill_name: string;
  skill_code?: string;
  description?: string;
  display_order: number;
}

export interface SkillUpdateRequest {
  module_id?: number;
  module_name?: string;
  skill_name?: string;
  skill_code?: string;
  description?: string;
  display_order?: number;
}

export interface AccountStatus {
  employee_uuid: string;
  employee_id: string;
  employee_name: string;
  employee_email?: string;
  employee_role?: string;
  employee_active: boolean;
  auth_user_id?: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  user_role?: string;
  user_active?: boolean;
  has_password: boolean;
  must_change_password: boolean;
  mapped_user_role: string;
  is_bound: boolean;
  last_login_at?: string;
  login_count?: number;
}

export interface GeneratedAccountPassword {
  employee_id?: string;
  employee_name?: string;
  email: string;
  user_id: string;
  role: string;
  temporary_password: string;
  reason: string;
}

export interface AccountSyncResponse {
  employees_seen: number;
  created: number;
  updated: number;
  bound: number;
  skipped_without_email: number;
  passwords: GeneratedAccountPassword[];
}

// ============================================================================
// Departments 部门管理
// ============================================================================

/**
 * 获取部门列表
 * @param includeInactive 是否包含已删除的部门
 */
export const getDepartments = async (includeInactive = false): Promise<Department[]> => {
  try {
    const response = await apiClient.get<{ departments: Department[]; count: number }>('/admin/departments', {
      params: { include_inactive: includeInactive },
    });
    return response.data.departments ?? [];
  } catch (error) {
    console.error('❌ 获取部门列表失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 获取单个部门详情
 * @param deptId 部门ID
 */
export const getDepartment = async (deptId: number): Promise<Department> => {
  try {
    const response = await apiClient.get<Department>(`/admin/departments/${deptId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 获取部门详情失败 (ID: ${deptId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 创建部门
 * @param data 部门数据
 */
export const createDepartment = async (data: DepartmentCreateRequest): Promise<Department> => {
  try {
    const response = await apiClient.post<Department>('/admin/departments', data);
    return response.data;
  } catch (error) {
    console.error('❌ 创建部门失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 更新部门
 * @param deptId 部门ID
 * @param data 更新数据
 */
export const updateDepartment = async (
  deptId: number,
  data: DepartmentUpdateRequest
): Promise<Department> => {
  try {
    const response = await apiClient.put<Department>(`/admin/departments/${deptId}`, data);
    return response.data;
  } catch (error) {
    console.error(`❌ 更新部门失败 (ID: ${deptId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 删除部门（软删除）
 * @param deptId 部门ID
 */
export const deleteDepartment = async (deptId: number): Promise<MessageResponse> => {
  try {
    const response = await apiClient.delete<MessageResponse>(`/admin/departments/${deptId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 删除部门失败 (ID: ${deptId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 批量删除部门
 * @param ids 部门ID数组
 */
export const batchDeleteDepartments = async (ids: number[]): Promise<BatchDeleteResponse> => {
  try {
    const response = await apiClient.post<BatchDeleteResponse>(
      '/admin/departments/batch-delete',
      { ids }
    );
    return response.data;
  } catch (error) {
    console.error('❌ 批量删除部门失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 导出部门列表为 CSV
 * @param includeInactive 是否包含已删除的部门
 * @param fields 导出字段（逗号分隔），默认全部
 */
export const exportDepartmentsCSV = async (
  includeInactive = false,
  fields?: string
): Promise<Blob> => {
  try {
    const response = await apiClient.get('/admin/departments/export/csv', {
      params: { include_inactive: includeInactive, fields },
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('❌ 导出部门 CSV 失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 从 CSV/Excel 导入部门
 * @param file CSV 或 Excel 文件
 * @param onUploadProgress 上传进度回调
 */
export const importDepartmentsCSV = async (
  file: File,
  onUploadProgress?: (progressEvent: any) => void
): Promise<ImportResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ImportResponse>(
      '/admin/departments/import/csv',
      formData,
      createUploadConfig(onUploadProgress)
    );
    return response.data;
  } catch (error) {
    console.error('❌ 导入部门 CSV 失败:', formatErrorMessage(error));
    throw error;
  }
};

// ============================================================================
// Employees 员工管理
// ============================================================================

/**
 * 获取员工列表
 * @param includeInactive 是否包含已删除的员工
 */
export const getEmployees = async (includeInactive = false): Promise<Employee[]> => {
  try {
    const response = await apiClient.get<{ employees: Employee[]; count: number }>('/admin/employees', {
      params: { include_inactive: includeInactive },
    });
    return response.data.employees ?? [];
  } catch (error) {
    console.error('❌ 获取员工列表失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 获取单个员工详情
 * @param empId 员工UUID
 */
export const getEmployee = async (empId: string): Promise<Employee> => {
  try {
    const response = await apiClient.get<Employee>(`/admin/employees/${empId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 获取员工详情失败 (ID: ${empId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 创建员工
 * @param data 员工数据
 */
export const createEmployee = async (data: EmployeeCreateRequest): Promise<Employee> => {
  try {
    const response = await apiClient.post<Employee>('/admin/employees', data);
    return response.data;
  } catch (error) {
    console.error('❌ 创建员工失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 更新员工
 * @param empId 员工UUID
 * @param data 更新数据
 */
export const updateEmployee = async (
  empId: string,
  data: EmployeeUpdateRequest
): Promise<Employee> => {
  try {
    const response = await apiClient.put<Employee>(`/admin/employees/${empId}`, data);
    return response.data;
  } catch (error) {
    console.error(`❌ 更新员工失败 (ID: ${empId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 删除员工（软删除）
 * @param empId 员工UUID
 */
export const deleteEmployee = async (empId: string): Promise<MessageResponse> => {
  try {
    const response = await apiClient.delete<MessageResponse>(`/admin/employees/${empId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 删除员工失败 (ID: ${empId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 批量删除员工
 * @param ids 员工UUID数组
 */
export const batchDeleteEmployees = async (ids: string[]): Promise<BatchDeleteResponse> => {
  try {
    const response = await apiClient.post<BatchDeleteResponse>(
      '/admin/employees/batch-delete',
      { ids }
    );
    return response.data;
  } catch (error) {
    console.error('❌ 批量删除员工失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 导出员工列表为 CSV
 * @param includeInactive 是否包含已删除的员工
 * @param departmentId 按部门筛选
 * @param fields 导出字段（逗号分隔），默认全部
 */
export const exportEmployeesCSV = async (
  includeInactive = false,
  departmentId?: number,
  fields?: string
): Promise<Blob> => {
  try {
    const response = await apiClient.get('/admin/employees/export/csv', {
      params: { 
        include_inactive: includeInactive, 
        department_id: departmentId,
        fields 
      },
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('❌ 导出员工 CSV 失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 从 CSV/Excel 导入员工
 * @param file CSV 或 Excel 文件
 * @param onUploadProgress 上传进度回调
 */
export const importEmployeesCSV = async (
  file: File,
  onUploadProgress?: (progressEvent: any) => void
): Promise<ImportResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ImportResponse>(
      '/admin/employees/import/csv',
      formData,
      createUploadConfig(onUploadProgress)
    );
    return response.data;
  } catch (error) {
    console.error('❌ 导入员工 CSV 失败:', formatErrorMessage(error));
    throw error;
  }
};

// ============================================================================
// Skills 技能管理
// ============================================================================

/**
 * 获取技能列表
 * @param moduleId 按模块筛选
 * @param includeInactive 是否包含已删除的技能
 */
export const getSkills = async (
  moduleId?: number,
  includeInactive = false
): Promise<Skill[]> => {
  try {
    const response = await apiClient.get<{ skills: Skill[]; count: number }>('/admin/skills', {
      params: { 
        module_id: moduleId,
        include_inactive: includeInactive 
      },
    });
    return response.data.skills ?? [];
  } catch (error) {
    console.error('❌ 获取技能列表失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 获取单个技能详情
 * @param skillId 技能ID
 */
export const getSkill = async (skillId: number): Promise<Skill> => {
  try {
    const response = await apiClient.get<Skill>(`/admin/skills/${skillId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 获取技能详情失败 (ID: ${skillId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 创建技能
 * @param data 技能数据
 */
export const createSkill = async (data: SkillCreateRequest): Promise<Skill> => {
  try {
    const response = await apiClient.post<Skill>('/admin/skills', data);
    return response.data;
  } catch (error) {
    console.error('❌ 创建技能失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 更新技能
 * @param skillId 技能ID
 * @param data 更新数据
 */
export const updateSkill = async (
  skillId: number,
  data: SkillUpdateRequest
): Promise<Skill> => {
  try {
    const response = await apiClient.put<Skill>(`/admin/skills/${skillId}`, data);
    return response.data;
  } catch (error) {
    console.error(`❌ 更新技能失败 (ID: ${skillId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 删除技能（软删除）
 * @param skillId 技能ID
 */
export const deleteSkill = async (skillId: number): Promise<MessageResponse> => {
  try {
    const response = await apiClient.delete<MessageResponse>(`/admin/skills/${skillId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 删除技能失败 (ID: ${skillId}):`, formatErrorMessage(error));
    throw error;
  }
};

/**
 * 批量删除技能
 * @param ids 技能ID数组
 */
export const batchDeleteSkills = async (ids: number[]): Promise<BatchDeleteResponse> => {
  try {
    const response = await apiClient.post<BatchDeleteResponse>(
      '/admin/skills/batch-delete',
      { ids }
    );
    return response.data;
  } catch (error) {
    console.error('❌ 批量删除技能失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 导出技能列表为 CSV
 * @param includeInactive 是否包含已删除的技能
 * @param moduleId 按模块筛选
 * @param fields 导出字段（逗号分隔），默认全部
 */
export const exportSkillsCSV = async (
  includeInactive = false,
  moduleId?: number,
  fields?: string
): Promise<Blob> => {
  try {
    const response = await apiClient.get('/admin/skills/export/csv', {
      params: { 
        include_inactive: includeInactive,
        module_id: moduleId,
        fields 
      },
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('❌ 导出技能 CSV 失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 从 CSV/Excel 导入技能
 * @param file CSV 或 Excel 文件
 * @param onUploadProgress 上传进度回调
 */
export const importSkillsCSV = async (
  file: File,
  onUploadProgress?: (progressEvent: any) => void
): Promise<ImportResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ImportResponse>(
      '/admin/skills/import/csv',
      formData,
      createUploadConfig(onUploadProgress)
    );
    return response.data;
  } catch (error) {
    console.error('❌ 导入技能 CSV 失败:', formatErrorMessage(error));
    throw error;
  }
};

// ============================================================================
// 审计日志 API
// ============================================================================

/**
 * 获取导入历史（按批次聚合）
 * @param tableName 筛选表名（可选）
 * @param limit 返回记录数
 */
export const getAccountStatuses = async (): Promise<AccountStatus[]> => {
  const response = await apiClient.get<{ accounts: AccountStatus[]; count: number }>('/admin/accounts');
  return response.data.accounts ?? [];
};

export const syncAccounts = async (): Promise<AccountSyncResponse> => {
  const response = await apiClient.post<AccountSyncResponse>('/admin/accounts/sync');
  return response.data;
};

export const resetAccountPassword = async (userId: string): Promise<GeneratedAccountPassword> => {
  const response = await apiClient.post<GeneratedAccountPassword>(`/admin/accounts/${userId}/reset-password`);
  return response.data;
};

export const getImportHistory = async (
  tableName?: string,
  limit = 20
): Promise<ImportHistoryItem[]> => {
  try {
    const response = await apiClient.get<ImportHistoryItem[]>('/audit-logs/import-history', {
      params: { 
        table_name: tableName,
        limit 
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ 获取导入历史失败:', formatErrorMessage(error));
    throw error;
  }
};

/**
 * 获取审计日志详细记录
 * @param tableName 筛选表名（可选）
 * @param operationType 筛选操作类型（可选）
 * @param limit 返回记录数
 */
export const getAuditLogs = async (
  tableName?: string,
  operationType?: string,
  limit = 100
): Promise<AuditLogDetail[]> => {
  try {
    const response = await apiClient.get<AuditLogDetail[]>('/audit-logs', {
      params: { 
        table_name: tableName,
        operation_type: operationType,
        limit 
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ 获取审计日志失败:', formatErrorMessage(error));
    throw error;
  }
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 下载 Blob 为文件
 * @param blob Blob 数据
 * @param filename 文件名
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * 格式化导入结果消息
 * @param result 导入响应
 */
export const formatImportResult = (result: ImportResponse): string => {
  const { success, failed, errors } = result;
  let message = `成功导入 ${success} 条记录`;
  
  if (failed > 0) {
    message += `，失败 ${failed} 条`;
    if (errors.length > 0) {
      const errorDetails = errors.slice(0, 3).map(e => `行${e.row}: ${e.error}`).join('\n');
      message += `\n\n错误详情:\n${errorDetails}`;
      if (errors.length > 3) {
        message += `\n...还有 ${errors.length - 3} 个错误`;
      }
    }
  }
  
  return message;
};
