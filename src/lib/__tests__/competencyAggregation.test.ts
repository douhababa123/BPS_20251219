import { describe, it, expect } from 'vitest';
import {
  MODULE_MAPPING,
  calculateTeamModuleStats,
  calculateTeamSkillStats,
  calculatePersonalModuleStats,
  calculatePersonalSkillStats,
  calculateEmployeeGapDistribution,
  calculateEmployeeModuleGapSummary,
  formatNumber,
} from '../competencyAggregation';
import type { AssessmentFull, Skill } from '../database.types';

// ──────────────────────────────────────────────────────────
// 测试 Fixtures
// ──────────────────────────────────────────────────────────

const mockSkills: Skill[] = [
  {
    id: 1,
    module_id: 1,
    module_name: 'BPS elements',
    skill_name: 'Skill A',
    skill_code: null,
    description: null,
    display_order: 1,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 2,
    module_id: 1,
    module_name: 'BPS elements',
    skill_name: 'Skill B',
    skill_code: null,
    description: null,
    display_order: 2,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 3,
    module_id: 2,
    module_name: 'Investment efficiency_PGL',
    skill_name: 'Skill C',
    skill_code: null,
    description: null,
    display_order: 1,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

const baseAssessment = {
  id: '',
  employee_code: 'EMP001',
  employee_name: '张三',
  department_name: 'Dept A',
  department_code: 'D001',
  module_name: 'BPS elements',
  skill_name: 'Skill A',
  display_order: 1,
  assessment_year: 2025,
  assessment_date: '2025-01-01',
  notes: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockAssessments: AssessmentFull[] = [
  {
    ...baseAssessment,
    id: 'a1',
    employee_id: 'emp-1',
    skill_id: 1,
    module_id: 1,
    current_level: 2,
    target_level: 4,
    gap: 2,
  },
  {
    ...baseAssessment,
    id: 'a2',
    employee_id: 'emp-1',
    skill_id: 2,
    module_id: 1,
    current_level: 3,
    target_level: 4,
    gap: 1,
  },
  {
    ...baseAssessment,
    id: 'a3',
    employee_id: 'emp-2',
    skill_id: 1,
    module_id: 1,
    current_level: 4,
    target_level: 4,
    gap: 0,
  },
  {
    ...baseAssessment,
    id: 'a4',
    employee_id: 'emp-2',
    skill_id: 3,
    module_id: 2,
    module_name: 'Investment efficiency_PGL',
    skill_name: 'Skill C',
    current_level: 1,
    target_level: 3,
    gap: 2,
  },
];

// ──────────────────────────────────────────────────────────
// MODULE_MAPPING 常量
// ──────────────────────────────────────────────────────────

describe('MODULE_MAPPING 常量', () => {
  it('包含 9 个模块', () => {
    expect(Object.keys(MODULE_MAPPING)).toHaveLength(9);
  });

  it('模块 ID 从 1 到 9 连续', () => {
    for (let i = 1; i <= 9; i++) {
      expect(MODULE_MAPPING[i as keyof typeof MODULE_MAPPING]).toBeDefined();
    }
  });

  it('每个模块有 id / name / icon / color 字段', () => {
    Object.values(MODULE_MAPPING).forEach((m) => {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('icon');
      expect(m).toHaveProperty('color');
    });
  });
});

// ──────────────────────────────────────────────────────────
// calculateTeamModuleStats
// ──────────────────────────────────────────────────────────

describe('calculateTeamModuleStats', () => {
  it('始终返回 9 个模块', () => {
    const result = calculateTeamModuleStats(mockAssessments, mockSkills);
    expect(result).toHaveLength(9);
  });

  it('模块 1 的统计计算正确', () => {
    const result = calculateTeamModuleStats(mockAssessments, mockSkills);
    const mod1 = result.find((m) => m.moduleId === 1)!;

    // 3 条记录属于 module 1: gap = 2+1+0 = 3
    expect(mod1.totalGap).toBe(3);
    expect(mod1.employeeCount).toBe(2); // emp-1, emp-2
    expect(mod1.skillCount).toBe(2);    // skill 1, skill 2
  });

  it('没有数据的模块 gap=0 且 employeeCount=0', () => {
    const result = calculateTeamModuleStats(mockAssessments, mockSkills);
    // 模块 3~9 均无数据
    const mod3 = result.find((m) => m.moduleId === 3)!;
    expect(mod3.avgGap).toBe(0);
    expect(mod3.employeeCount).toBe(0);
  });

  it('空 assessments 时所有模块均为零值', () => {
    const result = calculateTeamModuleStats([], mockSkills);
    result.forEach((m) => {
      expect(m.avgCurrent).toBe(0);
      expect(m.avgGap).toBe(0);
    });
  });

  it('avgCurrent 计算正确', () => {
    const result = calculateTeamModuleStats(mockAssessments, mockSkills);
    const mod1 = result.find((m) => m.moduleId === 1)!;
    // totalCurrent = 2+3+4 = 9, count = 3
    expect(mod1.avgCurrent).toBeCloseTo(3.0, 5);
  });

  it('includes assessed zero in module averages and total GAP', () => {
    const rows: AssessmentFull[] = [
      { ...mockAssessments[0], employee_id: 'emp-1', current_level: 0, target_level: 2, gap: 2 },
      { ...mockAssessments[2], employee_id: 'emp-2', current_level: 4, target_level: 4, gap: 0 },
    ];
    const module = calculateTeamModuleStats(rows, mockSkills)[0];
    expect(module.avgCurrent).toBe(2);
    expect(module.avgTarget).toBe(3);
    expect(module.totalGap).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────
// calculateTeamSkillStats
// ──────────────────────────────────────────────────────────

describe('calculateTeamSkillStats', () => {
  it('返回有数据的技能数量', () => {
    const result = calculateTeamSkillStats(mockAssessments, mockSkills);
    // skill 1, skill 2, skill 3 都有数据
    expect(result).toHaveLength(3);
  });

  it('按 totalGap 降序排列', () => {
    const result = calculateTeamSkillStats(mockAssessments, mockSkills);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].totalGap).toBeGreaterThanOrEqual(result[i + 1].totalGap);
    }
  });

  it('skill 1 统计正确（两人都有）', () => {
    const result = calculateTeamSkillStats(mockAssessments, mockSkills);
    const s1 = result.find((s) => s.skillId === 1)!;
    expect(s1.totalGap).toBe(2); // emp-1: gap=2, emp-2: gap=0
    expect(s1.employeeCount).toBe(2);
    expect(s1.avgCurrent).toBeCloseTo(3.0, 5); // (2+4)/2
  });

  it('keeps active skills without selected-year assessments at zero', () => {
    const result = calculateTeamSkillStats([], mockSkills);
    expect(result.map((skill) => [skill.skillId, skill.totalGap])).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
  });
});

// ──────────────────────────────────────────────────────────
// calculatePersonalModuleStats
// ──────────────────────────────────────────────────────────

describe('calculatePersonalModuleStats', () => {
  it('始终返回 9 个模块', () => {
    const result = calculatePersonalModuleStats('emp-1', mockAssessments, mockSkills);
    expect(result).toHaveLength(9);
  });

  it('emp-1 模块 1 数据正确', () => {
    const result = calculatePersonalModuleStats('emp-1', mockAssessments, mockSkills);
    const mod1 = result.find((m) => m.moduleId === 1)!;
    // emp-1: skill1(cur=2,tgt=4,gap=2), skill2(cur=3,tgt=4,gap=1) → avg
    expect(mod1.current).toBeCloseTo(2.5, 5);
    expect(mod1.target).toBeCloseTo(4.0, 5);
    expect(mod1.gap).toBeCloseTo(1.5, 5);
    expect(mod1.totalGap).toBe(3);
    expect(mod1.skillCount).toBe(2);
  });

  it('treats current level zero as assessed data in personal totals', () => {
    const assessments: AssessmentFull[] = [
      ...mockAssessments,
      {
        ...baseAssessment,
        id: 'a-incomplete',
        employee_id: 'emp-1',
        skill_id: 1,
        module_id: 1,
        current_level: 0,
        target_level: 4,
        gap: 4,
      },
    ];

    const result = calculatePersonalModuleStats('emp-1', assessments, mockSkills);
    const mod1 = result.find((module) => module.moduleId === 1)!;

    expect(mod1.totalGap).toBe(7);
    expect(mod1.gap).toBeCloseTo(7 / 3, 5);
    expect(mod1.skillCount).toBe(3);
  });

  it('该员工无数据的模块均为 0', () => {
    const result = calculatePersonalModuleStats('emp-1', mockAssessments, mockSkills);
    // emp-1 没有 module 3~9 数据
    const mod3 = result.find((m) => m.moduleId === 3)!;
    expect(mod3.current).toBe(0);
    expect(mod3.gap).toBe(0);
    expect(mod3.totalGap).toBe(0);
  });

  it('不存在的员工返回全零模块', () => {
    const result = calculatePersonalModuleStats('nonexistent', mockAssessments, mockSkills);
    result.forEach((m) => {
      expect(m.current).toBe(0);
      expect(m.gap).toBe(0);
    });
  });
});

describe('calculateEmployeeModuleGapSummary', () => {
  it('aggregates every employee by module and produces matching totals', () => {
    const matrix = calculateEmployeeModuleGapSummary(mockAssessments, mockSkills);

    expect(matrix.modules).toHaveLength(9);
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows.find((row) => row.employeeId === 'emp-1')?.modules[1]).toEqual({
      totalGap: 3,
      hasData: true,
    });
    expect(matrix.rows.find((row) => row.employeeId === 'emp-2')?.modules[1]).toEqual({
      totalGap: 0,
      hasData: true,
    });
    expect(matrix.moduleTotals[1]).toBe(3);
    expect(matrix.moduleTotals[2]).toBe(2);
    expect(matrix.grandTotal).toBe(5);
  });

  it('sorts by employee name and has no rank', () => {
    const tiedAssessments = mockAssessments.map((assessment) =>
      assessment.employee_id === 'emp-1'
        ? { ...assessment, employee_name: 'Zoe', gap: assessment.id === 'a1' ? 2 : 0 }
        : { ...assessment, employee_name: 'Amy' }
    );
    const matrix = calculateEmployeeModuleGapSummary(tiedAssessments, mockSkills);

    expect(matrix.rows.map((row) => row.employeeName)).toEqual(['Amy', 'Zoe']);
    expect(matrix.rows[0]).not.toHaveProperty('rank');
  });

  it('distinguishes missing data from assessed zero', () => {
    const assessments: AssessmentFull[] = [
      { ...mockAssessments[0], current_level: 4, target_level: 4, gap: 0 },
      { ...mockAssessments[3], current_level: 0, target_level: 3, gap: 3 },
    ];
    const matrix = calculateEmployeeModuleGapSummary(assessments, mockSkills);
    const emp1 = matrix.rows.find((row) => row.employeeId === 'emp-1')!;
    const emp2 = matrix.rows.find((row) => row.employeeId === 'emp-2')!;

    expect(emp1.modules[1]).toEqual({ totalGap: 0, hasData: true });
    expect(emp1.modules[2]).toEqual({ totalGap: 0, hasData: false });
    expect(emp2.modules[2]).toEqual({ totalGap: 3, hasData: true });
    expect(matrix.moduleTotals[1]).toBe(0);
    expect(matrix.moduleTotals[2]).toBe(3);
    expect(matrix.grandTotal).toBe(3);
  });

  it('returns fixed module totals and no rows for an empty assessment set', () => {
    const matrix = calculateEmployeeModuleGapSummary([], mockSkills);

    expect(matrix.rows).toEqual([]);
    expect(matrix.modules).toHaveLength(9);
    expect(Object.values(matrix.moduleTotals)).toEqual(Array(9).fill(0));
    expect(matrix.grandTotal).toBe(0);
  });

  it('includes active employees without selected-year data', () => {
    const summary = calculateEmployeeModuleGapSummary(mockAssessments, mockSkills, [
      { employeeId: 'emp-3', employeeName: 'No Data', departmentName: 'D' },
      { employeeId: 'emp-1', employeeName: 'Zoe', departmentName: 'D' },
      { employeeId: 'emp-2', employeeName: 'Amy', departmentName: 'D' },
    ]);

    expect(summary.rows.map((row) => row.employeeName)).toEqual(['Amy', 'No Data', 'Zoe']);
    expect(summary.rows[1].totalGap).toBe(0);
    expect(Object.values(summary.rows[1].modules).every((cell) => !cell.hasData)).toBe(true);
  });
});

describe('calculateEmployeeGapDistribution', () => {
  const employees = [
    { employeeId: 'emp-1', employeeName: 'Zoe', departmentName: 'D' },
    { employeeId: 'emp-2', employeeName: 'Amy', departmentName: 'D' },
    { employeeId: 'emp-3', employeeName: 'No Data', departmentName: 'D' },
  ];

  it('shows every active employee for a selected module', () => {
    const points = calculateEmployeeGapDistribution(
      mockAssessments,
      mockSkills,
      employees,
      { dimension: 'module', itemId: 1 },
    );

    expect(points.map((point) => [point.employeeName, point.totalGap, point.hasData])).toEqual([
      ['Zoe', 3, true],
      ['Amy', 0, true],
      ['No Data', 0, false],
    ]);
  });

  it('filters by selected skill and sorts ties by employee name', () => {
    const points = calculateEmployeeGapDistribution(
      mockAssessments,
      mockSkills,
      employees,
      { dimension: 'skill', itemId: 2 },
    );

    expect(points.map((point) => [point.employeeName, point.totalGap, point.hasData])).toEqual([
      ['Zoe', 1, true],
      ['Amy', 0, false],
      ['No Data', 0, false],
    ]);
  });
});

// ──────────────────────────────────────────────────────────
// calculatePersonalSkillStats
// ──────────────────────────────────────────────────────────

describe('calculatePersonalSkillStats', () => {
  it('只返回该员工的技能', () => {
    const result = calculatePersonalSkillStats('emp-1', mockAssessments, mockSkills);
    expect(result).toHaveLength(2); // emp-1 有 2 条记录
  });

  it('按 gap 降序排列', () => {
    const result = calculatePersonalSkillStats('emp-1', mockAssessments, mockSkills);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].gap).toBeGreaterThanOrEqual(result[i + 1].gap);
    }
  });

  it('不存在的员工返回空数组', () => {
    const result = calculatePersonalSkillStats('nonexistent', mockAssessments, mockSkills);
    expect(result).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────
// formatNumber
// ──────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('默认保留 1 位小数', () => {
    expect(formatNumber(3.14159)).toBe('3.1');
  });

  it('指定精度', () => {
    expect(formatNumber(3.14159, 2)).toBe('3.14');
  });

  it('undefined 返回 "0"', () => {
    expect(formatNumber(undefined)).toBe('0');
  });

  it('null 返回 "0"', () => {
    expect(formatNumber(null)).toBe('0');
  });

  it('NaN 返回 "0"', () => {
    expect(formatNumber(NaN)).toBe('0');
  });

  it('整数值保留小数位', () => {
    expect(formatNumber(3, 1)).toBe('3.0');
  });
});
