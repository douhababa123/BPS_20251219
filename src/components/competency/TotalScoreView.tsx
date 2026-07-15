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

import { formatNumber, type ModuleStats } from '../../lib/competencyAggregation';
import { cn } from '../../lib/utils';

interface TotalScoreViewProps {
  moduleStats: ModuleStats[];
}

interface RadarValueLabelProps {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  value?: number | string;
}

function radarValueLabel(color: string, offset: number) {
  return ({ x, y, cx, cy, value }: RadarValueLabelProps) => {
    if (x === undefined || y === undefined || cx === undefined || cy === undefined || value === undefined) return null;
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    return (
      <text x={x + dx / distance * offset} y={y + dy / distance * offset} fill={color} fontSize={11} fontWeight={700} textAnchor="middle">
        {Number(value).toFixed(1)}
      </text>
    );
  };
}

const currentRadarLabel = radarValueLabel('#2563EB', 10);
const targetRadarLabel = radarValueLabel('#F97316', 24);
const oneDecimal = (value: unknown) => Number(value).toFixed(1);

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
          <h3 className="text-lg font-bold text-gray-900 mb-4">9大能力模块平均分雷达图 Module Average Radar</h3>
          <ResponsiveContainer width="100%" height={450}>
            <RadarChart data={chartData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="module" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} />
              <PolarRadiusAxis angle={90} domain={[0, 4]} tick={{ fontSize: 9 }} />
              <Radar name="平均现状" dataKey="currentAverage" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} strokeWidth={2} label={currentRadarLabel} />
              <Radar name="平均目标" dataKey="targetAverage" stroke="#F97316" fill="#F97316" fillOpacity={0.2} strokeWidth={2} label={targetRadarLabel} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </section>

        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">模块平均分对比 Module Average Comparison</h3>
          <ResponsiveContainer width="100%" height={450}>
            <BarChart data={chartData} margin={{ top: 24, bottom: 80, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="module" angle={-40} textAnchor="end" interval={0} height={100} tick={{ fontSize: 9 }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 10 }} />
              <Tooltip formatter={oneDecimal} />
              <Legend />
              <Bar dataKey="targetAverage" name="平均目标" fill="#F97316" radius={[6, 6, 0, 0]}><LabelList dataKey="targetAverage" position="top" formatter={oneDecimal} /></Bar>
              <Bar dataKey="currentAverage" name="平均现状" fill="#2563EB" radius={[6, 6, 0, 0]}><LabelList dataKey="currentAverage" position="top" formatter={oneDecimal} /></Bar>
            </BarChart>
          </ResponsiveContainer>
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
