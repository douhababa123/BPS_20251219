/**
 * 资源规划任务 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourcePlanningTasksService } from '@/services';
import type { ResourcePlanningTask, ResourcePlanningTaskCreate, ResourcePlanningTaskUpdate } from '@/types/api';

const RESOURCE_PLANNING_TASKS_KEY = 'resourcePlanningTasks';

/**
 * 获取所有资源规划任务（支持过滤）
 */
export const useResourcePlanningTasks = (params?: {
  employee_id?: string;
  year?: number;
  week_number?: number;
}) => {
  return useQuery({
    queryKey: [RESOURCE_PLANNING_TASKS_KEY, params],
    queryFn: () => resourcePlanningTasksService.getTasks(params),
  });
};

/**
 * 获取单个资源规划任务
 */
export const useResourcePlanningTask = (id: string) => {
  return useQuery({
    queryKey: [RESOURCE_PLANNING_TASKS_KEY, id],
    queryFn: () => resourcePlanningTasksService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建资源规划任务
 */
export const useCreateResourcePlanningTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ResourcePlanningTaskCreate) => resourcePlanningTasksService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESOURCE_PLANNING_TASKS_KEY] });
    },
  });
};

/**
 * 更新资源规划任务
 */
export const useUpdateResourcePlanningTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ResourcePlanningTaskUpdate }) =>
      resourcePlanningTasksService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [RESOURCE_PLANNING_TASKS_KEY] });
      queryClient.invalidateQueries({ queryKey: [RESOURCE_PLANNING_TASKS_KEY, id] });
    },
  });
};

/**
 * 删除资源规划任务
 */
export const useDeleteResourcePlanningTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => resourcePlanningTasksService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RESOURCE_PLANNING_TASKS_KEY] });
    },
  });
};
