import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAllAssessments, getAssessmentMatrix } from '../lib/competencyApi';
import { TeamGapAnalysis } from '../components/competency/TeamGapAnalysis';
import { TotalScoreView } from '../components/competency/TotalScoreView';
import { PersonalGapAnalysis } from '../components/competency/PersonalGapAnalysis';
import { getAssessmentYears } from '../lib/dashboardData';
import { Award, Download, Filter, RefreshCw, Target, TrendingUp, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  calculateTeamModuleStats,
  calculateTeamSkillStats,
  calculatePersonalModuleStats,
  calculatePersonalSkillStats,
  calculateEmployeeModuleGapSummary,
  formatNumber,
  type ModuleStats,
  type PersonalModuleStats,
  type PersonalSkillStats,
  type EmployeeModuleGapMatrix,
} from '../lib/competencyAggregation';

type ViewMode = 'team' | 'personal';
type SubViewMode = 'analysis' | 'total-score';
type ChartType = 'module' | 'skill';
type EmployeeOption = {
  id: string;
  name: string;
  departments: { name: string | null } | null;
};

export function Competency() {
  const [viewMode, setViewMode] = useState<ViewMode>('team');
  const [subViewMode, setSubViewMode] = useState<SubViewMode>('analysis');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('module');

  // 获取数据（SQL Server via FastAPI）
  const { data: allAssessments = [], isLoading, refetch } = useQuery({
    queryKey: ['competency-assessments'],
    queryFn: () => getAllAssessments(),
  });
  const { data: assessmentMatrix } = useQuery({
    queryKey: ['competency-assessment-matrix'],
    queryFn: getAssessmentMatrix,
  });

  const assessmentYears = useMemo(() => getAssessmentYears(allAssessments), [allAssessments]);
  const effectiveYear = assessmentYears.includes(selectedYear)
    ? selectedYear
    : assessmentYears[0] || selectedYear;

  // 按年份过滤
  const assessments = useMemo(
    () => allAssessments.filter(a => a.assessment_year === effectiveYear),
    [allAssessments, effectiveYear]
  );

  // 完整矩阵包含所有启用技能，包括所选年度暂无评估的技能。
  const skills = useMemo(() => {
    const skillMap = new Map<number, {
      id: number; module_id: number; module_name: string;
      skill_name: string; skill_code: string | null;
      description: string | null; display_order: number;
      is_active: boolean; created_at: string; updated_at: string;
    }>();
    if (assessmentMatrix) {
      assessmentMatrix.columns.forEach((column) => {
        skillMap.set(column.skillId, {
          id: column.skillId,
          module_id: column.moduleId,
          module_name: column.moduleName,
          skill_name: column.skillName,
          skill_code: null,
          description: null,
          display_order: column.displayOrder,
          is_active: true,
          created_at: '',
          updated_at: '',
        });
      });
    } else allAssessments.forEach(a => {
      if (!skillMap.has(a.skill_id)) {
        skillMap.set(a.skill_id, {
          id: a.skill_id,
          module_id: a.module_id,
          module_name: a.module_name,
          skill_name: a.skill_name,
          skill_code: null,
          description: null,
          display_order: a.display_order,
          is_active: true,
          created_at: '',
          updated_at: '',
        });
      }
    });
    return Array.from(skillMap.values());
  }, [allAssessments, assessmentMatrix]);

  // 完整矩阵包含所有在职工程师，包括所选年度暂无评估的工程师。
  const employees = useMemo(() => {
    const empMap = new Map<string, { id: string; name: string; departments: { name: string | null } | null }>();
    if (assessmentMatrix) {
      assessmentMatrix.rows.forEach((row) => {
        empMap.set(row.employeeId, {
          id: row.employeeId,
          name: row.employeeName,
          departments: row.departmentName ? { name: row.departmentName } : null,
        });
      });
    } else allAssessments.forEach(a => {
      if (!empMap.has(a.employee_id)) {
        empMap.set(a.employee_id, {
          id: a.employee_id,
          name: a.employee_name,
          departments: a.department_name ? { name: a.department_name } : null,
        });
      }
    });
    return Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allAssessments, assessmentMatrix]);

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

  const employeeModuleGapMatrix = useMemo(
    () => calculateEmployeeModuleGapSummary(
      assessments,
      skills,
      employees.map((employee) => ({
        employeeId: employee.id,
        employeeName: employee.name,
        departmentName: employee.departments?.name ?? null,
      })),
    ),
    [assessments, employees, skills]
  );

  // 统计卡片数据
  const statistics = useMemo(() => {
    const currentValues = assessments.map(a => a.current_level);
    const targetValues = assessments.map(a => a.target_level);
    const totalGap = assessments.reduce((sum, a) => sum + a.gap, 0);
    const avgCurrent = currentValues.length > 0
      ? currentValues.reduce((sum, level) => sum + level, 0) / currentValues.length
      : 0;
    const avgTarget = targetValues.length > 0
      ? targetValues.reduce((sum, level) => sum + level, 0) / targetValues.length
      : 0;
    const gapCount = assessments.filter(a => a.gap > 0).length;

    return {
      employeeCount: employees.length,
      skillCount: skills.length,
      avgCurrent: formatNumber(avgCurrent),
      avgTarget: formatNumber(avgTarget),
      totalGap: formatNumber(totalGap),
      gapCount,
    };
  }, [assessments, employees.length, skills.length]);

  const formatOptionalLevelValue = (level: number) => String(level);

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
          formatOptionalLevelValue(s.current),
          formatOptionalLevelValue(s.target),
          s.gap,
        ]);

    const csvContent = '\ufeff' + [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `能力画像_${viewMode === 'team' ? '团队' : '个人'}_${effectiveYear}.csv`;
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
                  value={effectiveYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-sm font-medium text-gray-900 focus:outline-none"
                >
                  {(assessmentYears.length > 0 ? assessmentYears : [effectiveYear]).map(year => (
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
          <CompetencyTeamView
            subViewMode={subViewMode}
            setSubViewMode={setSubViewMode}
            year={effectiveYear}
            assessments={assessments}
            skills={skills}
            employees={employees.map((employee) => ({
              employeeId: employee.id,
              employeeName: employee.name,
              departmentName: employee.departments?.name ?? null,
            }))}
            moduleStats={teamModuleStats}
            skillStats={teamSkillStats}
            summary={employeeModuleGapMatrix}
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
            moduleStats={personalModuleStats}
            skillStats={personalSkillStats}
          />
        )}
      </div>
    </div>
  );
}

function CompetencyTeamView({
  subViewMode,
  setSubViewMode,
  year,
  assessments,
  skills,
  employees,
  moduleStats,
  skillStats,
  summary,
}: {
  subViewMode: SubViewMode;
  setSubViewMode: (mode: SubViewMode) => void;
  year: number;
  assessments: Parameters<typeof calculateEmployeeModuleGapSummary>[0];
  skills: Parameters<typeof calculateEmployeeModuleGapSummary>[1];
  employees: Parameters<typeof calculateEmployeeModuleGapSummary>[2];
  moduleStats: ModuleStats[];
  skillStats: ReturnType<typeof calculateTeamSkillStats>;
  summary: EmployeeModuleGapMatrix;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setSubViewMode('analysis')} className={cn('px-4 py-2 rounded-lg font-medium border', subViewMode === 'analysis' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-gray-200')}>
          差距分析 Gap Analysis
        </button>
        <button type="button" onClick={() => setSubViewMode('total-score')} className={cn('px-4 py-2 rounded-lg font-medium border', subViewMode === 'total-score' ? 'text-blue-600 border-blue-600' : 'text-gray-600 border-gray-200')}>
          总分视图 Total Score
        </button>
      </div>
      {subViewMode === 'analysis' ? (
        <TeamGapAnalysis
          year={year}
          assessments={assessments}
          skills={skills}
          employees={employees ?? []}
          moduleStats={moduleStats}
          skillStats={skillStats}
          summary={summary}
        />
      ) : (
        <TotalScoreView moduleStats={moduleStats} />
      )}
    </div>
  );
}

function PersonalView({
  chartType,
  setChartType,
  employees,
  selectedEmployee,
  setSelectedEmployee,
  moduleStats,
  skillStats,
}: {
  subViewMode: SubViewMode;
  setSubViewMode: (mode: SubViewMode) => void;
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  employees: EmployeeOption[];
  selectedEmployee: string | null;
  setSelectedEmployee: (id: string | null) => void;
  moduleStats: PersonalModuleStats[];
  skillStats: PersonalSkillStats[];
}) {
  const selectedEmployeeInfo = employees.find((employee) => employee.id === selectedEmployee);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <label htmlFor="competency-employee" className="text-sm font-medium text-gray-700">选择工程师：</label>
          <select
            id="competency-employee"
            value={selectedEmployee || ''}
            onChange={(event) => setSelectedEmployee(event.target.value || null)}
            className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">请选择...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} - {employee.departments?.name || '无部门'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedEmployee && selectedEmployeeInfo ? (
        <PersonalGapAnalysis
          employeeName={selectedEmployeeInfo.name}
          chartType={chartType}
          setChartType={setChartType}
          moduleStats={moduleStats}
          skillStats={skillStats}
        />
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">请选择工程师查看详细能力画像</p>
        </div>
      )}
    </div>
  );
}
