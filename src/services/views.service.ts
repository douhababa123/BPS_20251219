/**
 * 业务视图查询服务
 */

import { apiClient } from '@/lib/api-client';
import type {
  EmployeeCompetencyMatrix,
  SkillGapAnalysis,
  EmployeeWorkload,
  ResourcePlanningOverview,
  DepartmentSkillDistribution,
  TaskTimeline,
} from '@/types/api';

class ViewsService {
  private readonly endpoint = '/views';

  /**
   * 员工能力矩阵
   */
  async getEmployeeCompetencyMatrix(employeeId?: string): Promise<EmployeeCompetencyMatrix[]> {
    const params = employeeId ? { employee_id: employeeId } : {};
    const response = await apiClient.get<EmployeeCompetencyMatrix[]>(
      `${this.endpoint}/employee-competency-matrix`,
      { params }
    );
    return response.data;
  }

  /**
   * 技能差距分析
   */
  async getSkillGapAnalysis(employeeId?: string): Promise<SkillGapAnalysis[]> {
    const params = employeeId ? { employee_id: employeeId } : {};
    const response = await apiClient.get<SkillGapAnalysis[]>(
      `${this.endpoint}/skill-gap-analysis`,
      { params }
    );
    return response.data;
  }

  /**
   * 员工工作量统计
   */
  async getEmployeeWorkload(): Promise<EmployeeWorkload[]> {
    const response = await apiClient.get<EmployeeWorkload[]>(`${this.endpoint}/employee-workload`);
    return response.data;
  }

  /**
   * 资源规划总览
   */
  async getResourcePlanningOverview(week?: string): Promise<ResourcePlanningOverview[]> {
    const params = week ? { week } : {};
    const response = await apiClient.get<ResourcePlanningOverview[]>(
      `${this.endpoint}/resource-planning-overview`,
      { params }
    );
    return response.data;
  }

  /**
   * 部门技能分布
   */
  async getDepartmentSkillDistribution(): Promise<DepartmentSkillDistribution[]> {
    const response = await apiClient.get<DepartmentSkillDistribution[]>(
      `${this.endpoint}/department-skill-distribution`
    );
    return response.data;
  }

  /**
   * 任务时间线
   */
  async getTaskTimeline(): Promise<TaskTimeline[]> {
    const response = await apiClient.get<TaskTimeline[]>(`${this.endpoint}/task-timeline`);
    return response.data;
  }
}

export const viewsService = new ViewsService();
export default viewsService;
