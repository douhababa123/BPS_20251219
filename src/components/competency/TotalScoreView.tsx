import { Award, Target, TrendingUp } from 'lucide-react';
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
import { formatNumber, type ModuleStats } from '../../lib/competencyAggregation';
import { cn } from '../../lib/utils';

interface TotalScoreViewProps {
  moduleStats: ModuleStats[];
}

interface RadarValueLabelProps {
  x?: number;
  y?: number;
  value?: number | string;
}

function radarValueLabel(color: string, yOffset: number) {
  return ({ x, y, value }: RadarValueLabelProps) => {
    if (x === undefined || y === undefined || value === undefined) return null;
    return (
      <text x={x} y={y + yOffset} fill={color} fontSize={11} fontWeight={700} textAnchor="middle">
        {Number(value).toFixed(1)}
      </text>
    );
  };
}

const currentRadarLabel = radarValueLabel('#2563EB', -7);
const targetRadarLabel = radarValueLabel(CHART_COLORS.target, 14);
const oneDecimal = (value: unknown) => Number(value).toFixed(1);

interface RadarAxisTickProps {
  x?: number;
  y?: number;
  textAnchor?: 'start' | 'middle' | 'end';
  payload?: { value?: string };
}

function splitRadarLabel(value: string) {
  if (value.length <= 19) return [value];
  const words = value.split(/(?=[_])|\s+/).filter(Boolean);
  if (words.length < 2) return [value];
  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(' '), words.slice(midpoint).join(' ')];
}

function RadarAxisTick({ x = 0, y = 0, textAnchor = 'middle', payload }: RadarAxisTickProps) {
  const lines = splitRadarLabel(payload?.value || '');
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill={CHART_COLORS.axis} fontSize={10}>
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : 13}>{line}</tspan>
      ))}
    </text>
  );
}

