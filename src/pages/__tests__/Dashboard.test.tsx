import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import * as progressApi from '../../lib/dashboardProgressApi';
import type { CompetencyProgressResponse } from '../../lib/dashboardProgressApi';


vi.mock('../../contexts/NewAuthContext', () => ({ useNewAuth: () => ({ isAdmin: true }) }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children, data }: { children: React.ReactNode; data: unknown }) => (
    <div data-testid="chart-data" data-points={JSON.stringify(data)}>{children}</div>
  ),
  Bar: () => <div data-testid="gap-bar" />,
  Cell: () => null,
  LabelList: () => null,
  Line: () => <div data-testid="rate-line" />,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));
vi.mock('../../lib/dashboardProgressApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/dashboardProgressApi')>();
  return {
    ...actual,
    getCompetencyProgressYears: vi.fn(),
    getCompetencyModules: vi.fn(),
    getCompetencyProgressEmployees: vi.fn(),
    getCompetencyProgress: vi.fn(),
  };
});

function response(year: number, month: number, moduleId: number | null, employeeId: string | null): CompetencyProgressResponse {
  const monthly = Array.from({ length: month }, (_, index) => ({
    month: index + 1,
    label: `${year}${String(index + 1).padStart(2, '0')}`,
    gap: index + 1 === month ? 160 : 200,
    closeRate: index + 1 === month ? 20 : 0,
    isPartial: false,
    cutoff: `${year}-${String(index + 1).padStart(2, '0')}-28T23:59:59`,
  }));
  return {
    year, month, moduleId, employeeId, baselineId: 'baseline-1', cutoff: monthly[monthly.length - 1]?.cutoff || null,
    isPartial: false, cellCount: 100, status: 'ready' as const,
    kpis: { initialLevel: 1.2, targetLevel: 1.5, currentLevel: 1.3, initialGap: 200, currentGap: 160, closeRate: 20 },
    monthly,
  };
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>);
}

