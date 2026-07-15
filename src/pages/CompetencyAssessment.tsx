import { useState, useEffect } from 'react';
import { 
  Loader2, AlertTriangle, Database, RefreshCw, 
  LayoutGrid, Table, Grid3x3, ChevronDown, ChevronUp,
  Download, Filter, Maximize2, Minimize2, TrendingUp,
  Target, Award, Users2, BarChart3, Wrench, TrendingDown,
  Lightbulb, Zap, Gauge
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  averageAssessmentValues,
  getAssessmentMatrix,
  getAllAssessments,
  saveAssessment,
} from '../lib/competencyApi';
import MatrixView from '../components/MatrixView';
import { cn } from '../lib/utils';
import type {
  AssessmentFull,
  AssessmentSaveInput,
  AssessmentStats,
  MatrixColumn,
  MatrixFilters,
  MatrixRow,
} from '../lib/database.types';

// 能力级别定义
const levelDescriptions = [
  { level: 0, name: 'Starting point', description: '当前尚未具备该项能力' },
  { level: 1, name: 'Know it', description: '了解概念，知道基础理论' },
  { level: 2, name: 'Do it', description: '能够执行，独立完成任务' },
  { level: 3, name: 'Lead it', description: '能够领导，指导他人工作' },
  { level: 4, name: 'Shape it', description: '能够塑造，优化和创新流程' },
];

// 汇总数据类型
interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  departmentName: string;
  totalSkills: number;
  avgCurrent: number;
  avgTarget: number;
  avgGap: number;
  moduleDetails: Array<{
    moduleName: string;
    moduleId: number;
    avgCurrent: number;
    avgTarget: number;
    avgGap: number;
    itemCount: number;
  }>;
}

