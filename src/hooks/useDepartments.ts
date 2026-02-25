/**
 * 部门相关 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentsService } from '@/services';
import type { Department, DepartmentCreate, DepartmentUpdate } from '@/types/api';

const DEPARTMENTS_KEY = 'departments';

/**
 * 获取所有部门
 */
export const useDepartments = () => {
  return useQuery({
    queryKey: [DEPARTMENTS_KEY],
    queryFn: () => departmentsService.getAll(),
  });
};

/**
 * 获取单个部门
 */
export const useDepartment = (id: number) => {
  return useQuery({
    queryKey: [DEPARTMENTS_KEY, id],
    queryFn: () => departmentsService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建部门
 */
export const useCreateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DepartmentCreate) => departmentsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_KEY] });
    },
  });
};

/**
 * 更新部门
 */
export const useUpdateDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DepartmentUpdate }) =>
      departmentsService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_KEY, variables.id] });
    },
  });
};

/**
 * 删除部门
 */
export const useDeleteDepartment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => departmentsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_KEY] });
    },
  });
};
