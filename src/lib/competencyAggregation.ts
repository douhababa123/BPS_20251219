/**
 * 能力画像数据聚合工具
 * 用于计算团队和个人的能力统计数据
 */

import type { AssessmentFull, Skill } from './database.types';

// 9大模块映射
export const MODULE_MAPPING = {
  1: { id: 1, name: 'BPS elements', icon: '🎯', color: '#92D050' },
  2: { id: 2, name: 'Investment efficiency_PGL', icon: '📊', color: '#FF0000' },
  3: { id: 3, name: 'Waste-free, stable flow_IE', icon: '📈', color: '#FFC000' },
  4: { id: 4, name: 'Waste-free, stable flow_TPM', icon: '⚙️', color: '#C00000' },
  5: { id: 5, name: 'Waste-free, stable flow_LBP', icon: '🔄', color: '#7030A0' },
  6: { id: 6, name: "Everybody's CIP", icon: '💡', color: '#002060' },
  7: { id: 7, name: 'Leadership commitment', icon: '👥', color: '#00B050' },
  8: { id: 8, name: 'CIP in indirect area_LEAN', icon: '⚡', color: '#00B0F0' },
  9: { id: 9, name: 'Digital Transformation', icon: '💻', color: '#0070C0' },
} as const;

// 模块信息
export interface ModuleInfo {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface EmployeeModuleGapCell {
  totalGap: number;
  hasData: boolean;
}

export interface EmployeeModuleGapRow {
  rank: number;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  modules: Record<number, EmployeeModuleGapCell>;
  totalGap: number;
}

export interface EmployeeModuleGapMatrix {
  modules: ModuleInfo[];
  rows: EmployeeModuleGapRow[];
  moduleTotals: Record<number, number>;
  grandTotal: number;
}

// 模块统计
export interface ModuleStats {
  moduleId: number;
  moduleName: string;
  icon: string;
  color: string;
  avgCurrent: number;
  avgTarget: number;
  totalCurrent: number; // 总现状分数（新增）
  totalTarget: number;  // 总目标分数（新增）
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
  totalGap: number;
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
    currentCount: number;
    targetCount: number;
    gapCount: number;
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
      currentCount: 0,
      targetCount: 0,
      gapCount: 0,
      employees: new Set<string>(),
      skills: new Set<number>(),
    };

    if (assessment.current_level > 0) {
      existing.totalCurrent += assessment.current_level;
      existing.currentCount += 1;
    }
    if (assessment.target_level > 0) {
      existing.totalTarget += assessment.target_level;
      existing.targetCount += 1;
    }
    if (assessment.current_level > 0 && assessment.target_level > 0) {
      existing.totalGap += assessment.gap;
      existing.gapCount += 1;
    }
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
        avgCurrent: stats.currentCount > 0 ? stats.totalCurrent / stats.currentCount : 0,
        avgTarget: stats.targetCount > 0 ? stats.totalTarget / stats.targetCount : 0,
        totalCurrent: stats.totalCurrent,  // 新增：总现状分数
        totalTarget: stats.totalTarget,    // 新增：总目标分数
        totalGap: stats.totalGap,
        avgGap: stats.gapCount > 0 ? stats.totalGap / stats.gapCount : 0,
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
        totalCurrent: 0,  // 新增：总现状分数
        totalTarget: 0,   // 新增：总目标分数
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
    currentCount: number;
    targetCount: number;
    gapCount: number;
    employees: Set<string>;
  }>();

  // 聚合数据
  assessments.forEach(assessment => {
    const existing = skillMap.get(assessment.skill_id) || {
      totalCurrent: 0,
      totalTarget: 0,
      totalGap: 0,
      count: 0,
      currentCount: 0,
      targetCount: 0,
      gapCount: 0,
      employees: new Set<string>(),
    };

    if (assessment.current_level > 0) {
      existing.totalCurrent += assessment.current_level;
      existing.currentCount += 1;
    }
    if (assessment.target_level > 0) {
      existing.totalTarget += assessment.target_level;
      existing.targetCount += 1;
    }
    if (assessment.current_level > 0 && assessment.target_level > 0) {
      existing.totalGap += assessment.gap;
      existing.gapCount += 1;
    }
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
      avgGap: stats.gapCount > 0 ? stats.totalGap / stats.gapCount : 0,
      employeeCount: stats.employees.size,
      avgCurrent: stats.currentCount > 0 ? stats.totalCurrent / stats.currentCount : 0,
      avgTarget: stats.targetCount > 0 ? stats.totalTarget / stats.targetCount : 0,
    });
  });

  // 按总Gap排序
  return result.sort((a, b) => b.totalGap - a.totalGap);
}

/**
 * Build the employee-by-module GAP ranking matrix for an already filtered year.
 */
export function calculateEmployeeModuleGapMatrix(
  assessments: AssessmentFull[],
  skills: Skill[]
): EmployeeModuleGapMatrix {
  const modules = Object.values(MODULE_MAPPING).map((module) => ({ ...module }));
  const moduleTotals: Record<number, number> = Object.fromEntries(
    modules.map((module) => [module.id, 0])
  );
  const skillModuleMap = new Map(skills.map((skill) => [skill.id, skill.module_id]));
  const employees = new Map<string, Omit<EmployeeModuleGapRow, 'rank'>>();

  assessments.forEach((assessment) => {
    let employee = employees.get(assessment.employee_id);
    if (!employee) {
      employee = {
        employeeId: assessment.employee_id,
        employeeName: assessment.employee_name,
        departmentName: assessment.department_name || null,
        modules: Object.fromEntries(
          modules.map((module) => [module.id, { totalGap: 0, hasData: false }])
        ),
        totalGap: 0,
      };
      employees.set(assessment.employee_id, employee);
    }

    if (assessment.current_level <= 0 || assessment.target_level <= 0) return;

    const moduleId = skillModuleMap.get(assessment.skill_id);
    if (!moduleId || !employee.modules[moduleId]) return;

    const cell = employee.modules[moduleId];
    cell.totalGap += assessment.gap;
    cell.hasData = true;
    employee.totalGap += assessment.gap;
    moduleTotals[moduleId] += assessment.gap;
  });

  const rows = Array.from(employees.values())
    .sort((a, b) => b.totalGap - a.totalGap || a.employeeName.localeCompare(b.employeeName))
    .map((employee, index) => ({ ...employee, rank: index + 1 }));

  return {
    modules,
    rows,
    moduleTotals,
    grandTotal: rows.reduce((sum, row) => sum + row.totalGap, 0),
  };
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
    currentCount: number;
    targetCount: number;
    gapCount: number;
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
      currentCount: 0,
      targetCount: 0,
      gapCount: 0,
    };

    if (assessment.current_level > 0) {
      existing.totalCurrent += assessment.current_level;
      existing.currentCount += 1;
    }
    if (assessment.target_level > 0) {
      existing.totalTarget += assessment.target_level;
      existing.targetCount += 1;
    }
    if (assessment.current_level > 0 && assessment.target_level > 0) {
      existing.totalGap += assessment.gap;
      existing.gapCount += 1;
    }
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
        current: stats.currentCount > 0 ? stats.totalCurrent / stats.currentCount : 0,
        target: stats.targetCount > 0 ? stats.totalTarget / stats.targetCount : 0,
        gap: stats.gapCount > 0 ? stats.totalGap / stats.gapCount : 0,
        totalGap: stats.totalGap,
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
        totalGap: 0,
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
    void skills.find(s => s.id === assessment.skill_id); // 保留参数兼容性
    
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
export function formatNumber(num: number | undefined | null, decimals: number = 1): string {
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  return num.toFixed(decimals);
}
