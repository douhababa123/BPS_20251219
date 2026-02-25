/**
 * 能力定义 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { competencyDefinitionsService } from '@/services';
import type { CompetencyDefinition, CompetencyDefinitionCreate, CompetencyDefinitionUpdate } from '@/types/api';

const COMPETENCY_DEFINITIONS_KEY = 'competencyDefinitions';

/**
 * 获取所有能力定义
 */
export const useCompetencyDefinitions = () => {
  return useQuery({
    queryKey: [COMPETENCY_DEFINITIONS_KEY],
    queryFn: () => competencyDefinitionsService.getAll(),
  });
};

/**
 * 获取单个能力定义
 */
export const useCompetencyDefinition = (id: number) => {
  return useQuery({
    queryKey: [COMPETENCY_DEFINITIONS_KEY, id],
    queryFn: () => competencyDefinitionsService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建能力定义
 */
export const useCreateCompetencyDefinition = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CompetencyDefinitionCreate) => competencyDefinitionsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_DEFINITIONS_KEY] });
    },
  });
};

/**
 * 更新能力定义
 */
export const useUpdateCompetencyDefinition = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompetencyDefinitionUpdate }) =>
      competencyDefinitionsService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_DEFINITIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_DEFINITIONS_KEY, id] });
    },
  });
};

/**
 * 删除能力定义
 */
export const useDeleteCompetencyDefinition = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => competencyDefinitionsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPETENCY_DEFINITIONS_KEY] });
    },
  });
};
