/**
 * 能力评估服务
 */

import { BaseService } from './base.service';
import { apiClient } from '@/lib/api-client';
import type {
  CompetencyAssessment,
  CompetencyAssessmentCreate,
  CompetencyAssessmentUpdate,
} from '@/types/api';

class CompetencyAssessmentsService extends BaseService<
  CompetencyAssessment,
  CompetencyAssessmentCreate,
  CompetencyAssessmentUpdate
> {
  constructor() {
    super('/competency-assessments');
  }

  /**
   * 获取员工的能力评估
   */
  async getByEmployee(employeeId: string): Promise<CompetencyAssessment[]> {
    const response = await apiClient.get<CompetencyAssessment[]>(
      `${this.endpoint}/employee/${employeeId}`
    );
    return response.data;
  }
}

export const competencyAssessmentsService = new CompetencyAssessmentsService();
export default competencyAssessmentsService;
