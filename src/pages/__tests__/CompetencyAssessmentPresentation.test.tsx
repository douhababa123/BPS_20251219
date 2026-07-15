import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetencyAssessment } from '../CompetencyAssessment';
import { getAllAssessments, getAssessmentMatrix } from '../../lib/competencyApi';

vi.mock('../../lib/competencyApi', () => ({
  averageAssessmentValues: (values: number[]) => (
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
  ),
  getAllAssessments: vi.fn(),
  getAssessmentMatrix: vi.fn(),
  saveAssessment: vi.fn(),
}));

vi.mock('../../components/MatrixView', () => ({
  default: () => <div>matrix view</div>,
}));

const assessments = [
  {
    id: 'assessment-positive',
    employee_id: 'employee-1',
    employee_name: 'Test Engineer',
    department_name: 'BPS',
    skill_id: 1,
    skill_name: 'Positive Gap Skill',
    module_id: 1,
    module_name: 'BPS elements',
    current_level: 2,
    target_level: 3,
    gap: 1,
    assessment_year: 2026,
  },
  {
    id: 'assessment-zero',
    employee_id: 'employee-1',
    employee_name: 'Test Engineer',
    department_name: 'BPS',
    skill_id: 2,
    skill_name: 'Zero Level Skill',
    module_id: 1,
    module_name: 'BPS elements',
    current_level: 0,
    target_level: 0,
    gap: 0,
    assessment_year: 2026,
  },
];

describe('CompetencyAssessment 0-4 presentation', () => {
  beforeEach(() => {
    vi.mocked(getAllAssessments).mockResolvedValue(assessments as never);
    vi.mocked(getAssessmentMatrix).mockResolvedValue({
      rows: [],
      columns: [],
      stats: {
        totalEmployees: 1,
        totalSkills: 2,
        totalAssessments: 2,
        avgCurrentLevel: 1,
        avgTargetLevel: 1.5,
        avgGap: 0.5,
        totalGapScore: 1,
      },
    });
  });

  it('uses four as the visible maximum and removes the legacy fifth level', async () => {
    const user = userEvent.setup();
    const { container } = render(<CompetencyAssessment />);

    await user.click(await screen.findByRole('button', { name: '卡片' }));

    expect(screen.getAllByText('/4')).toHaveLength(2);
    expect(screen.queryByText('/5')).not.toBeInTheDocument();
    expect(screen.queryByText('Master')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开全部' }));
    await waitFor(() => expect(container.querySelectorAll('.w-2.h-8')).toHaveLength(16));
  });

  it('uses red for every positive GAP instead of magnitude colors', async () => {
    const user = userEvent.setup();
    const { container } = render(<CompetencyAssessment />);

    await user.click(await screen.findByRole('button', { name: '卡片' }));

    const positiveAverageGapValues = screen.getAllByText('0.5');
    expect(positiveAverageGapValues.length).toBeGreaterThan(0);
    positiveAverageGapValues.forEach((value) => expect(value).toHaveClass('text-red-600'));
    expect(container.querySelector('.bg-amber-100')).not.toBeInTheDocument();
    expect(container.querySelector('.bg-amber-300')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.bg-red-100').length).toBeGreaterThan(0);
  });

  it('shows level zero as assessed data in the table view', async () => {
    const user = userEvent.setup();
    render(<CompetencyAssessment />);

    await user.click(await screen.findByRole('button', { name: '表格' }));

    const row = screen.getByText('Zero Level Skill').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getAllByText('L0')).toHaveLength(2);
    expect(within(row!).getByText('0')).toHaveClass('text-green-600', 'bg-green-100');
  });
});
