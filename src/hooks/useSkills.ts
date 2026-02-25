/**
 * 技能相关 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsService } from '@/services';
import type { SkillCreate, SkillUpdate } from '@/types/api';

const SKILLS_KEY = 'skills';

/**
 * 获取所有技能
 */
export const useSkills = () => {
  return useQuery({
    queryKey: [SKILLS_KEY],
    queryFn: () => skillsService.getAll(),
  });
};

/**
 * 获取单个技能
 */
export const useSkill = (id: number) => {
  return useQuery({
    queryKey: [SKILLS_KEY, id],
    queryFn: () => skillsService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建技能
 */
export const useCreateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SkillCreate) => skillsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SKILLS_KEY] });
    },
  });
};

/**
 * 更新技能
 */
export const useUpdateSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SkillUpdate }) =>
      skillsService.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [SKILLS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SKILLS_KEY, variables.id] });
    },
  });
};

/**
 * 删除技能
 */
export const useDeleteSkill = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => skillsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SKILLS_KEY] });
    },
  });
};
