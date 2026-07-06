import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatrixView from '../MatrixView';

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [{ module_id: 1, module_name: 'BPS elements' }] }),
  },
}));

const rows = [
  {
    employeeId: 'employee-1',
    employeeCode: 'SCh-PS_Gu_Xuan',
    employeeName: 'Gu Xuan',
    departmentName: 'SCh-PS',
    skills: {
      1: {
        skillId: 1,
        currentLevel: 3,
        targetLevel: 4,
        gap: 1,
      },
    },
  },
];

const columns = [
  {
    skillId: 1,
    moduleId: 1,
    moduleName: 'BPS elements',
    skillName: 'WAS',
    displayOrder: 1,
  },
];

const stats = {
  totalEmployees: 1,
  totalSkills: 1,
  totalAssessments: 1,
  avgCurrentLevel: 3,
  avgTargetLevel: 4,
  avgGap: 1,
  totalGapScore: 1,
};

describe('MatrixView fullscreen mode', () => {
  it('expands the matrix table into a fullscreen reading mode', async () => {
    const user = userEvent.setup();

    render(<MatrixView rows={rows} columns={columns} stats={stats} />);

    const fullscreenButton = screen.getByRole('button', { name: /全屏查看/ });
    await user.click(fullscreenButton);

    expect(screen.getByTestId('matrix-view-root')).toHaveClass('fixed', 'inset-0');
    expect(screen.getByRole('button', { name: /退出全屏/ })).toBeInTheDocument();
  });
});