export function TotalScoreView({ moduleStats }: TotalScoreViewProps) {
  const chartData = moduleStats.map((module) => ({
    module: module.moduleName,
    currentAverage: Number(module.avgCurrent.toFixed(1)),
    targetAverage: Number(module.avgTarget.toFixed(1)),
  }));
  const totalStats = {
    totalTarget: moduleStats.reduce((sum, module) => sum + module.totalTarget, 0),
    totalCurrent: moduleStats.reduce((sum, module) => sum + module.totalCurrent, 0),
    totalGap: moduleStats.reduce((sum, module) => sum + module.totalGap, 0),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200"><div className="flex items-center justify-between"><div><div className="text-blue-600 text-sm font-medium">总目标分数</div><div className="text-3xl font-bold text-blue-900 mt-2">{formatNumber(totalStats.totalTarget)}</div><div className="text-xs text-blue-600 mt-1">Target Total Score</div></div><Target className="w-10 h-10 text-blue-400" /></div></div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200"><div className="flex items-center justify-between"><div><div className="text-green-600 text-sm font-medium">总实际分数</div><div className="text-3xl font-bold text-green-900 mt-2">{formatNumber(totalStats.totalCurrent)}</div><div className="text-xs text-green-600 mt-1">Current Total Score</div></div><Award className="w-10 h-10 text-green-400" /></div></div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200"><div className="flex items-center justify-between"><div><div className="text-purple-600 text-sm font-medium">总差距</div><div className="text-3xl font-bold text-purple-900 mt-2">{formatNumber(totalStats.totalGap)}</div><div className="text-xs text-purple-600 mt-1">Total Gap</div></div><TrendingUp className="w-10 h-10 text-purple-400" /></div></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">9大能力模块平均分雷达图</h3>
          <p className="mt-1 text-sm text-gray-500">Module Average Radar · 评分范围 0–4</p>
          {chartData.length === 0 ? (
            <ChartEmptyState message="暂无模块平均分数据" />
          ) : (
            <figure aria-label="九大能力模块平均现状与平均目标雷达图">
              <ResponsiveContainer width="100%" height={450}>
                <RadarChart data={chartData} outerRadius="61%" cx="50%" cy="53%" margin={{ top: 28, right: 58, bottom: 32, left: 58 }}>
                  <PolarGrid stroke={CHART_COLORS.grid} />
                  <PolarAngleAxis dataKey="module" tick={<RadarAxisTick />} tickLine={false} />
                  <PolarRadiusAxis angle={90} domain={[0, 4]} tick={{ fontSize: 9, fill: CHART_COLORS.axis }} axisLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} formatter={oneDecimal} />
                  <Legend verticalAlign="top" height={30} iconType="line" />
                  <Radar name="平均现状" dataKey="currentAverage" stroke={CHART_COLORS.current} fill={CHART_COLORS.current} fillOpacity={0.24} strokeWidth={2.5} label={currentRadarLabel} isAnimationActive={false} />
                  <Radar name="平均目标" dataKey="targetAverage" stroke={CHART_COLORS.target} fill={CHART_COLORS.target} fillOpacity={0.12} strokeWidth={2.5} label={targetRadarLabel} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
              <figcaption className="sr-only">蓝色表示平均现状，橙色表示平均目标，各模块最高为 4 分。</figcaption>
            </figure>
          )}
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">模块平均分对比</h3>
          <p className="mt-1 text-sm text-gray-500">Module Average Comparison · 评分范围 0–4</p>
          {chartData.length === 0 ? (
            <ChartEmptyState message="暂无模块平均分数据" />
          ) : (
            <figure aria-label="九大能力模块平均现状与平均目标水平对比图">
              <div style={{ height: horizontalChartHeight(chartData.length, 40, 420) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartData} margin={{ top: 18, bottom: 8, left: 8, right: 44 }} barGap={3}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 4" stroke={CHART_COLORS.grid} />
                    <XAxis type="number" domain={[0, 4]} tick={CHART_AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
                    <YAxis type="category" dataKey="module" width={178} interval={0} tick={{ ...CHART_AXIS_TICK, fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} formatter={oneDecimal} />
                    <Legend verticalAlign="top" align="right" height={34} iconType="square" />
                    <Bar dataKey="currentAverage" name="平均现状" fill={CHART_COLORS.current} radius={[0, 5, 5, 0]} maxBarSize={13} isAnimationActive={false}>
                      <LabelList dataKey="currentAverage" position="right" fill="#475569" fontSize={11} formatter={oneDecimal} />
                    </Bar>
                    <Bar dataKey="targetAverage" name="平均目标" fill={CHART_COLORS.target} radius={[0, 5, 5, 0]} maxBarSize={13} isAnimationActive={false}>
                      <LabelList dataKey="targetAverage" position="right" fill="#475569" fontSize={11} formatter={oneDecimal} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <figcaption className="sr-only">每个模块以蓝色条表示平均现状，以橙色条表示平均目标。</figcaption>
            </figure>
          )}
        </section>
      </div>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">模块总分详情 Module Total Score Details</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-bold text-gray-700">模块名称</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700">目标总分</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700">实际总分</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700">差距</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700">完成率</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-700">评估人数</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {moduleStats.map((module) => {
                const completionRate = module.totalTarget > 0 ? module.totalCurrent / module.totalTarget * 100 : 0;
                return <tr key={module.moduleId}><td className="px-4 py-3 text-sm font-medium">{module.icon} {module.moduleName}</td><td className="px-4 py-3 text-right text-sm text-orange-600">{formatNumber(module.totalTarget)}</td><td className="px-4 py-3 text-right text-sm text-blue-600">{formatNumber(module.totalCurrent)}</td><td className="px-4 py-3 text-right text-sm text-purple-600">{formatNumber(module.totalGap)}</td><td className={cn('px-4 py-3 text-right text-sm font-bold', completionRate >= 90 ? 'text-green-600' : completionRate >= 70 ? 'text-yellow-600' : 'text-red-600')}>{completionRate.toFixed(1)}%</td><td className="px-4 py-3 text-right text-sm">{module.employeeCount}</td></tr>;
              })}
            </tbody>
            <tfoot className="bg-gray-100"><tr><td className="px-4 py-3 text-sm font-bold">总计</td><td className="px-4 py-3 text-right text-sm font-bold text-orange-600">{formatNumber(totalStats.totalTarget)}</td><td className="px-4 py-3 text-right text-sm font-bold text-blue-600">{formatNumber(totalStats.totalCurrent)}</td><td className="px-4 py-3 text-right text-sm font-bold text-purple-600">{formatNumber(totalStats.totalGap)}</td><td colSpan={2} /></tr></tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
