import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertCircle, CheckCircle, Upload, Users, Zap, Filter, Target, BarChart2, GitMerge, ClipboardList } from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { mockApi } from '../lib/mockApi';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { TOPICS } from '../lib/constants';
import { cn } from '../lib/utils';

export function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(2025);

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: mockApi.getCompetencyModules,
  });

  const { data: items } = useQuery({
    queryKey: ['items'],
    queryFn: mockApi.getCompetencyItems,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: mockApi.getUsers,
  });

  const { data: assessments } = useQuery({
    queryKey: ['assessments', selectedYear],
    queryFn: () => mockApi.getAssessments(selectedYear),
  });

  const { data: slots } = useQuery({
    queryKey: ['slots', '2025-01-01', '2025-02-28'],
    queryFn: () => mockApi.getCalendarSlots('2025-01-01', '2025-02-28'),
  });

  const radarData = modules?.map(module => {
    const moduleItems = items?.filter(i => i.moduleId === module.id) || [];
    const moduleAssessments = assessments?.filter(a =>
      moduleItems.some(i => i.id === a.itemId)
    ) || [];

    const avgCurrent = moduleAssessments.length > 0
      ? moduleAssessments.reduce((sum, a) => sum + a.currentLevel, 0) / moduleAssessments.length
      : 0;

    const avgTarget = moduleAssessments.length > 0
      ? moduleAssessments.reduce((sum, a) => sum + a.targetLevel, 0) / moduleAssessments.length
      : 0;

    return {
      module: module.name,
      current: Number(avgCurrent.toFixed(1)),
      target: Number(avgTarget.toFixed(1)),
    };
  }) || [];

  const gapData = useMemo(() => assessments
    ?.filter(a => a.targetLevel - a.currentLevel >= 2)
    .reduce((acc, a) => {
      const existing = acc.find(x => x.userId === a.userId);
      if (existing) {
        existing.gaps += 1;
      } else {
        acc.push({ userId: a.userId, gaps: 1 });
      }
      return acc;
    }, [] as Array<{ userId: number; gaps: number }>)
    .sort((a, b) => b.gaps - a.gaps)
    .slice(0, 5)
    .map(g => ({
      name: users?.find(u => u.id === g.userId)?.name || `User ${g.userId}`,
      gaps: g.gaps,
    })) || [], [assessments, users]);

  const typeDistribution = slots
    ?.reduce((acc, slot) => {
      const existing = acc.find(x => x.name === slot.type);
      if (existing) {
        existing.value += slot.hours;
      } else {
        acc.push({ name: slot.type, value: slot.hours });
      }
      return acc;
    }, [] as Array<{ name: string; value: number }>) || [];

  const locationDistribution = slots
    ?.reduce((acc, slot) => {
      const existing = acc.find(x => x.name === slot.location);
      if (existing) {
        existing.value += slot.hours;
      } else {
        acc.push({ name: slot.location, value: slot.hours });
      }
      return acc;
    }, [] as Array<{ name: string; value: number }>) || [];

  const gapCount = assessments?.filter(a => a.targetLevel - a.currentLevel >= 2).length || 0;

  const saturationTrend = [
    { month: 'Jan', saturation: 72 },
    { month: 'Feb', saturation: 75 },
    { month: 'Mar', saturation: 78 },
    { month: 'Apr', saturation: 81 },
    { month: 'May', saturation: 78 },
  ];

  const competencyDistribution = assessments?.reduce((acc, a) => {
    const level = Math.round(a.currentLevel);
    const existing = acc.find(x => x.level === level);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ level, count: 1, name: `L${level}` });
    }
    return acc;
  }, [] as Array<{ level: number; count: number; name: string }>).sort((a, b) => a.level - b.level) || [];

  const moduleGapRanking = useMemo(() => modules?.map(module => {
    const moduleItems = items?.filter(i => i.moduleId === module.id) || [];
    const moduleAssessments = assessments?.filter(a => moduleItems.some(i => i.id === a.itemId)) || [];
    const gapSum = moduleAssessments.reduce((sum, a) => sum + (a.targetLevel - a.currentLevel), 0);
    const avgGap = moduleAssessments.length ? gapSum / moduleAssessments.length : 0;
    const gap2Plus = moduleAssessments.filter(a => a.targetLevel - a.currentLevel >= 2).length;
    return {
      module: module.name,
      avgGap: Number(avgGap.toFixed(2)),
      gap2Plus,
      totalGap: Number(gapSum.toFixed(2)),
    };
  }).sort((a, b) => b.avgGap - a.avgGap) || [], [modules, items, assessments]);

  const personalGapRanking = useMemo(() => {
    if (!assessments) return [];
    const perUser = assessments.reduce((acc, a) => {
      const gap = a.targetLevel - a.currentLevel;
      if (gap <= 0) return acc;
      const existing = acc.get(a.userId) || 0;
      acc.set(a.userId, existing + gap);
      return acc;
    }, new Map<number, number>());
    return Array.from(perUser.entries())
      .map(([userId, totalGap]) => ({
        userId,
        name: users?.find(u => u.id === userId)?.name || `User ${userId}`,
        totalGap: Number(totalGap.toFixed(2)),
      }))
      .sort((a, b) => b.totalGap - a.totalGap)
      .slice(0, 6);
  }, [assessments, users]);

  const abilityGapDistribution = useMemo(() => {
    if (!assessments || !items) return [] as Array<{ name: string; module: string; totalGap: number; gap2Plus: number }>;

    const map = new Map<number, { name: string; module: string; totalGap: number; gap2Plus: number }>();

    assessments.forEach(assessment => {
      const gap = assessment.targetLevel - assessment.currentLevel;
      if (gap <= 0) return;
      const item = items.find(i => i.id === assessment.itemId);
      if (!item) return;
      const moduleName = modules?.find(m => m.id === item.moduleId)?.name || '';
      const existing = map.get(item.id) || { name: item.name, module: moduleName, totalGap: 0, gap2Plus: 0 };
      existing.totalGap += gap;
      if (gap >= 2) existing.gap2Plus += 1;
      map.set(item.id, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalGap - a.totalGap)
      .slice(0, 8);
  }, [assessments, items, modules]);

  const workflowSummary = useMemo(() => {
    const pending = 3;
    const matching = Math.max(personalGapRanking.length, 4);
    const allocated = 5;
    return [
      { label: '匹配中 Matching', value: matching, color: 'bg-blue-100 text-blue-700', icon: GitMerge },
      { label: '待审批 Pending', value: pending, color: 'bg-amber-100 text-amber-700', icon: ClipboardList },
      { label: '已分配 Assigned', value: allocated, color: 'bg-green-100 text-green-700', icon: CheckCircle },
    ];
  }, [personalGapRanking.length]);

  const focusMilestones = [
    { title: '2025/10/31 技术说明', status: '进行中 In progress', progress: 45 },
    { title: '2025/11/21 产品开发', status: '未开始 Planned', progress: 5 },
    { title: '2025/12/15 调试改善', status: '未开始 Planned', progress: 0 },
    { title: '2025/12/31 部署上线', status: '未开始 Planned', progress: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">BPS 能力与任务全景驾驶舱</h2>
          <p className="text-sm text-gray-500">快速识别短板 · 即时掌握饱和度 · 监控流程进度</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
            <Filter className="w-4 h-4 text-blue-900" />
            <span className="text-sm text-gray-600">评估年度</span>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
            >
              {[2023, 2024, 2025].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <KpiCard
          title="本月平均饱和度"
          subtitle="Monthly Avg Saturation"
          value="78%"
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          title="关键差距≥2人数"
          subtitle="Critical Gaps ≥2"
          value={gapCount}
          icon={AlertCircle}
          color="amber"
        />
        <KpiCard
          title="待审批任务数"
          subtitle="Pending Tasks"
          value="3"
          icon={CheckCircle}
          color="blue"
        />
        <KpiCard
          title="团队成员数"
          subtitle="Team Members"
          value="10"
          icon={Users}
          color="green"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">饱和度趋势 Saturation Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={saturationTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Line type="monotone" dataKey="saturation" stroke="#1E3A8A" strokeWidth={3} dot={{ fill: '#1E3A8A', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">能力等级分布 Level Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={competencyDistribution} layout="vertical">
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={40} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">团队能力雷达图 Team Competency Radar</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="module" tick={{ fontSize: 12 }} />
              <Radar name="Current" dataKey="current" stroke="#1E3A8A" fill="#1E3A8A" fillOpacity={0.3} />
              <Radar name="Target" dataKey="target" stroke="#B91C1C" fill="#B91C1C" fillOpacity={0.2} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">差距Top 5 Top Gaps</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={gapData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="gaps" fill="#B45309" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">任务类型分布 Task Type</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={typeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name }) => name}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {typeDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={TOPICS[index % TOPICS.length].colorHex} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">任务地点占比 Location Mix</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={locationDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `${value}h`} />
              <Bar dataKey="value" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">最近活动 Recent Activity</h3>
          <div className="space-y-2">
            {[
              { type: 'import', desc: '导入2025年能力数据', time: '2小时前', icon: Upload, color: 'bg-blue-100 text-blue-600' },
              { type: 'match', desc: '匹配任务 L24 HC Optimization', time: '5小时前', icon: Zap, color: 'bg-amber-100 text-amber-600' },
              { type: 'assign', desc: '指派任务给 Wang Pei', time: '1天前', icon: CheckCircle, color: 'bg-green-100 text-green-600' },
              { type: 'import', desc: '导入日历排程数据', time: '2天前', icon: Upload, color: 'bg-blue-100 text-blue-600' },
            ].map((activity, idx) => {
              const Icon = activity.icon;
              return (
                <div key={idx} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className={cn('p-2 rounded-lg flex-shrink-0', activity.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{activity.desc}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">重点模块差距 Top Modules</h3>
          <div className="space-y-3">
            {moduleGapRanking.slice(0, 4).map((module, index) => (
              <div key={module.module} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-900 font-semibold flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{module.module}</p>
                    <p className="text-xs text-gray-500">重点提升 {module.gap2Plus} 项能力</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-700">Avg Gap {module.avgGap}</p>
                  <p className="text-xs text-gray-400">Total {module.totalGap.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">差距排行榜 Gap Ranking</h3>
          <div className="space-y-3">
            {personalGapRanking.map((user, index) => (
              <div key={user.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-2 h-12 rounded-full', index < 2 ? 'bg-amber-500' : 'bg-gray-200')}></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">Gap Total</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-blue-900">{user.totalGap}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">任务流程监控 Workflow</h3>
          <div className="space-y-3">
            {workflowSummary.map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                </div>
                <span className="text-lg font-bold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {abilityGapDistribution.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">能力类型差距 Top Competency Types</h3>
              <p className="text-xs text-gray-500">展示差距总分最高的 8 个能力类型，支持识别重点训练主题</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={abilityGapDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value} 分`} labelFormatter={(label, payload) => {
                    const item = payload && payload[0]?.payload;
                    return `${label} · ${item?.module}`;
                  }} />
                  <Bar dataKey="totalGap" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-3">Gap≥2 提醒</h4>
              <ul className="space-y-2 text-xs text-blue-900">
                {abilityGapDistribution
                  .filter(item => item.gap2Plus > 0)
                  .slice(0, 4)
                  .map(item => (
                    <li key={item.name} className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="px-2 py-0.5 bg-white/70 rounded-full text-[11px]">
                        Gap≥2 {item.gap2Plus}
                      </span>
                    </li>
                  ))}
                {abilityGapDistribution.filter(item => item.gap2Plus > 0).length === 0 && (
                  <li className="text-xs text-blue-700">当前无 Gap≥2 的能力类型</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">项目里程碑 Milestones</h3>
            <p className="text-sm text-gray-600 mb-4">与时间表同步，掌握平台交付节奏</p>
            <div className="space-y-3">
              {focusMilestones.map(milestone => (
                <div key={milestone.title} className="p-3 bg-white/60 rounded-xl border border-white/70">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{milestone.title}</p>
                      <p className="text-xs text-gray-500">{milestone.status}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Target className="w-3 h-3" />
                      <span>{milestone.progress}%</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-700" style={{ width: `${milestone.progress}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ml-6 w-48">
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4">
              <div className="flex items-center gap-3 mb-3">
                <BarChart2 className="w-5 h-5 text-blue-700" />
                <p className="text-sm font-semibold text-gray-900">能力短板提醒</p>
              </div>
              <ul className="space-y-2 text-xs text-gray-600">
                {moduleGapRanking.slice(0, 3).map(module => (
                  <li key={module.module} className="flex items-center justify-between">
                    <span>{module.module}</span>
                    <span className="text-amber-600 font-semibold">{module.avgGap}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
