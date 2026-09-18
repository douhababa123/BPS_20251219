import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  CHART_AXIS_TICK,
  CHART_COLORS,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  horizontalChartHeight,
} from '../charts/chartTheme';
import { ChartEmptyState } from '../charts/ChartEmptyState';
import { useCompetencyGapTrend } from '../../hooks/useCompetencyGapTrend';
import {
  MODULE_MAPPING,
  calculateEmployeeGapDistribution,
  formatNumber,
  type ActiveEmployeeScope,
  type EmployeeModuleGapMatrix,
  type ModuleStats,
  type SkillStats,
} from '../../lib/competencyAggregation';
import type { AssessmentFull, Skill } from '../../lib/database.types';

interface TeamGapAnalysisProps {
  year: number;
  assessments: AssessmentFull[];
  skills: Skill[];
  employees: ActiveEmployeeScope[];
  moduleStats: ModuleStats[];
  skillStats: SkillStats[];
  summary: EmployeeModuleGapMatrix;
}

const cardClass = 'bg-white rounded-2xl p-6 shadow-sm border border-gray-100';
const formatPositiveGap = (value: unknown) => Number(value) > 0 ? formatNumber(Number(value)) : '';

export function TeamGapAnalysis({
  year,
  assessments,
  skills,
  employees,
  moduleStats,
  skillStats,
  summary,
}: TeamGapAnalysisProps) {
  const activeSkills = useMemo(
    () => skills.filter((skill) => skill.is_active).sort((a, b) => a.display_order - b.display_order || a.id - b.id),
    [skills],
  );
  const modules = Object.values(MODULE_MAPPING);
  const [distributionDimension, setDistributionDimension] = useState<'module' | 'skill'>('module');
  const [distributionItemId, setDistributionItemId] = useState(1);
  const [trendModuleId, setTrendModuleId] = useState<number | undefined>();
  const [trendSkillId, setTrendSkillId] = useState<number | undefined>();

  const gapDistribution = distributionDimension === 'module'
    ? moduleStats.map((module) => ({ name: module.moduleName, totalGap: module.totalGap }))
    : skillStats.map((skill) => ({ name: skill.skillName, totalGap: skill.totalGap }));

  const employeeDistribution = useMemo(
    () => calculateEmployeeGapDistribution(
      assessments,
      skills,
      employees,
      { dimension: distributionDimension, itemId: distributionItemId },
    ),
    [assessments, distributionDimension, distributionItemId, employees, skills],
  );

  const trendSkills = trendModuleId === undefined
    ? activeSkills
    : activeSkills.filter((skill) => skill.module_id === trendModuleId);
  const trend = useCompetencyGapTrend({ year, moduleId: trendModuleId, skillId: trendSkillId });
  const trendData = (trend.data?.quarters ?? []).map((point) => ({
    ...point,
    chartGap: point.hasData ? point.totalGap : null,
  }));

  const changeDistributionDimension = (dimension: 'module' | 'skill') => {
    setDistributionDimension(dimension);
    setDistributionItemId(dimension === 'module' ? modules[0].id : (activeSkills[0]?.id ?? 0));
  };

  const changeTrendModule = (value: string) => {
    const moduleId = value === 'all' ? undefined : Number(value);
    setTrendModuleId(moduleId);
    if (
      trendSkillId !== undefined
      && (moduleId === undefined || activeSkills.find((skill) => skill.id === trendSkillId)?.module_id !== moduleId)
    ) {
      setTrendSkillId(undefined);
    }
  };

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">差距分布 <span className="ml-1 text-sm font-medium text-gray-500">Gap Distribution</span></h3>
            <p className="text-sm text-gray-500 mt-1">只显示各模块或技能的 GAP 总数值</p>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-1" aria-label="差距分布维度">
            <button type="button" onClick={() => changeDistributionDimension('module')} className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${distributionDimension === 'module' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}>模块</button>
            <button type="button" onClick={() => changeDistributionDimension('skill')} className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${distributionDimension === 'skill' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}>技能</button>
          </div>
        </div>
        {gapDistribution.length === 0 ? (
          <ChartEmptyState message="暂无 GAP 分布数据" />
        ) : (
          <figure aria-label={`按${distributionDimension === 'module' ? '模块' : '技能'}显示的团队 GAP 总分分布`}>
            <div className="max-h-[640px] overflow-y-auto pr-1">
              <div style={{ height: horizontalChartHeight(gapDistribution.length) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={gapDistribution} margin={{ top: 8, bottom: 8, left: 8, right: 58 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 4" stroke={CHART_COLORS.grid} />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
                    <YAxis type="category" dataKey="name" width={210} interval={0} tick={{ ...CHART_AXIS_TICK, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} formatter={(value) => [formatNumber(Number(value)), '总 GAP']} />
                    <Bar dataKey="totalGap" name="总 GAP" fill={CHART_COLORS.gapPrimary} radius={[0, 5, 5, 0]} maxBarSize={20} isAnimationActive={false}>
                      <LabelList dataKey="totalGap" position="right" fill="#475569" fontSize={11} formatter={formatPositiveGap} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <figcaption className="sr-only">条形按现有业务顺序展示，条形末端为该项目的 GAP 总分。</figcaption>
          </figure>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">人员 GAP 分配 <span className="ml-1 text-sm font-medium text-gray-500">Employee GAP Distribution</span></h3>
            <p className="text-sm text-gray-500 mt-1">比较所选模块或技能在不同人员之间的 GAP</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-sm text-gray-600">
              维度
              <select
                aria-label="人员分配维度"
                value={distributionDimension}
                onChange={(event) => changeDistributionDimension(event.target.value as 'module' | 'skill')}
                className="ml-2 min-h-9 rounded-lg border border-gray-300 bg-white px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="module">模块</option>
                <option value="skill">技能</option>
              </select>
            </label>
            <label className="text-sm text-gray-600">
              项目
              <select
                aria-label="人员分配项目"
                value={distributionItemId}
                onChange={(event) => setDistributionItemId(Number(event.target.value))}
                className="ml-2 min-h-9 max-w-64 rounded-lg border border-gray-300 bg-white px-2 py-1.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {distributionDimension === 'module'
                  ? modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)
                  : activeSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.skill_name}</option>)}
              </select>
            </label>
          </div>
        </div>
        {employeeDistribution.length === 0 ? (
          <ChartEmptyState message="暂无人员 GAP 分配数据" />
        ) : (
          <figure aria-label="所选能力项目在不同人员之间的 GAP 总分分布">
            <div className="max-h-[640px] overflow-y-auto pr-1">
              <div style={{ height: horizontalChartHeight(employeeDistribution.length) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={employeeDistribution} margin={{ top: 8, bottom: 8, left: 8, right: 58 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 4" stroke={CHART_COLORS.grid} />
                    <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
                    <YAxis type="category" dataKey="employeeName" width={170} interval={0} tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      formatter={(value, _name, item) => [formatNumber(Number(value)), item.payload.hasData ? '总 GAP' : '暂无评估']}
                    />
                    <Bar dataKey="totalGap" name="总 GAP" fill={CHART_COLORS.gapSecondary} radius={[0, 5, 5, 0]} maxBarSize={20} isAnimationActive={false}>
                      <LabelList dataKey="totalGap" position="right" fill="#475569" fontSize={11} formatter={formatPositiveGap} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <figcaption className="sr-only">每个条形表示一名工程师在所选能力项目中的 GAP 总分。</figcaption>
          </figure>
        )}
        {employeeDistribution.some((point) => !point.hasData) && (
          <p className="text-xs text-gray-500 mt-2">
            暂无评估：{employeeDistribution.filter((point) => !point.hasData).map((point) => point.employeeName).join('、')}
          </p>
        )}
      </section>

      <section className={cardClass}>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">季度总 GAP 趋势 <span className="ml-1 text-sm font-medium text-gray-500">Quarterly Total GAP Trend</span></h3>
            <p className="text-sm text-gray-500 mt-1">按季度末最新版本对比 {year} 年总 GAP</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="趋势能力模块" value={trendModuleId ?? 'all'} onChange={(event) => changeTrendModule(event.target.value)} className="min-h-9 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="all">全部模块</option>
              {modules.map((module) => <option key={module.id} value={module.id}>{module.name}</option>)}
            </select>
            <select aria-label="趋势技能" value={trendSkillId ?? 'all'} onChange={(event) => setTrendSkillId(event.target.value === 'all' ? undefined : Number(event.target.value))} className="min-h-9 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="all">全部技能</option>
              {trendSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.skill_name}</option>)}
            </select>
          </div>
        </div>
        {trend.isError ? (
          <div className="py-12 text-center text-sm text-red-600">
            趋势数据加载失败
            <button type="button" onClick={() => trend.refetch()} className="ml-3 px-3 py-1 rounded bg-red-50">重试</button>
          </div>
        ) : trend.isLoading ? (
          <div className="py-12 text-center text-sm text-gray-500">正在加载趋势数据…</div>
        ) : !trendData.some((point) => point.hasData) ? (
          <ChartEmptyState message={`${year} 年暂无季度 GAP 历史数据`} />
        ) : (
          <>
            <figure aria-label={`${year} 年季度末总 GAP 趋势`}>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trendData} margin={{ top: 28, left: 8, right: 28, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 4" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="label" tick={CHART_AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} dy={8} />
                  <YAxis allowDecimals={false} tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} formatter={(value) => [formatNumber(Number(value)), '总 GAP']} />
                  <Line
                    type="monotone"
                    dataKey="chartGap"
                    name="总 GAP"
                    stroke={CHART_COLORS.gap}
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#FFFFFF', stroke: CHART_COLORS.gap, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: CHART_COLORS.gap, stroke: '#FFFFFF', strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  >
                    <LabelList dataKey="chartGap" position="top" fill="#475569" fontSize={11} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
              <figcaption className="sr-only">折线只连接具有历史数据的季度；缺少历史基线的季度保持为空。</figcaption>
            </figure>
            {trendData.some((point) => !point.hasData) && (
              <p className="text-xs text-gray-500">暂无历史基线：{trendData.filter((point) => !point.hasData).map((point) => point.label).join('、')}</p>
            )}
          </>
        )}
      </section>

      <section className={cardClass}>
        <h3 className="text-lg font-bold text-gray-900">工程师模块 GAP 汇总 Employee Module GAP Summary</h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">按工程师姓名排列，保留个人、模块和团队 GAP 合计</p>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-max divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700">工程师</th>
                {summary.modules.map((module) => <th key={module.id} className="px-3 py-3 text-right text-xs font-bold text-gray-700 min-w-28">{module.icon} {module.name}</th>)}
                <th className="px-4 py-3 text-right text-xs font-bold text-blue-900">个人总 GAP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.rows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="px-4 py-3"><div className="text-sm font-semibold">{row.employeeName}</div><div className="text-xs text-gray-500">{row.departmentName || '—'}</div></td>
                  {summary.modules.map((module) => <td key={module.id} className="px-3 py-3 text-right text-sm">{row.modules[module.id].hasData ? formatNumber(row.modules[module.id].totalGap) : '—'}</td>)}
                  <td className="px-4 py-3 text-right text-sm font-bold text-blue-900 bg-blue-50">{formatNumber(row.totalGap)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 border-t-2 border-gray-300">
              <tr>
                <td className="px-4 py-3 text-sm font-bold">模块合计</td>
                {summary.modules.map((module) => <td key={module.id} className="px-3 py-3 text-right text-sm font-bold text-red-600">{formatNumber(summary.moduleTotals[module.id])}</td>)}
                <td className="px-4 py-3 text-right text-sm font-bold text-blue-900 bg-blue-100">{formatNumber(summary.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
