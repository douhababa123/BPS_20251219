/**
 * 能力画像数据聚合工具
 * 用于计算团队和个人的能力统计数据
 */

import type { AssessmentFull, Skill, Employee } from './database.types';

// 9大模块映射
export const MODULE_MAPPING = {
  1: { id: 1, name: 'BPS elements', icon: '🎯', color: '#1E3A8A' },
  2: { id: 2, name: 'Investment efficiency_PGL', icon: '📊', color: '#2563EB' },
  3: { id: 3, name: 'Investment efficiency_IE', icon: '📈', color: '#3B82F6' },
  4: { id: 4, name: 'Waste-free&stable flow_TPM', icon: '⚙️', color: '#0EA5E9' },
  5: { id: 5, name: 'Waste-free&stable flow_LBP', icon: '🔄', color: '#06B6D4' },
  6: { id: 6, name: "Everybody's CIP", icon: '💡', color: '#14B8A6' },
  7: { id: 7, name: 'Leadership commitment', icon: '👥', color: '#10B981' },
  8: { id: 8, name: 'CIP in indirect area_LEAN', icon: '⚡', color: '#84CC16' },
  9: { id: 9, name: 'Digital Transformation', icon: '💻', color: '#EAB308' },
} as const;

// 模块信息
export interface ModuleInfo {
  id: number;
  name: string;
  icon: string;
  color: string;
}

// 模块统计
export interface ModuleStats {
  moduleId: number;
  moduleName: string;
  icon: string;
  color: string;
  avgCurrent: number;
  avgTarget: number;
  totalGap: number;
  avgGap: number;
  employeeCount: number;
  skillCount: number;
}

// 技能统计
export interface SkillStats {
  skillId: number;
  skillName: string;
  moduleName: string;
  moduleIcon: string;
  totalGap: number;
  avgGap: number;
  employeeCount: number;
  avgCurrent: number;
  avgTarget: number;
}

// 个人模块统计
export interface PersonalModuleStats {
  moduleId: number;
  moduleName: string;
  icon: string;
  color: string;
  current: number;
  target: number;
  gap: number;
  skillCount: number;
}

// 个人技能统计
export interface PersonalSkillStats {
  skillId: number;
  skillName: string;
  moduleName: string;
  current: number;
  target: number;
  gap: number;
}

/**
 * 计算团队模块统计（9大模块维度）
 */
export function calculateTeamModuleStats(
  assessments: AssessmentFull[],
  skills: Skill[]
): ModuleStats[] {
  const moduleMap = new Map<number, {
    totalCurrent: number;
    totalTarget: number;
    totalGap: number;
    count: number;
    employees: Set<string>;
    skills: Set<number>;
  }>();

  // 聚合数据
  assessments.forEach(assessment => {
    const skill = skills.find(s => s.id === assessment.skill_id);
    if (!skill) return;

    const moduleId = skill.module_id;
    const existing = moduleMap.get(moduleId) || {
      totalCurrent: 0,
      totalTarget: 0,
      totalGap: 0,
      count: 0,
      employees: new Set<string>(),
      skills: new Set<number>(),
    };

    existing.totalCurrent += assessment.current_level;
    existing.totalTarget += assessment.target_level;
    existing.totalGap += assessment.gap;
    existing.count += 1;
    existing.employees.add(assessment.employee_id);
    existing.skills.add(skill.id);

    moduleMap.set(moduleId, existing);
  });

  // 转换为数组
  const result: ModuleStats[] = [];
  for (let i = 1; i <= 9; i++) {
    const stats = moduleMap.get(i);
    const moduleInfo = MODULE_MAPPING[i as keyof typeof MODULE_MAPPING];
    
    if (stats && stats.count > 0) {
      result.push({
        moduleId: i,
        moduleName: moduleInfo.name,
        icon: moduleInfo.icon,
        color: moduleInfo.color,
        avgCurrent: stats.totalCurrent / stats.count,
        avgTarget: stats.totalTarget / stats.count,
        totalGap: stats.totalGap,
        avgGap: stats.totalGap / stats.count,
        employeeCount: stats.employees.size,
        skillCount: stats.skills.size,
      });
    } else {
      // 没有数据的模块也要显示
      result.push({
        moduleId: i,
        moduleName: moduleInfo.name,
        icon: moduleInfo.icon,
        color: moduleInfo.color,
        avgCurrent: 0,
        avgTarget: 0,
        totalGap: 0,
        avgGap: 0,
        employeeCount: 0,
        skillCount: 0,
      });
    }
  }

  return result;
}

/**
 * 计算团队技能统计（39个技能维度）
 */