export function CompetencyAssessment() {
  const [viewMode, setViewMode] = useState<'matrix' | 'card' | 'table'>('matrix');
  const [matrixData, setMatrixData] = useState<{
    rows: MatrixRow[];
    columns: MatrixColumn[];
    stats: AssessmentStats;
  } | null>(null);
  const [assessments, setAssessments] = useState<AssessmentFull[]>([]);
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 卡片视图状态
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  // 加载数据
  const loadData = async (filters?: MatrixFilters) => {
    console.log('📥 CompetencyAssessment: 开始加载数据', filters);
    setIsLoading(true);
    setError(null);
    try {
      // 只加载一次评估数据，避免重复调用
      console.log('  🔄 加载评估数据...');
      const [assessmentData, matrix] = await Promise.all([
        getAllAssessments(),
        getAssessmentMatrix(),
      ]);
      console.log(`  ✅ 获取 ${assessmentData.length} 条评估数据`);
      console.log(`  ✅ 矩阵构建完成`);
      
      console.log('✅ CompetencyAssessment: 数据加载成功', {
        employees: new Set(assessmentData.map(a => a.employee_id)).size,
        skills: new Set(assessmentData.map(a => a.skill_id)).size,
        assessments: assessmentData.length,
      });
      
      setMatrixData(matrix);
      setAssessments(assessmentData);
      
      // 计算汇总数据
      calculateSummaries(assessmentData);
    } catch (err) {
      console.error('❌ CompetencyAssessment: 数据加载失败:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 计算员工汇总数据
  const calculateSummaries = (data: AssessmentFull[]) => {
    const averageGap = (items: AssessmentFull[]) => {
      return averageAssessmentValues(items.map(item => item.gap));
    };
    const employeeMap = new Map<string, AssessmentFull[]>();
    
    data.forEach(assessment => {
      const key = assessment.employee_id;
      if (!employeeMap.has(key)) {
        employeeMap.set(key, []);
      }
      employeeMap.get(key)!.push(assessment);
    });

    const summaryList: EmployeeSummary[] = [];
    
    employeeMap.forEach((assessments, employeeId) => {
      const first = assessments[0];
      const moduleMap = new Map<number, AssessmentFull[]>();
      
      assessments.forEach(a => {
        if (!moduleMap.has(a.module_id)) {
          moduleMap.set(a.module_id, []);
        }
        moduleMap.get(a.module_id)!.push(a);
      });

      const moduleDetails = Array.from(moduleMap.entries()).map(([moduleId, items]) => {
        const avgCurrent = averageAssessmentValues(items.map(i => i.current_level));
        const avgTarget = averageAssessmentValues(items.map(i => i.target_level));
        const avgGap = averageGap(items);
        return {
          moduleName: items[0].module_name,
          moduleId,
          avgCurrent: Math.round(avgCurrent * 10) / 10,
          avgTarget: Math.round(avgTarget * 10) / 10,
          avgGap: Math.round(avgGap * 10) / 10,
          itemCount: items.length,
        };
      });

      const avgCurrent = averageAssessmentValues(assessments.map(a => a.current_level));
      const avgTarget = averageAssessmentValues(assessments.map(a => a.target_level));
      const avgGap = averageGap(assessments);

      summaryList.push({
        employeeId,
        employeeName: first.employee_name,
        departmentName: first.department_name || '未分配',
        totalSkills: assessments.length,
        avgCurrent: Math.round(avgCurrent * 10) / 10,
        avgTarget: Math.round(avgTarget * 10) / 10,
        avgGap: Math.round(avgGap * 10) / 10,
        moduleDetails,
      });
    });

    setSummaries(summaryList);
  };

  // 首次加载
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveAssessment = async (
    employeeId: string,
    skillId: number,
    input: AssessmentSaveInput,
  ) => {
    await saveAssessment(employeeId, skillId, input);
    await loadData();
  };

  // 卡片展开/收起
  const toggleCardExpansion = (employeeId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedCards(newExpanded);
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedCards(new Set());
      setExpandAll(false);
    } else {
      const allIds = new Set(filterSummaries().map(s => s.employeeId));
      setExpandedCards(allIds);
      setExpandAll(true);
    }
  };

  // 筛选数据
  const filterSummaries = () => {
    let filtered = summaries;
    if (selectedPerson) {
      filtered = filtered.filter(s => s.employeeName === selectedPerson);
    }
    return filtered;
  };

  const filterAssessments = () => {
    return assessments.filter(a => 
      (!selectedPerson || a.employee_name === selectedPerson) &&
      (selectedModule === 'all' || a.module_name === selectedModule)
    );
  };

  // 辅助函数
  const getGapColor = (gap: number) => {
    if (gap === 0) return 'text-green-600 bg-green-100';
    return 'text-red-600 bg-red-100';
  };

  const formatLevel = (level: number) => Number.isFinite(level) ? `L${level}` : '-';
  const formatLevelValue = (level: number) => Number.isFinite(level) ? String(level) : '-';
  const isIncompleteAssessment = (assessment: AssessmentFull) =>
    !Number.isFinite(assessment.current_level) || !Number.isFinite(assessment.target_level);

  const getLevelIcon = (level: number) => {
    if (level >= 4) return '🏆';
    if (level >= 3) return '⭐';
    if (level >= 2) return '📚';
    return '🎯';
  };

  const getModuleIcon = (module: string) => {
    const iconMap: Record<string, { icon: LucideIcon; color: string; bgColor: string }> = {
      'TPM基础': { icon: Wrench, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      'BPS elements': { icon: Target, color: 'text-purple-600', bgColor: 'bg-purple-100' },
      'Investment efficiency_PGL': { icon: BarChart3, color: 'text-green-600', bgColor: 'bg-green-100' },
      'Waste-free, stable flow_IE': { icon: TrendingUp, color: 'text-teal-600', bgColor: 'bg-teal-100' },
      'Waste-free, stable flow_TPM': { icon: Wrench, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      'Waste-free, stable flow_LBP': { icon: TrendingDown, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
      "Everybody's CIP": { icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-100' },
      'Leadership commitment': { icon: Users2, color: 'text-pink-600', bgColor: 'bg-pink-100' },
      'CIP in indirect area_LEAN': { icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-100' },
      'Digital Transformation': { icon: Database, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
    };
    return iconMap[module] || { icon: Gauge, color: 'text-gray-600', bgColor: 'bg-gray-100' };
  };

  const exportToCSV = () => {
    const headers = ['部门', '姓名', '能力模块', '能力类型', '现状得分', '目标得分', '差距', '年度'];
    const rows = assessments.map(a => [
      a.department_name || '',
      a.employee_name,
      a.module_name,
      a.skill_name,
      formatLevelValue(a.current_level),
      formatLevelValue(a.target_level),
      isIncompleteAssessment(a) ? '-' : a.gap,
      a.assessment_year
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competency-assessment-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在加载能力评估数据...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-center flex-col space-y-4">
              <AlertTriangle className="w-16 h-16 text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900">加载失败</h2>
              <p className="text-gray-600">{error}</p>
              <button
                onClick={() => loadData()}
                className="mt-4 flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>重试</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 无数据状态
  if (assessments.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-center flex-col space-y-4">
              <Database className="w-16 h-16 text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-900">暂无数据</h2>
              <p className="text-gray-600">请先导入能力评估数据</p>
              <a
                href="/import"
                className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                前往导入
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 主渲染
  return (
    // 完全全屏布局，无任何padding
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="w-full space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">能力评估总览</h1>
              <p className="text-gray-600 mt-1">查看和分析团队能力评估数据</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => loadData()}
                disabled={isLoading}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                <span>刷新</span>
              </button>
              
              {viewMode === 'card' && (
                <button
                  onClick={toggleExpandAll}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {expandAll ? (
                    <>
                      <Minimize2 className="w-4 h-4" />
                      收起全部
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      展开全部
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={exportToCSV}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>导出</span>
              </button>
              
              {/* 视图切换 */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('matrix')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors',
                    viewMode === 'matrix' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                  title="总览视图（矩阵）"
                >
                  <Grid3x3 className="w-4 h-4" />
                  总览
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors',
                    viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                  title="卡片视图"
                >
                  <LayoutGrid className="w-4 h-4" />
                  卡片
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors',
                    viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                  title="表格视图"
                >
                  <Table className="w-4 h-4" />
                  表格
                </button>
              </div>
            </div>
          </div>

          {/* 筛选器（卡片和表格视图） */}
          {(viewMode === 'card' || viewMode === 'table') && (
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">筛选：</span>
              </div>
              <select
                value={selectedPerson || 'all'}
                onChange={(e) => setSelectedPerson(e.target.value === 'all' ? null : e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option key="all" value="all">所有人员</option>
                {summaries.map(s => (
                  <option key={s.employeeId} value={s.employeeName}>
                    {s.employeeName} - {s.departmentName}
                  </option>
                ))}
              </select>
              
              {/* 模块筛选 */}
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option key="all-modules" value="all">所有模块</option>
                {Array.from(new Set(assessments.map(a => a.module_name))).map(module => (
                  <option key={module} value={module}>{module}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 能力级别说明 */}
        {(viewMode === 'card' || viewMode === 'table') && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">能力级别体系</h3>
            <div className="grid grid-cols-5 gap-3">
              {levelDescriptions.map((level) => (
                <div key={level.level} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{getLevelIcon(level.level)}</span>
                    <span className="text-xl font-bold text-gray-800">L{level.level}</span>
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{level.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{level.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 视图内容 */}
        {viewMode === 'matrix' && matrixData && (
          <MatrixView
            rows={matrixData.rows}
            columns={matrixData.columns}
            stats={matrixData.stats}
            onSaveAssessment={handleSaveAssessment}
          />
        )}

        {/* 卡片视图 */}
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filterSummaries().map((summary) => {
              const isExpanded = expandedCards.has(summary.employeeId);
              const employeeAssessments = filterAssessments().filter(
                a => a.employee_name === summary.employeeName
              );

              return (
                <div key={summary.employeeId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  {/* 卡片头部 */}
                  <div className="p-5 bg-gradient-to-r from-gray-50 to-blue-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{summary.employeeName}</h3>
                        <p className="text-xs text-gray-600 truncate">{summary.departmentName}</p>
                      </div>
                      <button
                        onClick={() => toggleCardExpansion(summary.employeeId)}
                        className="p-1.5 hover:bg-white rounded-lg transition-colors flex-shrink-0 ml-2"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* 关键指标 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-600 mb-0.5">当前</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-blue-600">{summary.avgCurrent}</span>
                          <span className="text-xs text-gray-500">/4</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-600 mb-0.5">目标</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-green-600">{summary.avgTarget}</span>
                          <span className="text-xs text-gray-500">/4</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-2.5">
                        <p className="text-[10px] text-gray-600 mb-0.5">差距</p>
                        <div className="flex items-baseline gap-1">
                          <span className={cn(
                            'text-xl font-bold',
                            summary.avgGap > 0 ? 'text-red-600' : 'text-green-600'
                          )}>
                            {summary.avgGap}
                          </span>
                          <TrendingUp className={cn(
                            'w-3.5 h-3.5',
                            summary.avgGap > 0 ? 'text-red-500' : 'text-green-500'
                          )} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 模块汇总 */}
                  <div className="p-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5" />
                      模块能力分布
                    </h4>
                    <div className="space-y-3">
                      {summary.moduleDetails.map((module) => {
                        const moduleIcon = getModuleIcon(module.moduleName);
                        const IconComponent = moduleIcon.icon;
                        const gapPercentage = (module.avgGap / 4) * 100;
                        const currentPercentage = (module.avgCurrent / 4) * 100;
                        const targetPercentage = (module.avgTarget / 4) * 100;
                        
                        return (
                          <div key={module.moduleId} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={cn('p-1 rounded', moduleIcon.bgColor)}>
                                  <IconComponent className={cn('w-3 h-3', moduleIcon.color)} />
                                </div>
                                <span className="text-xs text-gray-700 font-medium truncate">{module.moduleName}</span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="font-medium text-blue-600">{module.avgCurrent}</span>
                                  <span className="text-gray-400">→</span>
                                  <span className="font-medium text-green-600">{module.avgTarget}</span>
                                </div>
                                <span className={cn(
                                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                  getGapColor(module.avgGap)
                                )}>
                                  {module.avgGap}
                                </span>
                              </div>
                            </div>
                            
                            {/* Gap进度条 */}
                            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="absolute top-0 left-0 h-full bg-blue-400 rounded-full transition-all"
                                style={{ width: `${currentPercentage}%` }}
                              />
                              <div 
                                className="absolute top-0 left-0 h-full bg-green-500 opacity-30 rounded-full transition-all"
                                style={{ width: `${targetPercentage}%` }}
                              />
                              <div 
                                className={cn(
                                  'absolute top-0 h-full rounded-full transition-all',
                                  module.avgGap > 0 ? 'bg-red-300' : 'bg-green-300'
                                )}
                                style={{ 
                                  left: `${currentPercentage}%`, 
                                  width: `${gapPercentage}%` 
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 展开的详细内容 */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">能力项详情</h4>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {employeeAssessments.map((assessment) => (
                          <div key={assessment.id} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{assessment.skill_name}</p>
                                <p className="text-xs text-gray-500">{assessment.module_name}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <p className="text-xs text-gray-600">现状</p>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4].map((level) => (
                                      <div
                                        key={level}
                                        className={cn(
                                          'w-2 h-8 rounded',
                                          assessment.current_level > 0 && level <= assessment.current_level ? 'bg-blue-500' : 'bg-gray-200'
                                        )}
                                      />
                                    ))}
                                  </div>
                                  <p className="text-xs font-medium text-gray-900 mt-1">{formatLevel(assessment.current_level)}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-600">目标</p>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4].map((level) => (
                                      <div
                                        key={level}
                                        className={cn(
                                          'w-2 h-8 rounded',
                                          assessment.target_level > 0 && level <= assessment.target_level ? 'bg-green-500' : 'bg-gray-200'
                                        )}
                                      />
                                    ))}
                                  </div>
                                  <p className="text-xs font-medium text-gray-900 mt-1">{formatLevel(assessment.target_level)}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-600">差距</p>
                                  <span className={cn(
                                    'inline-block px-3 py-1 rounded-full text-sm font-medium',
                                    isIncompleteAssessment(assessment) ? 'text-gray-600 bg-gray-100' : getGapColor(assessment.gap)
                                  )}>
                                    {isIncompleteAssessment(assessment) ? '-' : assessment.gap}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 表格视图 */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部门</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">能力模块</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">能力类型</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">现状</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">目标</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">差距</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">年度</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filterAssessments().map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.department_name || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{assessment.employee_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{assessment.module_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{assessment.skill_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                          {formatLevel(assessment.current_level)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-2 py-1 text-sm bg-green-100 text-green-700 rounded">
                          {formatLevel(assessment.target_level)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={cn(
                          'px-2 py-1 text-sm rounded',
                          isIncompleteAssessment(assessment) ? 'text-gray-600 bg-gray-100' : getGapColor(assessment.gap)
                        )}>
                          {isIncompleteAssessment(assessment) ? '-' : assessment.gap}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        {assessment.assessment_year}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 统计摘要 */}
        {(viewMode === 'card' || viewMode === 'table') && matrixData && (
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <Award className="w-10 h-10 text-blue-600" />
                <span className="text-xs text-gray-500">Current</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{matrixData.stats.avgCurrentLevel}</p>
              <p className="text-sm text-gray-600 mt-1">平均当前水平</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-10 h-10 text-green-600" />
                <span className="text-xs text-gray-500">Target</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{matrixData.stats.avgTargetLevel}</p>
              <p className="text-sm text-gray-600 mt-1">平均目标水平</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className={cn(
                  'w-10 h-10',
                  matrixData.stats.avgGap > 0 ? 'text-red-600' : 'text-green-600',
                )} />
                <span className="text-xs text-gray-500">Gap</span>
              </div>
              <p className={cn(
                'text-2xl font-bold',
                matrixData.stats.avgGap > 0 ? 'text-red-600' : 'text-green-600',
              )}>
                {matrixData.stats.avgGap}
              </p>
              <p className="text-sm text-gray-600 mt-1">平均能力差距</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-10 h-10 text-red-600" />
                <span className="text-xs text-gray-500">Critical</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {assessments.filter(a => a.gap >= 2).length}
              </p>
              <p className="text-sm text-gray-600 mt-1">需重点提升项</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
