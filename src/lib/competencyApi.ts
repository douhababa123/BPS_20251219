/**
 * 能力评估 API 客户端 - SQL Server版本
 */

import { apiClient } from './api-client'; // 重用项目的 API 客户端
import type { AssessmentFull, MatrixRow, MatrixColumn, AssessmentStats } from './database.types';

/**
 * 获取所有能力评估数据（单次 SQL JOIN，后端完成关联）
 */
export async function getAllAssessments(): Promise<AssessmentFull[]> {
  console.log('🔄 competencyApi: 开始加载能力评估数据...');

  try {
    const res = await apiClient.get('/competency-assessments/full');
    const data: AssessmentFull[] = res.data;

    console.log('✅ competencyApi: 数据加载完成', {
      totalAssessments: data.length,
      uniqueEmployees: new Set(data.map(a => a.employee_id)).size,
      uniqueSkills: new Set(data.map(a => a.skill_id)).size,
    });

    return data;
  } catch (error) {
    console.error('❌ competencyApi: 加载数据失败', error);
    if (error instanceof Error) {
      throw new Error(`加载能力评估数据失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 获取矩阵视图数据（构建真实的矩阵结构）
 */
export async function getMatrixData(assessments: AssessmentFull[]): Promise<{
  rows: MatrixRow[];
  columns: MatrixColumn[];
  stats: AssessmentStats;
}> {
  console.log('🔄 competencyApi: 构建矩阵数据', {
    totalAssessments: assessments.length,
  });
  
  // 按员工分组
  const employeeMap = new Map<string, AssessmentFull[]>();
  assessments.forEach(assessment => {
    const key = assessment.employee_id;
    if (!employeeMap.has(key)) {
      employeeMap.set(key, []);
    }
    employeeMap.get(key)!.push(assessment);
  });
  
  // 构建行数据（员工）
  const rows = Array.from(employeeMap.entries()).map(([employeeId, empAssessments]) => {
    const first = empAssessments[0];
    
    // 构建技能映射：skill_id -> assessment details
    const skills: Record<number, {
      skillId: number;
      currentLevel: number;
      targetLevel: number;
      gap: number;
    }> = {};
    
    empAssessments.forEach(assessment => {
      skills[assessment.skill_id] = {
        skillId: assessment.skill_id,
        currentLevel: assessment.current_level,
        targetLevel: assessment.target_level,
        gap: assessment.gap,
      };
    });
    
    return {
      employeeId: employeeId,
      employeeCode: first.employee_code,
      employeeName: first.employee_name,
      departmentName: first.department_name || null,
      skills: skills,
    };
  });
  
  // 按技能分组构建列数据
  const skillMap = new Map<number, { skill: AssessmentFull; count: number }>();
  assessments.forEach(assessment => {
    const existing = skillMap.get(assessment.skill_id);
    if (existing) {
      existing.count++;
    } else {
      skillMap.set(assessment.skill_id, { skill: assessment, count: 1 });
    }
  });
  
  // 构建列数据（技能）- 按display_order排序
  const columns = Array.from(skillMap.values())
    .sort((a, b) => a.skill.display_order - b.skill.display_order)
    .map(({ skill }) => ({
      skillId: skill.skill_id,
      moduleId: skill.module_id,
      moduleName: skill.module_name,
      skillName: skill.skill_name,
      displayOrder: skill.display_order || 0,
    }));
  
  console.log('✅ 矩阵构建完成', {
    rows: rows.length,
    columns: columns.length,
  });
  
  // 计算统计数据
  const currentValues = assessments.map(a => a.current_level).filter(level => level > 0);
  const targetValues = assessments.map(a => a.target_level).filter(level => level > 0);
  const completeAssessments = assessments.filter(a => a.current_level > 0 && a.target_level > 0);
  const totalGap = completeAssessments.reduce((sum, a) => sum + a.gap, 0);
  
  return {
    rows,
    columns,
    stats: {
      totalAssessments: assessments.length,
      totalEmployees: rows.length,
      totalSkills: columns.length,
      avgCurrentLevel: currentValues.length > 0
        ? Math.round((currentValues.reduce((sum, level) => sum + level, 0) / currentValues.length) * 10) / 10
        : 0,
      avgTargetLevel: targetValues.length > 0
        ? Math.round((targetValues.reduce((sum, level) => sum + level, 0) / targetValues.length) * 10) / 10
        : 0,
      avgGap: completeAssessments.length > 0
        ? Math.round((totalGap / completeAssessments.length) * 10) / 10
        : 0,
      totalGapScore: totalGap,
    },
  };
}
