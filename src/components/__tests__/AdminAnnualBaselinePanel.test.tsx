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
  downloadActiveBaseline: vi.fn(),
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
      source: {
        sheetName: 'Current_Target states', layout: 'WIDE_CT', sourceEmployeeCount: 1,
        omittedCellCount: 0, excludedEmployeeCount: 0, ignoredSkillColumnCount: 0, errorCount: 0,
      },
      rows: [{
        row: 2, employeeId: 'E001', employeeName: 'Employee One', skillId: 7,
        moduleName: 'Module', skillName: 'Skill', initialCurrent: 0, annualTarget: 3, gap: 3,
        sourceCells: 'C7/D7', conversionRule: 'C 为空，按 0 导入',
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

  it('warns about the exact sheet name and removes the selected pending file', async () => {
    renderPanel();
    expect(screen.getByText(/Current_Target states/)).toBeInTheDocument();
    const input = screen.getByLabelText('上传年初基线 Excel') as HTMLInputElement;
    const file = new File(['xlsx'], 'baseline.xlsx');
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('baseline.xlsx')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '移除文件' }));

    expect((screen.getByLabelText('上传年初基线 Excel') as HTMLInputElement).files).toHaveLength(0);
    expect(screen.queryByText('baseline.xlsx')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上传并预览' })).toBeDisabled();
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

  it('renders FastAPI field validation details instead of a generic 422 message', async () => {
    vi.mocked(baselineApi.previewBaseline).mockRejectedValue({
      message: 'Request failed with status code 422',
      response: { data: { detail: [{ loc: ['body', 'file'], msg: 'Field required' }] } },
    });
    renderPanel();
    fireEvent.change(screen.getByLabelText('上传年初基线 Excel'), {
      target: { files: [new File(['xlsx'], 'baseline.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: '上传并预览' }));

    expect(await screen.findByText('file：Field required')).toBeInTheDocument();
    expect(screen.queryByText('Request failed with status code 422')).not.toBeInTheDocument();
  });

  it('explains and enables the immutable replacement workflow for an active baseline', async () => {
    vi.mocked(baselineApi.getBaselineStatus).mockResolvedValue({
      year: 2026,
      active: {
        id: 'baseline-1', year: 2026, source: 'EXCEL_IMPORT', filename: 'original.xlsx',
        sourceVersionId: null, isActive: true, selectedByUserId: 'admin-1',
        selectedByEmail: 'admin@bosch.com', selectedAt: '2026-09-18T09:00:00',
        cellCount: 427, employeeCount: 17, skillCount: 38,
      },
      revisions: [],
    });
    vi.mocked(baselineApi.downloadActiveBaseline).mockResolvedValue(new Blob(['xlsx']));
    const createObjectURL = vi.fn().mockReturnValue('blob:baseline');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    renderPanel();

    expect(await screen.findByText('修改/替换 2026 年初基线')).toBeInTheDocument();
    expect(screen.getByText(/下载当前基线并修改数值/)).toBeInTheDocument();
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: '下载当前基线（用于修改）' }));
    await waitFor(() => expect(baselineApi.downloadActiveBaseline).toHaveBeenCalledWith(2026));

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:baseline');
    anchorClick.mockRestore();
    delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });
});
