import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertCircle, CheckCircle, Upload, Users, Zap, Filter, Target, BarChart2, GitMerge, ClipboardList } from 'lucide-react';
import { KpiCard } from '../components/KpiCard';
import { getAllAssessments } from '../lib/competencyApi';
import { employeesService, tasksService } from '../services';
import {
  buildAbilityGapDistribution,
  buildCompetencyDistribution,
  buildModuleGapRanking,
  buildPersonalGapRanking,
  buildRadarData,
  buildRecentActivities,
  buildSaturationTrend,
  buildTaskDistributions,
  buildTopGapCounts,
  buildUpcomingTasks,
  buildWorkflowSummary,
  getAssessmentYears,
} from '../lib/dashboardData';
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: realAssessments } = useQuery({
    queryKey: ['dashboard-competency-assessments-full'],
    queryFn: () => getAllAssessments(),
  });

  const { data: employees } = useQuery({
    queryKey: ['dashboard-employees'],
    queryFn: () => employeesService.getAll(),
  });

  const { data: tasks } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => tasksService.getTasks(),
  });

  const assessmentYears = useMemo(() => getAssessmentYears(realAssessments || []), [realAssessments]);
  const effectiveYear = assessmentYears.includes(selectedYear)
    ? selectedYear
    : assessmentYears[0] || selectedYear;
  const assessments = useMemo(
    () => (realAssessments || []).filter(assessment => assessment.assessment_year === effectiveYear),
    [realAssessments, effectiveYear]
  );
  const allTasks = tasks || [];

  const radarData = useMemo(() => buildRadarData(assessments), [assessments]);
  const gapData = useMemo(() => buildTopGapCounts(assessments), [assessments]);
  const competencyDistribution = useMemo(() => buildCompetencyDistribution(assessments), [assessments]);
  const moduleGapRanking = useMemo(() => buildModuleGapRanking(assessments), [assessments]);
  const personalGapRanking = useMemo(() => buildPersonalGapRanking(assessments), [assessments]);
  const abilityGapDistribution = useMemo(() => buildAbilityGapDistribution(assessments), [assessments]);
  const { typeDistribution, locationDistribution } = useMemo(() => buildTaskDistributions(allTasks), [allTasks]);
  const workflowCounts = useMemo(() => buildWorkflowSummary(allTasks), [allTasks]);
  const saturationTrend = useMemo(
    () => buildSaturationTrend(allTasks, employees?.length || 0),
    [allTasks, employees?.length]
  );
  const recentActivities = useMemo(() => buildRecentActivities(allTasks), [allTasks]);
  const upcomingTasks = useMemo(() => buildUpcomingTasks(allTasks), [allTasks]);
  const gapCount = useMemo(
    () => new Set(assessments
      .filter(assessment => Number(assessment.gap ?? assessment.target_level - assessment.current_level) >= 2)
      .map(assessment => assessment.employee_id)
    ).size,
    [assessments]
  );
  const latestSaturation = saturationTrend[saturationTrend.length - 1]?.saturation || 0;

  const workflowSummary = useMemo(() => {
    const pending = workflowCounts.pendingApproval;
    const matching = workflowCounts.pendingApproval;
    const allocated = workflowCounts.assigned;
    return [
      { label: '匹配中 Matching', value: matching, color: 'bg-blue-100 text-blue-700', icon: GitMerge },
      { label: '待审批 Pending', value: pending, color: 'bg-amber-100 text-amber-700', icon: ClipboardList },
      { label: '已分配 Assigned', value: allocated, color: 'bg-green-100 text-green-700', icon: CheckCircle },
    ];
  }, [workflowCounts.assigned, workflowCounts.pendingApproval]);

  const focusMilestones = upcomingTasks;

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
              value={effectiveYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
            >
              {(assessmentYears.length > 0 ? assessmentYears : [effectiveYear]).map(year => (
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
          value={`${latestSaturation}%`}
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
          value={workflowCounts.pendingApproval}
          icon={CheckCircle}
          color="blue"
        />
        <KpiCard
          title="团队成员数"
          subtitle="Team Members"
          value={employees?.length || 0}
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
              <YAxis dataKey="name" type="category" width={48} interval={0} />
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
            {recentActivities.map((activity) => {
              const Icon = activity.type === 'pending_approval' ? Zap : activity.type === 'completed' ? CheckCircle : Upload;
              const color = activity.type === 'pending_approval'
                ? 'bg-amber-100 text-amber-600'
                : activity.type === 'completed'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-blue-100 text-blue-600';
              return (
                <div key={activity.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className={cn('p-2 rounded-lg flex-shrink-0', color)}>
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
