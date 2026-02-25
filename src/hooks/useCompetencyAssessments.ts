/**
 * 能力评估 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { competencyAssessmentsService } from '@/services';
import type { CompetencyAssessmentCreate, CompetencyAssessmentUpdate } from '@/types/api';

const COMPETENCY_ASSESSMENTS_KEY = 'competencyAssessments';

/**
 * 获取所有能力评估
 */
export const useCompetencyAssessments = () => {
  return useQuery({
    queryKey: [COMPETENCY_ASSESSMENTS_KEY],
    queryFn: () => competencyAssessmentsService.getAll(),
  });
};

/**
 * 获取单个能力评估
 */
export const useCompetencyAssessment = (id: string) => {
  return useQuery({
    queryKey: [COMPETENCY_ASSESSMENTS_KEY, id],
    queryFn: () => competencyAssessmentsService.getById(id),
    enabled: !!id,
  });
};

/**
 * 获取指定员工的能力评估
 */
export const useEmployeeAssessments = (employeeId: string) => {
  return useQuery({
    queryKey: [COMPETENCY_ASSESSMENTS_KEY, 'employee', employeeId],
    queryFn: () => competencyAssessmentsService.getByEmployee(employeeId),
    enabled: !!employeeId,
  });
};

/**
 * 创建能力评估
 */
export const useCreateCompetencyAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CompetencyAssessmentCreate) => competencyAssessmentsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_ASSESSMENTS_KEY] });
    },
  });
};

/**
 * 更新能力评估
 */
export const useUpdateCompetencyAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompetencyAssessmentUpdate }) =>
      competencyAssessmentsService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_ASSESSMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_ASSESSMENTS_KEY, id] });
    },
  });
};

/**
 * 删除能力评估
 */
export const useDeleteCompetencyAssessment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => competencyAssessmentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_ASSESSMENTS_KEY] });
    },
  });
};
