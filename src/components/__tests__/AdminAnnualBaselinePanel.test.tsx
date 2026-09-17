import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAnnualBaselinePanel } from '../AdminAnnualBaselinePanel';
import * as baselineApi from '../../lib/annualBaselineApi';


vi.mock('../../lib/annualBaselineApi', () => ({
  getBaselineStatus: vi.fn(),
  getAssessmentVersions: vi.fn(),
  previewBaseline: vi.fn(),
  activateBaseline: vi.fn(),
  activateBaselineFromVersion: vi.fn(),
  downloadBaselineTemplate: vi.fn(),
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminAnnualBaselinePanel />
    </QueryClientProvider>,
  );
}

describe('Admin annual baseline preview safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/?year=2026');
    vi.mocked(baselineApi.getBaselineStatus).mockResolvedValue({ year: 2026, active: null, revisions: [] });
    vi.mocked(baselineApi.getAssessmentVersions).mockResolvedValue([]);
    vi.mocked(baselineApi.previewBaseline).mockResolvedValue({
      year: 2026,
      filename: 'baseline.xlsx',
      sha256: 'a'.repeat(64),
      previewToken: 'b'.repeat(64),
      valid: true,
      errors: [],
      rows: [{
        row: 2, employeeId: 'E001', employeeName: 'Employee One', skillId: 7,
        moduleName: 'Module', skillName: 'Skill', initialCurrent: 0, annualTarget: 3, gap: 3,
      }],
      rowsTruncated: false,
      summary: { employeeCount: 1, skillCount: 1, cellCount: 1, initialLevel: 0, targetLevel: 3, initialGap: 3 },
    });
  });

  it('cancels a valid preview without activating a baseline', async () => {
    renderPanel();
    const file = new File(['xlsx'], 'baseline.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(screen.getByLabelText('上传年初基线 Excel'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '上传并预览' }));

    expect(await screen.findByText('预览结果：校验通过')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    expect(screen.queryByText('预览结果：校验通过')).not.toBeInTheDocument();
    expect(baselineApi.activateBaseline).not.toHaveBeenCalled();
  });

  it('invalidates the file and preview when the selected year changes', async () => {
    renderPanel();
    const file = new File(['xlsx'], 'baseline.xlsx');
    fireEvent.change(screen.getByLabelText('上传年初基线 Excel'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: '上传并预览' }));
    expect(await screen.findByText('预览结果：校验通过')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('基线年度'), { target: { value: '2027' } });

    await waitFor(() => expect(screen.queryByText('预览结果：校验通过')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '上传并预览' })).toBeDisabled();
    expect(baselineApi.activateBaseline).not.toHaveBeenCalled();
  });
});
