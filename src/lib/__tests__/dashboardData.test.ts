import { describe, expect, it } from 'vitest';
import {
  buildCalendarSlotsFromTasks,
  buildCompetencyDistribution,
  buildTaskDistributions,
  buildWorkflowSummary,
  getAssessmentYears,
} from '../dashboardData';

describe('dashboardData', () => {
  it('builds fixed LV0-LV4 competency distribution from real assessment fields', () => {
    const result = buildCompetencyDistribution([
      { current_level: 0 },
      { current_level: 1 },
      { current_level: 1 },
      { current_level: 4 },
      { current_level: 5 },
      { current_level: null },
    ]);

    expect(result).toEqual([
      { level: 0, count: 2, name: 'LV0' },
      { level: 1, count: 2, name: 'LV1' },
      { level: 2, count: 0, name: 'LV2' },
      { level: 3, count: 0, name: 'LV3' },
      { level: 4, count: 2, name: 'LV4' },
    ]);
  });

  it('derives available assessment years from real assessment_year values', () => {
    expect(getAssessmentYears([
      { assessment_year: 2026 },
      { assessment_year: 2025 },
      { assessment_year: 2026 },
    ])).toEqual([2026, 2025]);
  });

  it('summarizes task workflow counts from task status values', () => {
    expect(buildWorkflowSummary([
      { status: 'pending_approval' },
      { status: 'planned' },
      { status: 'confirmed' },
      { status: 'employee_rejected' },
    ])).toEqual({
      pendingApproval: 1,
      assigned: 2,
      rejected: 1,
    });
  });

  it('builds task type and location hour distributions from real tasks', () => {
    const result = buildTaskDistributions([
      { task_type: 'WS', task_location: 'SCh', total_hours: 8 },
      { task_type: 'WS', task_location: 'SCh', total_hours: 4 },
      { task_type: 'C', task_location: 'FLCNa', total_hours: null },
    ]);

    expect(result.typeDistribution).toEqual([
      { name: 'WS', value: 12 },
      { name: 'C', value: 0 },
    ]);
    expect(result.locationDistribution).toEqual([
      { name: 'SCh', value: 12 },
      { name: 'FLCNa', value: 0 },
    ]);
  });

  it('expands real tasks into calendar AM and PM slots', () => {
    expect(buildCalendarSlotsFromTasks([
      {
        id: 'task-1',
        assigned_employee_id: 'emp-1',
        task_name: 'Workshop',
        task_type: 'WS',
        task_location: 'SCh',
        start_date: '2026-07-01',
        end_date: '2026-07-01',
        total_hours: 8,
      },
    ])).toEqual([
      {
        id: 'task-1-2026-07-01-AM',
        userId: 'emp-1',
        date: '2026-07-01',
        half: 'AM',
        type: 'WS',
        location: 'SCh',
        topic: 'Workshop',
        hours: 4,
        source: 'system',
      },
      {
        id: 'task-1-2026-07-01-PM',
        userId: 'emp-1',
        date: '2026-07-01',
        half: 'PM',
        type: 'WS',
        location: 'SCh',
        topic: 'Workshop',
        hours: 4,
        source: 'system',
      },
    ]);
  });
});
