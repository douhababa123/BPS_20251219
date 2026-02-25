/**
 * 任务类型 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskTypesService } from '@/services';
import type { TaskType, TaskTypeCreate, TaskTypeUpdate } from '@/types/api';

const TASK_TYPES_KEY = 'taskTypes';

/**
 * 获取所有任务类型
 */
export const useTaskTypes = () => {
  return useQuery({
    queryKey: [TASK_TYPES_KEY],
    queryFn: () => taskTypesService.getAll(),
  });
};

/**
 * 获取单个任务类型
 */
export const useTaskType = (id: number) => {
  return useQuery({
    queryKey: [TASK_TYPES_KEY, id],
    queryFn: () => taskTypesService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建任务类型
 */
export const useCreateTaskType = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: TaskTypeCreate) => taskTypesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_TYPES_KEY] });
    },
  });
};

/**
 * 更新任务类型
 */
export const useUpdateTaskType = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskTypeUpdate }) =>
      taskTypesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [TASK_TYPES_KEY] });
      queryClient.invalidateQueries({ queryKey: [TASK_TYPES_KEY, id] });
    },
  });
};

/**
 * 删除任务类型
 */
export const useDeleteTaskType = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => taskTypesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_TYPES_KEY] });
    },
  });
};
