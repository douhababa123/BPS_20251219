/**
 * 能力评估 API 客户端 - SQL Server版本
 */

import { apiClient } from './api-client'; // 重用项目的 API 客户端
import type { AssessmentFull, MatrixRow, MatrixColumn, AssessmentStats } from './database.types';

// SQL Server数据类型定义
interface Employee {
  id: string;
  employee_id: string;
  name: string;
  department_id?: number;
  department_name?: string;
}

interface Skill {
  id: number;
  module_id: number;
  module_name: string;
  skill_name: string;
  display_order?: number;
}

interface Department {
  id: number;
  name: string;
  code?: string;
}

interface Assessment {
  id: number;
  employee_id: string;
  skill_id: number;
  current_level: number;
  target_level: number;
  gap: number;
  assessment_year: number;
  assessment_date: string;
  assessor_notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 获取所有能力评估数据（串行加载以避免数据库连接池问题）
 */
export async function getAllAssessments(): Promise<AssessmentFull[]> {
  console.log('🔄 competencyApi: 开始加载能力评估数据...');
  
  try {
    // 串行加载各个数据源
    console.log('  📥 1/4 加载评估记录...');
    const assessmentsRes = await apiClient.get('/competency-assessments');
    console.log(`  ✅ 获取 ${assessmentsRes.data.length} 条评估记录`);

    console.log('  📥 2/4 加载员工信息...');
    const employeesRes = await apiClient.get('/employees');
    console.log(`  ✅ 获取 ${employeesRes.data.length} 名员工`);

    console.log('  📥 3/4 加载技能信息...');
    const skillsRes = await apiClient.get('/matching/skills');
    console.log(`  ✅ 获取 ${skillsRes.data.length} 项技能`);

    console.log('  📥 4/4 加载部门信息...');
    const departmentsRes = await apiClient.get('/departments');
    console.log(`  ✅ 获取 ${departmentsRes.data.length} 个部门`);

    // 创建查找映射
    const employeeMap = new Map<string, Employee>(
      employeesRes.data.map((e: Employee) => [e.id, e])
    );
    
    // 映射技能数据：后端返回驼峰命名，前端使用下划线命名
    const skillMap = new Map<number, Skill>(
      skillsRes.data.map((s: any) => [
        s.id,
        {
          id: s.id,
          module_id: s.moduleId,  // 映射驼峰到下划线
          module_name: s.moduleName,  // 映射驼峰到下划线
          skill_name: s.name,  // 后端返回的是name字段
          display_order: s.displayOrder || 0,
        }
      ])
    );
    
    const departmentMap = new Map<number, Department>(
      departmentsRes.data.map((d: Department) => [d.id, d])
    );

    console.log('  🔄 开始转换和合并数据...');

    // 转换为AssessmentFull格式
    const fullAssessments: AssessmentFull[] = assessmentsRes.data
      .map((assessment: Assessment) => {
        const employee = employeeMap.get(assessment.employee_id);
        const skill = skillMap.get(assessment.skill_id);

        if (!employee || !skill) {
          console.warn('⚠️ 缺少关联数据:', {
            assessmentId: assessment.id,
            hasEmployee: !!employee,
            hasSkill: !!skill,
          });
          return null;
        }

        const department = employee.department_id 
          ? departmentMap.get(employee.department_id)
          : null;

        // 按照database.types.ts中的AssessmentFull类型结构
        return {
          id: assessment.id,
          employee_id: assessment.employee_id,
          employee_code: employee.employee_id || '',
          employee_name: employee.name,
          department_name: department?.name || employee.department_name || null,
          department_code: department?.code || null,
          skill_id: assessment.skill_id,
          module_id: skill.module_id,
          module_name: skill.module_name,
          skill_name: skill.skill_name,
          display_order: skill.display_order || 0,
          current_level: assessment.current_level,
          target_level: assessment.target_level,
          gap: assessment.gap || (assessment.target_level - assessment.current_level),
          assessment_year: new Date(assessment.assessment_date).getFullYear(),
          assessment_date: assessment.assessment_date,
          notes: assessment.assessor_notes || null,
          created_at: assessment.created_at,
          updated_at: assessment.updated_at,
        };
      })
      .filter((a: AssessmentFull | null): a is AssessmentFull => a !== null);

    console.log('✅ competencyApi: 数据加载完成', {
      totalAssessments: fullAssessments.length,
      uniqueEmployees: new Set(fullAssessments.map(a => a.employee_id)).size,
      uniqueSkills: new Set(fullAssessments.map(a => a.skill_id)).size,
    });

    return fullAssessments;
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
  const totalGap = assessments.reduce((sum, a) => sum + a.gap, 0);
  
  return {
    rows,
    columns,
    stats: {
      totalAssessments: assessments.length,
      totalEmployees: rows.length,
      totalSkills: columns.length,
      avgCurrentLevel: assessments.length > 0
        ? Math.round((assessments.reduce((sum, a) => sum + a.current_level, 0) / assessments.length) * 10) / 10
        : 0,
      avgTargetLevel: assessments.length > 0
        ? Math.round((assessments.reduce((sum, a) => sum + a.target_level, 0) / assessments.length) * 10) / 10
        : 0,
      avgGap: assessments.length > 0
        ? Math.round((assessments.reduce((sum, a) => sum + a.gap, 0) / assessments.length) * 10) / 10
        : 0,
      totalGapScore: totalGap,
    },
  };
}
