/**
 * 视图查询相关 React Query Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { viewsService } from '@/services';

const VIEWS_KEY = 'views';

/**
 * 员工能力矩阵
 */
export const useEmployeeCompetencyMatrix = (employeeId?: string) => {
  return useQuery({
    queryKey: [VIEWS_KEY, 'competency-matrix', employeeId],
    queryFn: () => viewsService.getEmployeeCompetencyMatrix(employeeId),
  });
};

/**
 * 技能差距分析
 */
export const useSkillGapAnalysis = (employeeId?: string) => {
  return useQuery({
    queryKey: [VIEWS_KEY, 'skill-gap', employeeId],
    queryFn: () => viewsService.getSkillGapAnalysis(employeeId),
  });
};

/**
 * 员工工作量统计
 */
export const useEmployeeWorkload = () => {
  return useQuery({
    queryKey: [VIEWS_KEY, 'workload'],
    queryFn: () => viewsService.getEmployeeWorkload(),
  });
};

/**
 * 资源规划总览
 */
export const useResourcePlanningOverview = (week?: string) => {
  return useQuery({
    queryKey: [VIEWS_KEY, 'resource-planning', week],
    queryFn: () => viewsService.getResourcePlanningOverview(week),
  });
};

/**
 * 部门技能分布
 */
export const useDepartmentSkillDistribution = () => {
  return useQuery({
    queryKey: [VIEWS_KEY, 'department-skills'],
    queryFn: () => viewsService.getDepartmentSkillDistribution(),
  });
};

/**
 * 任务时间线
 */
export const useTaskTimeline = () => {
  return useQuery({
    queryKey: [VIEWS_KEY, 'task-timeline'],
    queryFn: () => viewsService.getTaskTimeline(),
  });
};
