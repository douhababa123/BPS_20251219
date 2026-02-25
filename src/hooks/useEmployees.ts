/**
 * 员工相关 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@/services';
import type { Employee, EmployeeCreate, EmployeeUpdate } from '@/types/api';

const EMPLOYEES_KEY = 'employees';

/**
 * 获取所有员工
 */
export const useEmployees = () => {
  return useQuery({
    queryKey: [EMPLOYEES_KEY],
    queryFn: () => employeesService.getAll(),
  });
};

/**
 * 获取单个员工
 */
export const useEmployee = (id: string) => {
  return useQuery({
    queryKey: [EMPLOYEES_KEY, id],
    queryFn: () => employeesService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建员工
 */
export const useCreateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EmployeeCreate) => employeesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_KEY] });
    },
  });
};

/**
 * 更新员工
 */
export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmployeeUpdate }) =>
      employeesService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_KEY] });
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_KEY, variables.id] });
    },
  });
};

/**
 * 删除员工
 */
export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => employeesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_KEY] });
    },
  });
};
