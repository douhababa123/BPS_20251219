import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseService } from '../lib/supabaseService';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Filter, RefreshCw, Download, TrendingUp, Users, Award, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  calculateTeamModuleStats,
  calculateTeamSkillStats,
  calculatePersonalModuleStats,
  calculatePersonalSkillStats,
  getRankIcon,
  formatNumber,
  type ModuleStats,
  type SkillStats,
} from '../lib/competencyAggregation';

type ViewMode = 'team' | 'personal';
type SubViewMode = 'analysis' | 'ranking';
type ChartType = 'module' | 'skill';

export function Competency() {
  const [viewMode, setViewMode] = useState<ViewMode>('team');
  const [subViewMode, setSubViewMode] = useState<SubViewMode>('analysis');
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('module');

  // 获取数据
  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => supabaseService.getAllEmployees(),
  });

  const { data: skills = [], isLoading: loadingSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => supabaseService.getAllSkills(),
  });

  const { data: assessments = [], isLoading: loadingAssessments, refetch } = useQuery({
    queryKey: ['assessments', selectedYear],
    queryFn: () => supabaseService.getAllAssessments(selectedYear),
  });

  const isLoading = loadingEmployees || loadingSkills || loadingAssessments;

  // 计算团队统计
  const teamModuleStats = useMemo(
    () => calculateTeamModuleStats(assessments, skills),
    [assessments, skills]
  );

  const teamSkillStats = useMemo(
    () => calculateTeamSkillStats(assessments, skills),
    [assessments, skills]
  );

  // 计算个人统计
  const personalModuleStats = useMemo(
    () => selectedEmployee ? calculatePersonalModuleStats(selectedEmployee, assessments, skills) : [],
    [selectedEmployee, assessments, skills]
  );

  const personalSkillStats = useMemo(
    () => selectedEmployee ? calculatePersonalSkillStats(selectedEmployee, assessments, skills) : [],
    [selectedEmployee, assessments, skills]
  );

  // 模块排名（按总Gap排序 - 显示所有9个模块）
  const moduleRanking = useMemo(() => {
    return [...teamModuleStats]
      .sort((a, b) => b.totalGap - a.totalGap)
      .map((module, index) => ({
        ...module,
        rank: index + 1,
      }));
  }, [teamModuleStats]);

  // 统计卡片数据
  const statistics = useMemo(() => {
    const totalGap = assessments.reduce((sum, a) => sum + a.gap, 0);
    const avgCurrent = assessments.length > 0
      ? assessments.reduce((sum, a) => sum + a.current_level, 0) / assessments.length
      : 0;
    const avgTarget = assessments.length > 0
      ? assessments.reduce((sum, a) => sum + a.target_level, 0) / assessments.length
      : 0;
    const gapCount = assessments.filter(a => a.gap > 0).length;

    return {
      employeeCount: new Set(assessments.map(a => a.employee_id)).size,
      skillCount: new Set(assessments.map(a => a.skill_id)).size,
      avgCurrent: formatNumber(avgCurrent),
      avgTarget: formatNumber(avgTarget),
      totalGap: formatNumber(totalGap),
      gapCount,
    };
  }, [assessments]);

  // 准备团队雷达图数据（9大模块 - 确保显示所有模块）
  const teamRadarData = teamModuleStats.map(m => ({
    module: m.moduleName.length > 25 ? m.moduleName.substring(0, 25) + '...' : m.moduleName,
    现状: Number(formatNumber(m.avgCurrent)),
    目标: Number(formatNumber(m.avgTarget)),
  }));

  // 准备个人雷达图数据（显示所有数据）
  const personalRadarData = chartType === 'module'
    ? personalModuleStats.map(m => ({
        module: m.moduleName.length > 25 ? m.moduleName.substring(0, 25) + '...' : m.moduleName,
        现状: Number(formatNumber(m.current)),
        目标: Number(formatNumber(m.target)),
      }))
    : personalSkillStats.map(s => ({
        module: s.skillName.length > 20 ? s.skillName.substring(0, 20) + '...' : s.skillName,
        现状: s.current,
        目标: s.target,
      }));

  // 准备柱状图数据（显示所有模块和技能）
  const teamBarData = chartType === 'module'
    ? teamModuleStats
        .sort((a, b) => b.totalGap - a.totalGap)
        .map(m => ({
          name: m.moduleName.length > 18 ? m.moduleName.substring(0, 18) + '...' : m.moduleName,
          总Gap: Number(formatNumber(m.totalGap)),
          平均Gap: Number(formatNumber(m.avgGap)),
        }))
    : teamSkillStats
        .map(s => ({
          name: s.skillName.length > 20 ? s.skillName.substring(0, 20) + '...' : s.skillName,
          总Gap: Number(formatNumber(s.totalGap)),
          平均Gap: Number(formatNumber(s.avgGap)),
        }));

  const personalBarData = chartType === 'module'
    ? personalModuleStats
        .sort((a, b) => b.gap - a.gap)
        .map(m => ({
          name: m.moduleName.length > 18 ? m.moduleName.substring(0, 18) + '...' : m.moduleName,
          Gap: Number(formatNumber(m.gap)),
        }))
    : personalSkillStats
        .map(s => ({
          name: s.skillName.length > 20 ? s.skillName.substring(0, 20) + '...' : s.skillName,
          Gap: s.gap,
        }));

  // 导出CSV
  const handleExport = () => {
    const headers = viewMode === 'team'
      ? ['模块', '平均现状', '平均目标', '总Gap', '平均Gap', '评估人数']
      : ['技能', '现状', '目标', 'Gap'];
    
    const rows = viewMode === 'team'
      ? teamModuleStats.map(m => [
          m.moduleName,
          formatNumber(m.avgCurrent),
          formatNumber(m.avgTarget),
          formatNumber(m.totalGap),
          formatNumber(m.avgGap),
          m.employeeCount,
        ])
      : personalSkillStats.map(s => [
          s.skillName,
          s.current,
          s.target,
          s.gap,
        ]);

    const csvContent = '\ufeff' + [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `能力画像_${viewMode === 'team' ? '团队' : '个人'}_${selectedYear}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="w-full space-y-4">
        {/* 顶部区域 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">能力画像 Competency Intelligence</h1>
              <p className="text-gray-600 mt-1">分析团队能力现状，定位提升重点</p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                <Filter className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">评估年度</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
                >
                  {[2023, 2024, 2025].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>刷新</span>
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>导出</span>
              </button>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-blue-600 text-sm font-medium">员工总数</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">{statistics.employeeCount}</div>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-green-600 text-sm font-medium">技能总数</div>
                  <div className="text-2xl font-bold text-green-900 mt-1">{statistics.skillCount}</div>
                </div>
                <Award className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-amber-600 text-sm font-medium">平均现状</div>
                  <div className="text-2xl font-bold text-amber-900 mt-1">{statistics.avgCurrent}</div>
                </div>
                <Target className="w-8 h-8 text-amber-400" />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-purple-600 text-sm font-medium">总差距</div>
                  <div className="text-2xl font-bold text-purple-900 mt-1">{statistics.totalGap}</div>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* 一级Tab */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('team')}
            className={cn(
              'px-6 py-3 rounded-lg font-medium transition-colors',
              viewMode === 'team'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            )}
          >
            团队视图 Team View
          </button>
          <button
            onClick={() => setViewMode('personal')}
            className={cn(
              'px-6 py-3 rounded-lg font-medium transition-colors',
              viewMode === 'personal'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            )}
          >
            个人视图 Personal View
          </button>
        </div>

        {/* 内容区域 */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">正在加载数据...</p>
          </div>
        ) : viewMode === 'team' ? (
          <TeamView
            subViewMode={subViewMode}
            setSubViewMode={setSubViewMode}
            chartType={chartType}
            setChartType={setChartType}
            radarData={teamRadarData}
            barData={teamBarData}
            moduleRanking={moduleRanking}
          />
        ) : (
          <PersonalView
            subViewMode={subViewMode}
            setSubViewMode={setSubViewMode}
            chartType={chartType}
            setChartType={setChartType}
            employees={employees}
            selectedEmployee={selectedEmployee}
            setSelectedEmployee={setSelectedEmployee}
            radarData={personalRadarData}
            barData={personalBarData}
            skillStats={personalSkillStats}
          />
        )}
      </div>
    </div>
  );
}

// 团队视图组件
function TeamView({
  subViewMode,
  setSubViewMode,
  chartType,
  setChartType,
  radarData,
  barData,
  moduleRanking,
}: {
  subViewMode: SubViewMode;
  setSubViewMode: (mode: SubViewMode) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  radarData: any[];
  barData: any[];
  moduleRanking: (ModuleStats & { rank: number })[];
}) {
  return (
    <div className="space-y-4">
      {/* 二级Tab */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubViewMode('analysis')}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            subViewMode === 'analysis'
              ? 'bg-white text-blue-600 border-2 border-blue-600'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
          )}
        >
          差距分析 Gap Analysis
        </button>
        <button
          onClick={() => setSubViewMode('ranking')}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            subViewMode === 'ranking'
              ? 'bg-white text-blue-600 border-2 border-blue-600'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
          )}
        >
          排名 Ranking
        </button>
      </div>

      {subViewMode === 'analysis' ? (
        <div className="grid grid-cols-2 gap-4">
          {/* 团队雷达图 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              团队9大模块雷达图 Team Module Radar
            </h3>
            <ResponsiveContainer width="100%" height={450}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis 
                  dataKey="module" 
                  tick={{ fontSize: 10, fill: '#374151' }} 
                  tickLine={false}
                />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                <Radar name="现状" dataKey="现状" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} strokeWidth={2} />
                <Radar name="目标" dataKey="目标" stroke="#F97316" fill="#F97316" fillOpacity={0.2} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 差距分布柱状图 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">差距分布 Gap Distribution</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {chartType === 'module' ? '显示全部9个模块' : '显示全部39个技能'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartType('module')}
                  className={cn(
                    'px-3 py-1 rounded text-sm font-medium transition-colors',
                    chartType === 'module'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  模块级(9个)
                </button>
                <button
                  onClick={() => setChartType('skill')}
                  className={cn(
                    'px-3 py-1 rounded text-sm font-medium transition-colors',
                    chartType === 'skill'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  技能级(39个)
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={450}>
              <BarChart data={barData} margin={{ bottom: 80, left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9, fill: '#374151' }} 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                />
                <Bar dataKey="总Gap" fill="#2563EB" radius={[6, 6, 0, 0]} />
                {chartType === 'module' && <Bar dataKey="平均Gap" fill="#F59E0B" radius={[6, 6, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                模块排名 Module Ranking（全部9个模块，按总Gap排序）
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                显示所有9大能力模块的排名情况
              </p>
            </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">排名</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">模块名称</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">总Gap</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">平均Gap</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">评估人数</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {moduleRanking.map((module) => (
                  <tr key={module.moduleId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="text-2xl">{getRankIcon(module.rank)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{module.icon}</span>
                        <span className="text-sm font-medium text-gray-900">{module.moduleName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                      {formatNumber(module.totalGap)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {formatNumber(module.avgGap)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">
                      {module.employeeCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 个人视图组件
function PersonalView({
  subViewMode,
  setSubViewMode,
  chartType,
  setChartType,
  employees,
  selectedEmployee,
  setSelectedEmployee,
  radarData,
  barData,
  skillStats,
}: {
  subViewMode: SubViewMode;
  setSubViewMode: (mode: SubViewMode) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  employees: any[];
  selectedEmployee: string | null;
  setSelectedEmployee: (id: string | null) => void;
  radarData: any[];
  barData: any[];
  skillStats: any[];
}) {
  const selectedEmployeeInfo = employees.find(e => e.id === selectedEmployee);

  return (
    <div className="space-y-4">
      {/* 工程师选择 */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">选择工程师：</label>
          <select
            value={selectedEmployee || ''}
            onChange={(e) => setSelectedEmployee(e.target.value || null)}
            className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">请选择...</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} - {emp.departments?.name || '无部门'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEmployee ? (
        <>
          {/* 二级Tab */}
          <div className="flex gap-2">
            <button
              onClick={() => setSubViewMode('analysis')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                subViewMode === 'analysis'
                  ? 'bg-white text-blue-600 border-2 border-blue-600'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              )}
            >
              差距分析 Gap Analysis
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 个人雷达图 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {selectedEmployeeInfo?.name} - 能力雷达图
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {chartType === 'module' ? '显示9大模块' : `显示全部${skillStats.length}个技能`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChartType('module')}
                      className={cn(
                        'px-3 py-1 rounded text-sm font-medium transition-colors',
                        chartType === 'module'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      9大模块
                    </button>
                    <button
                      onClick={() => setChartType('skill')}
                      className={cn(
                        'px-3 py-1 rounded text-sm font-medium transition-colors',
                        chartType === 'skill'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      全部技能
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={450}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis 
                      dataKey="module" 
                      tick={{ fontSize: chartType === 'skill' ? 8 : 10, fill: '#374151' }}
                      tickLine={false}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} />
                    <Radar name="现状" dataKey="现状" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} strokeWidth={2} />
                    <Radar name="目标" dataKey="目标" stroke="#F97316" fill="#F97316" fillOpacity={0.2} strokeWidth={2} />
                    <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* 个人差距柱状图 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">差距分布</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {chartType === 'module' ? '显示9个模块' : `显示全部${skillStats.length}个技能`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChartType('module')}
                      className={cn(
                        'px-3 py-1 rounded text-sm font-medium transition-colors',
                        chartType === 'module'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      模块级(9个)
                    </button>
                    <button
                      onClick={() => setChartType('skill')}
                      className={cn(
                        'px-3 py-1 rounded text-sm font-medium transition-colors',
                        chartType === 'skill'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      技能级({skillStats.length}个)
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={450}>
                  <BarChart data={barData} margin={{ bottom: 80, left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: chartType === 'skill' ? 8 : 9, fill: '#374151' }}
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      interval={0}
                    />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                      cursor={{ fill: 'rgba(239, 68, 68, 0.1)' }}
                    />
                    <Bar dataKey="Gap" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 提升建议 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                提升建议 Recommendations（Top 10）
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {skillStats.slice(0, 10).filter(s => s.gap > 0).map((skill, index) => (
                  <div key={skill.skillId} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{index + 1}. {skill.skillName}</p>
                        <p className="text-xs text-gray-500 mt-1">{skill.moduleName}</p>
                      </div>
                      <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded">
                        Gap: {skill.gap}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <span>现状 L{skill.current}</span>
                      <span>→</span>
                      <span>目标 L{skill.target}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">请选择工程师查看详细能力画像</p>
        </div>
      )}
    </div>
  );
}