describe('Dashboard annual competency KPIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(progressApi.getCompetencyProgressYears).mockResolvedValue([2026, 2025]);
    vi.mocked(progressApi.getCompetencyModules).mockResolvedValue([{ module_id: 1, module_name: 'BPS elements' }]);
    vi.mocked(progressApi.getCompetencyProgressEmployees).mockResolvedValue([{ id: 'e1', name: 'Chen Jianjun' }]);
    vi.mocked(progressApi.getCompetencyProgress).mockImplementation(async (year, month, moduleId, employeeId) => response(year, month, moduleId, employeeId));
  });

  it('renders six ordered wide-screen cards and keeps June KPI values synchronized', async () => {
    renderDashboard();
    fireEvent.change(await screen.findByLabelText('统计月份'), { target: { value: '6' } });

    const grid = await screen.findByTestId('kpi-grid');
    expect(grid).toHaveClass('xl:grid-cols-6');
    await waitFor(() => expect(screen.getByText('GAP YTD06')).toBeInTheDocument());
    const titles = Array.from(grid.querySelectorAll('p:first-child')).map(node => node.textContent);
    expect(titles).toEqual([
      '2026 年初 Level', '2026 目标 Level', '现状 Level（2026 YTD06）',
      '2026 年初 GAP 总分', 'GAP YTD06', 'GAP 关闭率（2026 YTD06）',
    ]);
    expect(screen.getByText('GAP YTD06').parentElement).toHaveTextContent('160');
    expect(screen.getByText('GAP 关闭率（2026 YTD06）').parentElement).toHaveTextContent('20%');
    const chartPoints = JSON.parse(screen.getByTestId('chart-data').getAttribute('data-points') || '[]');
    expect(chartPoints.at(-1)).toMatchObject({ label: '202606', gap: 160, closeRate: 20 });
    expect(screen.getByTestId('dashboard-gap-chart')).toHaveAccessibleName(/2026 年截至 06 月全部模块、全部人员/);
    expect(vi.mocked(progressApi.getCompetencyProgress)).toHaveBeenCalledWith(2026, 6, null, null);
  });

  it('defaults a selected historical year to December and applies module to the same request', async () => {
    renderDashboard();
    await screen.findByRole('option', { name: '2025' });
    fireEvent.change(await screen.findByLabelText('统计年度'), { target: { value: '2025' } });
    await waitFor(() => expect(screen.getByLabelText('统计月份')).toHaveValue('12'));
    fireEvent.change(screen.getByLabelText('能力模块'), { target: { value: '1' } });
    await waitFor(() => expect(vi.mocked(progressApi.getCompetencyProgress)).toHaveBeenCalledWith(2025, 12, 1, null));
    expect(await screen.findByText('GAP YTD12')).toBeInTheDocument();
  });

  it('rejects a response whose year, month or module echo does not match the active filters', async () => {
    vi.mocked(progressApi.getCompetencyProgress).mockImplementation(async (year, month, moduleId, employeeId) => (
      response(year, month === 6 ? 7 : month, moduleId, employeeId)
    ));
    renderDashboard();
    fireEvent.change(await screen.findByLabelText('统计月份'), { target: { value: '6' } });

    expect(await screen.findByText('年度能力数据加载失败，请稍后重试。')).toBeInTheDocument();
    expect(screen.queryByText('GAP YTD06')).not.toBeInTheDocument();
  });

  it('shows a future year as not started without chart values', async () => {
    vi.mocked(progressApi.getCompetencyProgressYears).mockResolvedValue([2027, 2026]);
    vi.mocked(progressApi.getCompetencyProgress).mockImplementation(async (year, month, moduleId, employeeId) => {
      if (year !== 2027) return response(year, month, moduleId, employeeId);
      return {
        year, month, moduleId, employeeId, baselineId: null, cutoff: null, isPartial: false,
        cellCount: 0, status: 'not_started', kpis: null, monthly: [],
      };
    });
    renderDashboard();
    await screen.findByRole('option', { name: '2027' });
    fireEvent.change(await screen.findByLabelText('统计年度'), { target: { value: '2027' } });

    await waitFor(() => expect(progressApi.getCompetencyProgress).toHaveBeenCalledWith(2027, 12, null, null));
    expect(await screen.findByText('2027 年尚未开始，不生成能力进度值。')).toBeInTheDocument();
    expect(screen.getByText('统计范围：2027 年 12 月｜全部模块｜全部人员｜尚未开始')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-data')).not.toBeInTheDocument();
  });

  it('explains that a zero-baseline close rate is unavailable', async () => {
    vi.mocked(progressApi.getCompetencyProgress).mockImplementation(async (year, month, moduleId, employeeId) => {
      const result = response(year, month, moduleId, employeeId);
      result.kpis = { ...result.kpis!, initialGap: 0, currentGap: 0, closeRate: null };
      result.monthly = result.monthly.map(point => ({ ...point, gap: 0, closeRate: null }));
      return result;
    });
    renderDashboard();

    expect(await screen.findByText('年初 GAP 为 0，GAP 关闭率不适用；折线及其提示值显示为 —。')).toBeInTheDocument();
    expect(screen.getByText(/^GAP 关闭率（2026 YTD\d{2}）$/).parentElement).toHaveTextContent('—');
  });

  it('applies one employee to all six KPIs, the chart and scope count, then restores all people', async () => {
    vi.mocked(progressApi.getCompetencyProgress).mockImplementation(async (year, month, moduleId, employeeId) => {
      const result = response(year, month, moduleId, employeeId);
      if (employeeId === 'e1') {
        result.cellCount = 2;
        result.kpis = {
          initialLevel: 1.5, targetLevel: 3, currentLevel: 2,
          initialGap: 3, currentGap: 2, closeRate: 100 / 3,
        };
        result.monthly = result.monthly.map(point => ({ ...point, gap: 2, closeRate: 100 / 3 }));
      }
      return result;
    });
    renderDashboard();
    await screen.findByRole('option', { name: 'Chen Jianjun' });
    fireEvent.change(screen.getByLabelText('统计人员'), { target: { value: 'e1' } });

    await waitFor(() => expect(progressApi.getCompetencyProgress).toHaveBeenCalledWith(2026, expect.any(Number), null, 'e1'));
    expect(await screen.findByText('2026 年初 Level')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('2026 年初 Level').parentElement).toHaveTextContent('1.5'));
    expect(screen.getByText('2026 目标 Level').parentElement).toHaveTextContent('3.0');
    expect(screen.getByText(/^现状 Level/).parentElement).toHaveTextContent('2.0');
    expect(screen.getByText('2026 年初 GAP 总分').parentElement).toHaveTextContent('3');
    expect(screen.getByText(/^GAP YTD/).parentElement).toHaveTextContent('2');
    expect(screen.getByText(/^GAP 关闭率（/).parentElement).toHaveTextContent('33.3%');
    expect(screen.getByText(/2 个基线单元/)).toHaveTextContent('Chen Jianjun');
    expect(screen.getByTestId('dashboard-gap-chart')).toHaveAccessibleName(/Chen Jianjun/);
    expect(JSON.parse(screen.getByTestId('chart-data').getAttribute('data-points') || '[]').at(-1)).toMatchObject({ gap: 2, closeRate: 100 / 3 });

    fireEvent.change(screen.getByLabelText('统计人员'), { target: { value: '' } });
    await waitFor(() => expect(screen.getByText('2026 年初 GAP 总分').parentElement).toHaveTextContent('200'));
  });

  it('combines employee and module and resets employee when changing year', async () => {
    renderDashboard();
    await screen.findByRole('option', { name: 'Chen Jianjun' });
    fireEvent.change(screen.getByLabelText('统计人员'), { target: { value: 'e1' } });
    fireEvent.change(screen.getByLabelText('能力模块'), { target: { value: '1' } });
    await waitFor(() => expect(progressApi.getCompetencyProgress).toHaveBeenCalledWith(2026, expect.any(Number), 1, 'e1'));

    fireEvent.change(screen.getByLabelText('统计年度'), { target: { value: '2025' } });
    expect(screen.getByLabelText('统计人员')).toHaveValue('');
    await waitFor(() => expect(progressApi.getCompetencyProgressEmployees).toHaveBeenCalledWith(2025));
    await waitFor(() => expect(progressApi.getCompetencyProgress).toHaveBeenCalledWith(2025, 12, 1, null));
  });

  it('does not show an employee response with the wrong employee echo', async () => {
    vi.mocked(progressApi.getCompetencyProgress).mockImplementation(async (year, month, moduleId) => response(year, month, moduleId, null));
    renderDashboard();
    await screen.findByRole('option', { name: 'Chen Jianjun' });
    fireEvent.change(screen.getByLabelText('统计人员'), { target: { value: 'e1' } });
    expect(await screen.findByText('年度能力数据加载失败，请稍后重试。')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-gap-chart')).not.toBeInTheDocument();
  });
});
