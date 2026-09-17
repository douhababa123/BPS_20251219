import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BarChart3, CalendarDays, Filter, Settings } from 'lucide-react';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useNewAuth } from '../contexts/NewAuthContext';
import {
  formatCloseRate, formatGap, formatLevel, getCompetencyModules,
  getCompetencyProgress, getCompetencyProgressYears, selectedMonthForYear, shanghaiYearMonth,
} from '../lib/dashboardProgressApi';

const shanghaiToday = shanghaiYearMonth();
const currentYear = shanghaiToday.year;
const currentMonth = shanghaiToday.month;

function MetricCard({ title, value, tone }: {
  title: string;
  value: string;
  tone: 'blue' | 'green' | 'amber';
}) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    green: 'border-green-100 bg-green-50 text-green-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
  };
  return (
    <div className={`min-w-0 rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="min-h-10 text-xs font-medium leading-5 text-gray-600">{title}</p>
      <p className="mt-2 break-words text-2xl font-bold" title={value}>{value}</p>
    </div>
  );
}

interface ProgressTooltipEntry {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | null;
}

function ProgressTooltip({ active, payload, label, zeroInitialGap }: {
  active?: boolean;
  payload?: ProgressTooltipEntry[];
  label?: string | number;
  zeroInitialGap: boolean;
}) {
  if (!active) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-gray-900">{label}</p>
      {(payload || []).map(entry => (
        <p key={String(entry.dataKey)} style={{ color: entry.color }}>
          {entry.name}：{entry.dataKey === 'closeRate'
            ? formatCloseRate(typeof entry.value === 'number' ? entry.value : null)
            : formatGap(typeof entry.value === 'number' ? entry.value : null)}
        </p>
      ))}
      {zeroInitialGap && (
        <p className="mt-1 text-amber-700">年初 GAP 为 0，关闭率不适用</p>
      )}
    </div>
  );
}

export function Dashboard() {
  const { isAdmin } = useNewAuth();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);

  const yearsQuery = useQuery({ queryKey: ['competency-progress-years'], queryFn: getCompetencyProgressYears });
  const modulesQuery = useQuery({ queryKey: ['competency-progress-modules'], queryFn: getCompetencyModules });
  const progressQuery = useQuery({
    queryKey: ['competency-progress', selectedYear, selectedMonth, selectedModule],
    queryFn: () => getCompetencyProgress(selectedYear, selectedMonth, selectedModule),
    retry: 1,
  });

  const years = useMemo(() => {
    const values = new Set(yearsQuery.data || [currentYear]);
    values.add(currentYear);
    return Array.from(values).sort((a, b) => b - a);
  }, [yearsQuery.data]);
  const months = Array.from(
    { length: selectedYear === currentYear ? currentMonth : 12 },
    (_, index) => index + 1,
  );
  const responseMatchesSelection = progressQuery.data
    ? progressQuery.data.year === selectedYear
      && progressQuery.data.month === selectedMonth
      && (progressQuery.data.moduleId ?? null) === selectedModule
    : true;
  const progress = responseMatchesSelection ? progressQuery.data : undefined;
  const progressError = progressQuery.isError || !responseMatchesSelection;
  const moduleName = selectedModule == null
    ? '全部模块'
    : modulesQuery.data?.find(item => item.module_id === selectedModule)?.module_name || `模块 ${selectedModule}`;
  const monthText = `${selectedMonth}`.padStart(2, '0');
  const cutoffText = progress?.cutoff
    ? new Date(progress.cutoff).toLocaleString('zh-CN', { hour12: false })
    : null;

  const openBaselineAdmin = () => {
    window.location.assign(`/?page=admin&adminTab=baselines&year=${selectedYear}`);
  };

  return (
    <div className="space-y-6" data-testid="competency-progress-dashboard">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">能力发展总览</h2>
          <p className="mt-1 text-sm text-gray-500">年度 Level、GAP 总分与 GAP 关闭率</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <CalendarDays className="h-4 w-4 text-blue-900" />
            <span className="text-sm text-gray-600">年度</span>
            <select aria-label="统计年度" value={selectedYear} onChange={event => {
              const year = Number(event.target.value);
              setSelectedYear(year);
              setSelectedMonth(selectedMonthForYear(year));
            }} className="min-w-16 bg-transparent text-sm font-medium focus:outline-none">
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <Filter className="h-4 w-4 text-blue-900" />
            <span className="text-sm text-gray-600">月份</span>
            <select aria-label="统计月份" value={selectedMonth} onChange={event => setSelectedMonth(Number(event.target.value))} className="min-w-16 bg-transparent text-sm font-medium focus:outline-none">
              {months.map(month => <option key={month} value={month}>{`${month}`.padStart(2, '0')} 月</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <BarChart3 className="h-4 w-4 text-blue-900" />
            <span className="text-sm text-gray-600">模块</span>
            <select aria-label="能力模块" value={selectedModule ?? ''} onChange={event => setSelectedModule(event.target.value ? Number(event.target.value) : null)} className="min-w-36 bg-transparent text-sm font-medium focus:outline-none">
              <option value="">全部模块</option>
              {(modulesQuery.data || []).map(module => <option key={module.module_id} value={module.module_id}>{module.module_name}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        统计范围：{selectedYear} 年 {monthText} 月｜{moduleName}｜
        {progress?.status === 'not_started'
          ? '尚未开始'
          : progress?.isPartial
            ? `截至当前${cutoffText ? `（${cutoffText}）` : ''}，非月末数据`
            : `截至 ${selectedYear}-${monthText} 月末`}
        {progress?.cellCount ? `｜${progress.cellCount} 个基线单元` : ''}
      </div>

      {progressQuery.isLoading && <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">正在加载年度能力数据…</div>}
      {progressError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
          <AlertCircle className="h-5 w-5" />年度能力数据加载失败，请稍后重试。
        </div>
      )}
      {!progressQuery.isLoading && !progressError && progress?.status === 'missing_baseline' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertCircle className="mx-auto h-9 w-9 text-amber-600" />
          <h3 className="mt-3 text-lg font-semibold text-amber-900">{selectedYear} 年初基线未设置</h3>
          <p className="mt-1 text-sm text-amber-800">不会使用 2026-07-03 迁移快照或当前数据代替年初基线。</p>
          {isAdmin ? (
            <button onClick={openBaselineAdmin} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
              <Settings className="h-4 w-4" />设置年初基线
            </button>
          ) : <p className="mt-3 text-sm font-medium text-amber-900">请联系管理员设置年初基线。</p>}
        </div>
      )}
      {!progressQuery.isLoading && !progressError && progress?.status === 'empty_scope' && (
        <div className="rounded-2xl border bg-white p-8 text-center text-gray-600">该模块无基线数据。</div>
      )}
      {!progressQuery.isLoading && !progressError && progress?.status === 'not_started' && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center text-blue-900">
          {selectedYear} 年尚未开始，不生成能力进度值。
        </div>
      )}
      {!progressQuery.isLoading && !progressError && progress?.status === 'data_quality_error' && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5" />年度基线数据质量异常</div>
          {(progress.dataQualityWarnings || []).map(message => <p key={message} className="mt-2 text-sm">{message}</p>)}
        </div>
      )}

      {!progressQuery.isLoading && !progressError && progress && (
        <>
          <div data-testid="kpi-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard title={`${selectedYear} 年初 Level`} value={formatLevel(progress.kpis?.initialLevel)} tone="blue" />
            <MetricCard title={`${selectedYear} 目标 Level`} value={formatLevel(progress.kpis?.targetLevel)} tone="green" />
            <MetricCard title={`现状 Level（${selectedYear} YTD${monthText}）`} value={formatLevel(progress.kpis?.currentLevel)} tone="blue" />
            <MetricCard title={`${selectedYear} 年初 GAP 总分`} value={formatGap(progress.kpis?.initialGap)} tone="amber" />
            <MetricCard title={`GAP YTD${monthText}`} value={formatGap(progress.kpis?.currentGap)} tone="amber" />
            <MetricCard title={`GAP 关闭率（${selectedYear} YTD${monthText}）`} value={formatCloseRate(progress.kpis?.closeRate)} tone="green" />
          </div>

          {progress.status === 'ready' && (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">GAP 关闭趋势</h3>
              <p className="mb-4 text-sm text-gray-500">月末 GAP 总分与 YTD GAP 关闭率</p>
              {progress.kpis?.initialGap === 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  年初 GAP 为 0，GAP 关闭率不适用；折线及其提示值显示为 —。
                </p>
              )}
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={progress.monthly} margin={{ top: 10, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="gap" allowDecimals={false} />
                  <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tickFormatter={value => `${value}%`} />
                  <Tooltip content={<ProgressTooltip zeroInitialGap={progress.kpis?.initialGap === 0} />} />
                  <Legend />
                  <Bar yAxisId="gap" dataKey="gap" name="GAP 总分" fill="#166985" radius={[5, 5, 0, 0]} />
                  <Line yAxisId="rate" type="monotone" dataKey="closeRate" name="GAP 关闭率" stroke="#f97316" strokeWidth={2.5} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
