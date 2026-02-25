/**
 * 工厂 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { factoriesService } from '@/services';
import type { FactoryCreate, FactoryUpdate } from '@/types/api';

const FACTORIES_KEY = 'factories';

/**
 * 获取所有工厂
 */
export const useFactories = () => {
  return useQuery({
    queryKey: [FACTORIES_KEY],
    queryFn: () => factoriesService.getAll(),
  });
};

/**
 * 获取单个工厂
 */
export const useFactory = (id: number) => {
  return useQuery({
    queryKey: [FACTORIES_KEY, id],
    queryFn: () => factoriesService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建工厂
 */
export const useCreateFactory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: FactoryCreate) => factoriesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FACTORIES_KEY] });
    },
  });
};

/**
 * 更新工厂
 */
export const useUpdateFactory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FactoryUpdate }) =>
      factoriesService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [FACTORIES_KEY] });
      queryClient.invalidateQueries({ queryKey: [FACTORIES_KEY, id] });
    },
  });
};

/**
 * 删除工厂
 */
export const useDeleteFactory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => factoriesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FACTORIES_KEY] });
    },
  });
};
