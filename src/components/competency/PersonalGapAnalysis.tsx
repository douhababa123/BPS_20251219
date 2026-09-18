import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
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
import { formatNumber, type PersonalModuleStats, type PersonalSkillStats } from '../../lib/competencyAggregation';
import { cn } from '../../lib/utils';

interface PersonalGapAnalysisProps {
  employeeName: string;
  chartType: 'module' | 'skill';
  setChartType: (type: 'module' | 'skill') => void;
  moduleStats: PersonalModuleStats[];
  skillStats: PersonalSkillStats[];
}

const formatPositiveGap = (value: unknown) => Number(value) > 0 ? formatNumber(Number(value)) : '';

export function PersonalGapAnalysis({ employeeName, chartType, setChartType, moduleStats, skillStats }: PersonalGapAnalysisProps) {
  const radarData = chartType === 'module'
    ? moduleStats.map((module) => ({ module: module.moduleName, current: module.current, target: module.target }))
    : skillStats.map((skill) => ({ module: skill.skillName, current: skill.current, target: skill.target }));
  const barData = chartType === 'module'
    ? [...moduleStats].sort((a, b) => b.totalGap - a.totalGap).map((module) => ({ name: module.moduleName, Gap: module.totalGap }))
    : [...skillStats].sort((a, b) => b.gap - a.gap).map((skill) => ({ name: skill.skillName, Gap: skill.gap }));
  const moduleSummary = [...moduleStats].sort((a, b) => b.totalGap - a.totalGap || a.moduleName.localeCompare(b.moduleName));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setChartType('module')} className={cn('px-3 py-1.5 rounded text-sm', chartType === 'module' ? 'bg-blue-600 text-white' : 'bg-gray-100')}>模块</button>
        <button type="button" onClick={() => setChartType('skill')} className={cn('px-3 py-1.5 rounded text-sm', chartType === 'skill' ? 'bg-blue-600 text-white' : 'bg-gray-100')}>技能</button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{employeeName} - 能力雷达图</h3>
          {radarData.length === 0 ? (
            <ChartEmptyState message="暂无个人能力数据" />
          ) : chartType === 'skill' ? (
            <ResponsiveContainer width="100%" height={430}>
              <RadarChart data={radarData}><PolarGrid /><PolarAngleAxis dataKey="module" tick={{ fontSize: 8 }} /><PolarRadiusAxis domain={[0, 4]} /><Radar name="现状" dataKey="current" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} /><Radar name="目标" dataKey="target" stroke="#F97316" fill="#F97316" fillOpacity={0.2} /><Legend /></RadarChart>
            </ResponsiveContainer>
          ) : (
            <figure aria-label={`${employeeName} 的九大能力模块现状与目标雷达图`}>
              <ResponsiveContainer width="100%" height={430}>
                <RadarChart data={radarData} outerRadius="59%" cx="50%" cy="51%" margin={{ top: 24, right: 54, bottom: 30, left: 54 }}>
                  <PolarGrid stroke={CHART_COLORS.grid} />
                  <PolarAngleAxis dataKey="module" tick={{ fontSize: 9, fill: CHART_COLORS.axis }} tickLine={false} />
                  <PolarRadiusAxis domain={[0, 4]} tick={{ fontSize: 9, fill: CHART_COLORS.axis }} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} />
                  <Radar name="现状" dataKey="current" stroke={CHART_COLORS.current} fill={CHART_COLORS.current} fillOpacity={0.24} strokeWidth={2.5} isAnimationActive={false} />
                  <Radar name="目标" dataKey="target" stroke={CHART_COLORS.target} fill={CHART_COLORS.target} fillOpacity={0.12} strokeWidth={2.5} isAnimationActive={false} />
                  <Legend verticalAlign="top" height={30} iconType="line" />
                </RadarChart>
              </ResponsiveContainer>
              <figcaption className="sr-only">蓝色表示当前 Level，橙色表示目标 Level，最高为 4。</figcaption>
            </figure>
          )}
        </section>
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">差距分布 <span className="ml-1 text-sm font-medium text-gray-500">Gap Distribution</span></h3>
          <p className="mb-4 mt-1 text-sm text-gray-500">按 GAP 从高到低显示，优先识别提升重点</p>
          {barData.length === 0 ? (
            <ChartEmptyState message="暂无个人 GAP 数据" />
          ) : (
            <figure aria-label={`${employeeName} 按${chartType === 'module' ? '模块' : '技能'}显示的 GAP 分布`}>
              <div className="max-h-[430px] overflow-y-auto pr-1">
                <div style={{ height: horizontalChartHeight(barData.length, 38, 380) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={barData} margin={{ top: 8, bottom: 8, left: 8, right: 52 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 4" stroke={CHART_COLORS.grid} />
                      <XAxis type="number" allowDecimals={false} tick={CHART_AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
                      <YAxis type="category" dataKey="name" width={190} interval={0} tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} formatter={(value) => [formatNumber(Number(value)), 'GAP']} />
                      <Bar dataKey="Gap" name="GAP" fill={CHART_COLORS.gap} radius={[0, 5, 5, 0]} maxBarSize={20} isAnimationActive={false}>
                        <LabelList dataKey="Gap" position="right" fill="#475569" fontSize={11} formatter={formatPositiveGap} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <figcaption className="sr-only">每个条形末端显示对应模块或技能的 GAP 数值。</figcaption>
            </figure>
          )}
        </section>
      </div>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900">模块能力汇总 Module Summary</h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">显示每个模块的总 GAP 分数</p>
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-bold">模块</th><th className="px-4 py-3 text-right text-xs font-bold">总 GAP</th><th className="px-4 py-3 text-right text-xs font-bold">技能数量</th><th className="px-4 py-3 text-right text-xs font-bold">状态</th></tr></thead><tbody className="divide-y divide-gray-200">
          {moduleSummary.map((module) => <tr key={module.moduleId}><td className="px-4 py-3 text-sm font-medium">{module.icon} {module.moduleName}</td><td className="px-4 py-3 text-right text-sm font-bold" data-testid={`personal-module-gap-${module.moduleId}`}>{formatNumber(module.totalGap)}</td><td className="px-4 py-3 text-right text-sm">{module.skillCount}</td><td className="px-4 py-3 text-right"><span className={cn('px-2 py-1 rounded text-xs font-medium', module.totalGap === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{module.totalGap === 0 ? '✓ 已达标' : '需提升'}</span></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">提升建议 Recommendations（Top 10）</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{skillStats.filter((skill) => skill.gap > 0).slice(0, 10).map((skill, index) => <div key={skill.skillId} className="p-3 border border-gray-200 rounded-lg"><p className="text-sm font-semibold">{index + 1}. {skill.skillName}</p><p className="text-xs text-gray-500">{skill.moduleName}</p><p className="text-xs mt-2">现状 L{skill.current} → 目标 L{skill.target}；GAP {skill.gap}</p></div>)}</div>
      </section>
    </div>
  );
}
