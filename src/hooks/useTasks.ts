/**
 * 任务 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService } from '@/services';
import type { TaskCreate, TaskUpdate } from '@/types/api';

const TASKS_KEY = 'tasks';

/**
 * 获取所有任务（支持过滤）
 */
export const useTasks = (params?: {
  employee_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}) => {
  return useQuery({
    queryKey: [TASKS_KEY, params],
    queryFn: () => tasksService.getTasks(params),
  });
};

/**
 * 获取单个任务
 */
export const useTask = (id: string) => {
  return useQuery({
    queryKey: [TASKS_KEY, id],
    queryFn: () => tasksService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建任务
 */
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: TaskCreate) => tasksService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
};

/**
 * 更新任务
 */
export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) =>
      tasksService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY, id] });
    },
  });
};

/**
 * 删除任务
 */
export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => tasksService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
};
