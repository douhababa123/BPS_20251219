import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
    canEdit: false,
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

  it('keeps the fullscreen matrix horizontally scrollable', async () => {
    const user = userEvent.setup();

    render(<MatrixView rows={rows} columns={columns} stats={stats} />);

    await user.click(screen.getByRole('button', { name: /全屏查看/ }));

    expect(screen.getByTestId('matrix-table-shell')).toHaveClass('min-w-0');
    expect(screen.getByTestId('matrix-scroll-container')).toHaveClass('w-full', 'overflow-x-auto');
  });

  it('moves the fullscreen matrix with explicit horizontal controls', async () => {
    const user = userEvent.setup();

    render(<MatrixView rows={rows} columns={columns} stats={stats} />);

    await user.click(screen.getByRole('button', { name: /全屏查看/ }));

    const scrollContainer = screen.getByTestId('matrix-scroll-container');
    expect(scrollContainer.scrollLeft).toBe(0);

    await user.click(screen.getByRole('button', { name: /向右移动表格/ }));

    expect(scrollContainer.scrollLeft).toBeGreaterThan(0);
  });
});

describe('MatrixView competency editing', () => {
  it('opens an authorized assessment cell with the keyboard', async () => {
    const user = userEvent.setup();
    const onSaveAssessment = vi.fn().mockResolvedValue(undefined);

    render(
      <MatrixView
        rows={[{ ...rows[0], canEdit: true }]}
        columns={columns}
        stats={stats}
        onSaveAssessment={onSaveAssessment}
      />,
    );

    const cell = screen.getByRole('button', {
      name: /Gu Xuan.*WAS.*编辑能力评估/,
    });
    cell.focus();
    await user.keyboard('{Enter}');

    const dialog = screen.getByRole('dialog', { name: '编辑能力评估' });
    expect(within(dialog).getByText('Gu Xuan')).toBeInTheDocument();
    expect(within(dialog).getByText('WAS')).toBeInTheDocument();
  });

  it('allows an authorized user to enter a missing assessment', async () => {
    render(
      <MatrixView
        rows={[{ ...rows[0], canEdit: true, skills: {} }]}
        columns={columns}
        stats={{ ...stats, totalAssessments: 0 }}
        onSaveAssessment={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('button', {
      name: /Gu Xuan.*WAS.*录入能力评估/,
    })).toHaveTextContent('点击录入');
    await screen.findByRole('button', { name: 'BPS elements' });
  });

  it('keeps another employee assessment read-only', async () => {
    render(
      <MatrixView
        rows={rows}
        columns={columns}
        stats={stats}
        onSaveAssessment={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByRole('button', { name: /编辑能力评估/ })).not.toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();
    await screen.findByRole('button', { name: 'BPS elements' });
  });

  it('uses green only for equality and red for every positive gap', async () => {
    const colorRows = [
      {
        ...rows[0],
        employeeId: 'e0',
        employeeName: 'Equal',
        skills: { 1: { skillId: 1, currentLevel: 0, targetLevel: 0, gap: 0 } },
      },
      {
        ...rows[0],
        employeeId: 'e1',
        employeeName: 'Small',
        skills: { 1: { skillId: 1, currentLevel: 2, targetLevel: 3, gap: 1 } },
      },
      {
        ...rows[0],
        employeeId: 'e2',
        employeeName: 'Large',
        skills: { 1: { skillId: 1, currentLevel: 1, targetLevel: 5, gap: 4 } },
      },
    ];

    render(
      <MatrixView
        rows={colorRows}
        columns={columns}
        stats={{ ...stats, totalEmployees: 3, totalAssessments: 3 }}
        onSaveAssessment={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('0/0').closest('td')).toHaveClass('bg-green-50');
    expect(screen.getByText('GAP 1').closest('td')).toHaveClass('bg-red-50');
    expect(screen.getByText('GAP 4').closest('td')).toHaveClass('bg-red-50');
    expect(screen.queryByText('GAP 0')).not.toBeInTheDocument();
    expect(document.querySelector('.bg-yellow-50')).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'BPS elements' });
  });
});
