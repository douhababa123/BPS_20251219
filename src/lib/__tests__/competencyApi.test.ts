import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../api-client';
import {
  averageAssessmentValues,
  getAssessmentMatrix,
  getCompetencyGapTrend,
  getMatrixData,
  saveAssessmentBatch,
} from '../competencyApi';

vi.mock('../api-client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

const assessment = (
  employeeId: string,
  currentLevel: number,
  targetLevel: number,
) => ({
  id: `${employeeId}-assessment`,
  employee_id: employeeId,
  employee_code: employeeId.toUpperCase(),
  employee_name: employeeId,
  department_name: null,
  department_code: null,
  skill_id: 1,
  module_id: 1,
  module_name: 'Module',
  skill_name: 'Skill',
  display_order: 1,
  current_level: currentLevel,
  target_level: targetLevel,
  gap: targetLevel - currentLevel,
  assessment_year: 2026,
  assessment_date: '2026-07-15',
  notes: null,
  created_at: null,
  updated_at: null,
});

describe('competencyApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes assessed zero values in averages and GAP', async () => {
    const matrix = await getMatrixData([
      assessment('e1', 0, 2),
      assessment('e2', 4, 4),
    ] as never);

    expect(matrix.stats.avgCurrentLevel).toBe(2);
    expect(matrix.stats.avgTargetLevel).toBe(3);
    expect(matrix.stats.totalGapScore).toBe(2);
  });

  it('averages every persisted value including zero for card summaries', () => {
    expect(averageAssessmentValues([0, 4])).toBe(2);
    expect(averageAssessmentValues([])).toBe(0);
  });

  it('sends changed cells in one explicit batch request', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { versionId: 'v1', savedCount: 1 } });

    await saveAssessmentBatch([{
      employee_id: 'e1', skill_id: 7, current_level: 0, target_level: 3,
      expected_updated_at: null, notes: 'Q3',
    }]);

    expect(apiClient.post).toHaveBeenCalledWith('/competency-assessments/batch-save', {
      cells: [{
        employee_id: 'e1', skill_id: 7, current_level: 0, target_level: 3,
        expected_updated_at: null, notes: 'Q3',
      }],
    });
  });

  it('loads the dedicated complete matrix endpoint', async () => {
    const payload = {
      rows: [],
      columns: [],
      stats: {
        totalEmployees: 0,
        totalSkills: 0,
        totalAssessments: 0,
        avgCurrentLevel: 0,
        avgTargetLevel: 0,
        avgGap: 0,
        totalGapScore: 0,
      },
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: payload });

    await expect(getAssessmentMatrix()).resolves.toEqual(payload);
    expect(apiClient.get).toHaveBeenCalledWith('/competency-assessments/matrix');
  });

  it('requests a filtered quarter-end GAP trend', async () => {
    const payload = { year: 2026, moduleId: 7, skillId: 21, quarters: [] };
    vi.mocked(apiClient.get).mockResolvedValue({ data: payload });

    await expect(
      getCompetencyGapTrend({ year: 2026, moduleId: 7, skillId: 21 }),
    ).resolves.toEqual(payload);

    expect(apiClient.get).toHaveBeenCalledWith('/competency-assessments/gap-trend', {
      params: { year: 2026, module_id: 7, skill_id: 21 },
    });
  });
});
