/**
 * 资源任务类型 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourceTaskTypesService } from '@/services';
import type { ResourceTaskType, ResourceTaskTypeCreate, ResourceTaskTypeUpdate } from '@/types/api';

const RESOURCE_TASK_TYPES_KEY = 'resourceTaskTypes';

/**
 * 获取所有资源任务类型
 */
export const useResourceTaskTypes = () => {
  return useQuery({
    queryKey: [RESOURCE_TASK_TYPES_KEY],
    queryFn: () => resourceTaskTypesService.getAll(),
  });
};

/**
 * 获取单个资源任务类型
 */
export const useResourceTaskType = (id: number) => {
  return useQuery({
    queryKey: [RESOURCE_TASK_TYPES_KEY, id],
    queryFn: () => resourceTaskTypesService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建资源任务类型
 */
export const useCreateResourceTaskType = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ResourceTaskTypeCreate) => resourceTaskTypesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESOURCE_TASK_TYPES_KEY] });
    },
  });
};

/**
 * 更新资源任务类型
 */
export const useUpdateResourceTaskType = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ResourceTaskTypeUpdate }) =>
      resourceTaskTypesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [RESOURCE_TASK_TYPES_KEY] });
      queryClient.invalidateQueries({ queryKey: [RESOURCE_TASK_TYPES_KEY, id] });
    },
  });
};

/**
 * 删除资源任务类型
 */
export const useDeleteResourceTaskType = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => resourceTaskTypesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESOURCE_TASK_TYPES_KEY] });
    },
  });
};
