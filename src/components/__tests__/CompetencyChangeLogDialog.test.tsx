import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CompetencyChangeLogDialog from '../CompetencyChangeLogDialog';


describe('CompetencyChangeLogDialog', () => {
  it('shows time, before/after content and modifier identity', () => {
    render(
      <CompetencyChangeLogDialog
        isLoading={false}
        error={null}
        onClose={vi.fn()}
        records={[{
          id: 'history-1',
          versionId: 'version-1',
          changedAt: '2026-09-18T11:30:00',
          employeeId: 'employee-1',
          employeeName: 'Chen Jianjun',
          moduleId: 4,
          moduleName: 'Waste-free, stable flow_TPM',
          skillId: 15,
          skillName: 'TPM program management',
          previousCurrentLevel: 1,
          currentLevel: 2,
          previousTargetLevel: 3,
          targetLevel: 4,
          notes: 'Q3 update',
          changedByUserId: 'user-1',
          changedByName: 'Admin',
          changedByEmail: 'admin@bosch.com',
        }]}
      />,
    );

    expect(screen.getByText('现状 L1 → L2；目标 L3 → L4')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('admin@bosch.com')).toBeInTheDocument();
    expect(screen.getByText('说明：Q3 update')).toBeInTheDocument();
  });
});