export function calculateTeamSkillStats(
  assessments: AssessmentFull[],
  skills: Skill[]
): SkillStats[] {
  const skillMap = new Map<number, {
    totalCurrent: number;
    totalTarget: number;
    totalGap: number;
    count: number;
    employees: Set<string>;
  }>();

  // 聚合数据
  assessments.forEach(assessment => {
    const existing = skillMap.get(assessment.skill_id) || {
      totalCurrent: 0,
      totalTarget: 0,
      totalGap: 0,
      count: 0,
      employees: new Set<string>(),
    };

    existing.totalCurrent += assessment.current_level;
    existing.totalTarget += assessment.target_level;
    existing.totalGap += assessment.gap;
    existing.count += 1;
    existing.employees.add(assessment.employee_id);

    skillMap.set(assessment.skill_id, existing);
  });

  // 转换为数组
  const result: SkillStats[] = [];
  
  skillMap.forEach((stats, skillId) => {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) return;

    const moduleInfo = MODULE_MAPPING[skill.module_id as keyof typeof MODULE_MAPPING];

    result.push({
      skillId,
      skillName: skill.skill_name,
      moduleName: skill.module_name,
      moduleIcon: moduleInfo?.icon || '📌',
      totalGap: stats.totalGap,
      avgGap: stats.totalGap / stats.count,
      employeeCount: stats.employees.size,
      avgCurrent: stats.totalCurrent / stats.count,
      avgTarget: stats.totalTarget / stats.count,
    });
  });

  // 按总Gap排序
  return result.sort((a, b) => b.totalGap - a.totalGap);
}

/**
 * 计算个人模块统计（9大模块维度）
 */
export function calculatePersonalModuleStats(
  employeeId: string,
  assessments: AssessmentFull[],
  skills: Skill[]
): PersonalModuleStats[] {
  // 筛选该员工的评估
  const personalAssessments = assessments.filter(a => a.employee_id === employeeId);

  const moduleMap = new Map<number, {
    totalCurrent: number;
    totalTarget: number;
    totalGap: number;
    count: number;
  }>();

  // 聚合数据
  personalAssessments.forEach(assessment => {
    const skill = skills.find(s => s.id === assessment.skill_id);
    if (!skill) return;

    const moduleId = skill.module_id;
    const existing = moduleMap.get(moduleId) || {
      totalCurrent: 0,
      totalTarget: 0,
      totalGap: 0,
      count: 0,
    };

    existing.totalCurrent += assessment.current_level;
    existing.totalTarget += assessment.target_level;
    existing.totalGap += assessment.gap;
    existing.count += 1;

    moduleMap.set(moduleId, existing);
  });

  // 转换为数组
  const result: PersonalModuleStats[] = [];
  for (let i = 1; i <= 9; i++) {
    const stats = moduleMap.get(i);
    const moduleInfo = MODULE_MAPPING[i as keyof typeof MODULE_MAPPING];
    
    if (stats && stats.count > 0) {
      result.push({
        moduleId: i,
        moduleName: moduleInfo.name,
        icon: moduleInfo.icon,
        color: moduleInfo.color,
        current: stats.totalCurrent / stats.count,
        target: stats.totalTarget / stats.count,
        gap: stats.totalGap / stats.count,
        skillCount: stats.count,
      });
    } else {
      result.push({
        moduleId: i,
        moduleName: moduleInfo.name,
        icon: moduleInfo.icon,
        color: moduleInfo.color,
        current: 0,
        target: 0,
        gap: 0,
        skillCount: 0,
      });
    }
  }

  return result;
}

/**
 * 计算个人技能统计（所有技能维度）
 */
export function calculatePersonalSkillStats(
  employeeId: string,
  assessments: AssessmentFull[],
  skills: Skill[]
): PersonalSkillStats[] {
  // 筛选该员工的评估
  const personalAssessments = assessments.filter(a => a.employee_id === employeeId);

  const result: PersonalSkillStats[] = personalAssessments.map(assessment => {
    const skill = skills.find(s => s.id === assessment.skill_id);
    
    return {
      skillId: assessment.skill_id,
      skillName: assessment.skill_name,
      moduleName: assessment.module_name,
      current: assessment.current_level,
      target: assessment.target_level,
      gap: assessment.gap,
    };
  });

  // 按Gap排序
  return result.sort((a, b) => b.gap - a.gap);
}

/**
 * 获取排名图标
 */
export function getRankIcon(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return `${rank}`;
  }
}

/**
 * 格式化数字
 */
export function formatNumber(num: number, decimals: number = 1): string {
  return num.toFixed(decimals);
}
