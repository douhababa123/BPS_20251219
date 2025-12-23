import { useState, useEffect } from 'react';
import { TrendingUp, Target, Award, AlertTriangle, ChevronDown, ChevronUp, Download, Filter, Maximize2, Minimize2, Wrench, TrendingDown, BarChart3, Users2, Lightbulb, FileText, Database, Zap, Gauge, Loader2, RefreshCw, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import type { CompetencyAssessmentRecord, CompetencySummary, LevelDescription } from '../lib/types';
import { supabaseService, type CompetencyAssessment } from '../lib/supabaseService';

// 能力级别定义
const levelDescriptions: LevelDescription[] = [
  { level: 1, name: 'Know it', description: '了解概念，知道基础理论' },
  { level: 2, name: 'Do it', description: '能够执行，独立完成任务' },
  { level: 3, name: 'Lead it', description: '能够领导，指导他人工作' },
  { level: 4, name: 'Shape it', description: '能够塑造，优化和创新流程' },
  { level: 5, name: 'Master', description: '大师级别，行业标杆水平' },
];

// 将Supabase数据转换为本地类型
function convertToLocalFormat(assessment: CompetencyAssessment): CompetencyAssessmentRecord {
  return {
    id: assessment.id,
    department: assessment.department,
    name: assessment.engineer_name,
    module: assessment.module_name,
    competencyType: assessment.competency_type,
    currentScore: assessment.current_score as 1 | 2 | 3 | 4 | 5,
    targetScore: assessment.target_score as 1 | 2 | 3 | 4 | 5,
    gap: assessment.gap,
    year: assessment.assessment_year,
  };
}

export function CompetencyAssessment() {
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [summaryData, setSummaryData] = useState<CompetencySummary[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [expandAll, setExpandAll] = useState<boolean>(false);
  const [assessments, setAssessments] = useState<CompetencyAssessmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从Supabase加载数据
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await supabaseService.getAllCompetencyAssessments();
      const converted = data.map(convertToLocalFormat);
      setAssessments(converted);
    } catch (err) {
      console.error('Failed to load assessments:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 首次加载
  useEffect(() => {
    loadData();
  }, []);

  // 计算汇总数据
  useEffect(() => {
    if (assessments.length === 0) {
      setSummaryData([]);
      return;
    }

    // 计算汇总数据
    const peopleMap = new Map<string, CompetencyAssessmentRecord[]>();
    assessments.forEach(assessment => {
      const key = assessment.name;
      if (!peopleMap.has(key)) {
        peopleMap.set(key, []);
      }
      peopleMap.get(key)!.push(assessment);
    });

    const summaries: CompetencySummary[] = [];
    peopleMap.forEach((assessments, name) => {
      const dept = assessments[0].department;
      const moduleMap = new Map<string, CompetencyAssessmentRecord[]>();
      
      assessments.forEach(a => {
        if (!moduleMap.has(a.module)) {
          moduleMap.set(a.module, []);
        }
        moduleMap.get(a.module)!.push(a);
      });

      const moduleDetails = Array.from(moduleMap.entries()).map(([module, items]) => {
        const avgCurrent = items.reduce((sum, i) => sum + i.currentScore, 0) / items.length;
        const avgTarget = items.reduce((sum, i) => sum + i.targetScore, 0) / items.length;
        return {
          module,
          itemCount: items.length,
          avgCurrent: Math.round(avgCurrent * 10) / 10,
          avgTarget: Math.round(avgTarget * 10) / 10,
          avgGap: Math.round((avgTarget - avgCurrent) * 10) / 10,
        };
      });

      const totalCurrent = assessments.reduce((sum, a) => sum + a.currentScore, 0) / assessments.length;
      const totalTarget = assessments.reduce((sum, a) => sum + a.targetScore, 0) / assessments.length;

      summaries.push({
        name,
        department: dept,
        totalModules: moduleMap.size,
        averageCurrentScore: Math.round(totalCurrent * 10) / 10,
        averageTargetScore: Math.round(totalTarget * 10) / 10,
        averageGap: Math.round((totalTarget - totalCurrent) * 10) / 10,
        moduleDetails,
      });
    });

    setSummaryData(summaries);
  }, [assessments]);

  const toggleCardExpansion = (name: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedCards(newExpanded);
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      // 全部收起
      setExpandedCards(new Set());
      setExpandAll(false);
    } else {
      // 全部展开
      const allNames = new Set(filterData().map(s => s.name));
      setExpandedCards(allNames);
      setExpandAll(true);
    }
  };

  const getGapColor = (gap: number) => {
    if (gap === 0) return 'text-green-600 bg-green-100';
    if (gap === 1) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const getLevelIcon = (level: number) => {
    if (level >= 4) return '🏆';
    if (level >= 3) return '⭐';
    if (level >= 2) return '📚';
    return '🎯';
  };

  // 根据能力模块返回对应的图标和颜色
  const getModuleIcon = (module: string) => {
    const iconMap: Record<string, { icon: any; color: string; bgColor: string }> = {
      'TPM基础': { icon: Wrench, color: 'text-blue-600', bgColor: 'bg-blue-100' },
      '精益流程': { icon: TrendingDown, color: 'text-green-600', bgColor: 'bg-green-100' },
      '问题解决': { icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-100' },
      '项目管理': { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100' },
      '数据分析': { icon: BarChart3, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
      '团队领导': { icon: Users2, color: 'text-pink-600', bgColor: 'bg-pink-100' },
      '质量管理': { icon: Target, color: 'text-red-600', bgColor: 'bg-red-100' },
      '设备管理': { icon: Database, color: 'text-teal-600', bgColor: 'bg-teal-100' },
      '流程优化': { icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    };
    return iconMap[module] || { icon: Gauge, color: 'text-gray-600', bgColor: 'bg-gray-100' };
  };

  const filterData = () => {
    let filtered = summaryData;
    if (selectedPerson) {
      filtered = filtered.filter(s => s.name === selectedPerson);
    }
    return filtered;
  };

  const exportToCSV = () => {
    const headers = ['部门', '姓名', '能力模块', '能力类型', '现状得分', '目标得分', '差距', '年度'];
    const rows = assessments.map(a => [
      a.department,
      a.name,
      a.module,
      a.competencyType,
      a.currentScore,
      a.targetScore,
      a.gap,
      a.year
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' }); // 添加BOM以支持中文
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competency-assessment-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
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
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>
        </div>
      </div>
    );
  }

  // 无数据状态
  if (assessments.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="text-center py-12">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">暂无数据</h3>
          <p className="text-gray-600 mb-6">请先导入能力评估数据</p>
          <a
            href="#/import"
            className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            前往导入数据
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和控制栏 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">能力评估看板 Competency Assessment Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">查看和分析工程师能力水平与发展目标 View and analyze engineer competency levels</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="刷新数据"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
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
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出数据
            </button>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('card')}
                className={cn(
                  'px-3 py-1 rounded text-sm font-medium transition-colors',
                  viewMode === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                卡片视图
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'px-3 py-1 rounded text-sm font-medium transition-colors',
                  viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                表格视图
              </button>
            </div>
          </div>
        </div>

        {/* 筛选器 */}
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
            <option value="all">所有人员 All</option>
            {summaryData.map(s => (
              <option key={s.name} value={s.name}>{s.name} - {s.department}</option>
            ))}
          </select>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有模块 All Modules</option>
            <option value="TPM基础">TPM基础</option>
            <option value="精益流程">精益流程</option>
            <option value="问题解决">问题解决</option>
            <option value="项目管理">项目管理</option>
            <option value="数据分析">数据分析</option>
          </select>
        </div>
      </div>

      {/* 能力级别说明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">能力级别体系 Competency Level System</h3>
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

      {/* 卡片视图 */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filterData().map((summary) => {
            const isExpanded = expandedCards.has(summary.name);
            const personAssessments = assessments.filter(a => 
              a.name === summary.name && 
              (selectedModule === 'all' || a.module === selectedModule)
            );

            return (
              <div key={summary.name} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                {/* 卡片头部 */}
                <div className="p-5 bg-gradient-to-r from-gray-50 to-blue-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{summary.name}</h3>
                      <p className="text-xs text-gray-600 truncate">{summary.department}</p>
                    </div>
                    <button
                      onClick={() => toggleCardExpansion(summary.name)}
                      className="p-1.5 hover:bg-white rounded-lg transition-colors flex-shrink-0 ml-2"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* 关键指标 - 更紧凑的布局 */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-600 mb-0.5">当前 Current</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-blue-600">{summary.averageCurrentScore}</span>
                        <span className="text-xs text-gray-500">/5</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-600 mb-0.5">目标 Target</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-green-600">{summary.averageTargetScore}</span>
                        <span className="text-xs text-gray-500">/5</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5">
                      <p className="text-[10px] text-gray-600 mb-0.5">差距 Gap</p>
                      <div className="flex items-baseline gap-1">
                        <span className={cn(
                          'text-xl font-bold',
                          summary.averageGap > 1.5 ? 'text-red-600' : summary.averageGap > 0.5 ? 'text-amber-600' : 'text-green-600'
                        )}>
                          {summary.averageGap}
                        </span>
                        <TrendingUp className={cn(
                          'w-3.5 h-3.5',
                          summary.averageGap > 1.5 ? 'text-red-500' : summary.averageGap > 0.5 ? 'text-amber-500' : 'text-green-500'
                        )} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 模块汇总 - 带图标和进度条 */}
                <div className="p-4">
                  <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                    模块能力分布 Module Distribution
                  </h4>
                  <div className="space-y-3">
                    {summary.moduleDetails.map((module) => {
                      const moduleIcon = getModuleIcon(module.module);
                      const IconComponent = moduleIcon.icon;
                      const gapPercentage = (module.avgGap / 5) * 100;
                      const currentPercentage = (module.avgCurrent / 5) * 100;
                      const targetPercentage = (module.avgTarget / 5) * 100;
                      
                      return (
                        <div key={module.module} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={cn('p-1 rounded', moduleIcon.bgColor)}>
                                <IconComponent className={cn('w-3 h-3', moduleIcon.color)} />
                              </div>
                              <span className="text-xs text-gray-700 font-medium truncate">{module.module}</span>
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
                            {/* 当前水平 */}
                            <div 
                              className="absolute top-0 left-0 h-full bg-blue-400 rounded-full transition-all"
                              style={{ width: `${currentPercentage}%` }}
                            />
                            {/* 目标水平 */}
                            <div 
                              className="absolute top-0 left-0 h-full bg-green-500 opacity-30 rounded-full transition-all"
                              style={{ width: `${targetPercentage}%` }}
                            />
                            {/* Gap区域 */}
                            <div 
                              className={cn(
                                'absolute top-0 h-full rounded-full transition-all',
                                module.avgGap > 1.5 ? 'bg-red-300' : module.avgGap > 0.5 ? 'bg-amber-300' : 'bg-green-300'
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
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">能力项详情 Competency Details</h4>
                    <div className="space-y-2">
                      {personAssessments.map((assessment) => (
                        <div key={assessment.id} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{assessment.competencyType}</p>
                              <p className="text-xs text-gray-500">{assessment.module}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-xs text-gray-600">现状</p>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((level) => (
                                    <div
                                      key={level}
                                      className={cn(
                                        'w-2 h-8 rounded',
                                        level <= assessment.currentScore ? 'bg-blue-500' : 'bg-gray-200'
                                      )}
                                    />
                                  ))}
                                </div>
                                <p className="text-xs font-medium text-gray-900 mt-1">L{assessment.currentScore}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-600">目标</p>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((level) => (
                                    <div
                                      key={level}
                                      className={cn(
                                        'w-2 h-8 rounded',
                                        level <= assessment.targetScore ? 'bg-green-500' : 'bg-gray-200'
                                      )}
                                    />
                                  ))}
                                </div>
                                <p className="text-xs font-medium text-gray-900 mt-1">L{assessment.targetScore}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-600">差距</p>
                                <span className={cn(
                                  'inline-block px-3 py-1 rounded-full text-sm font-medium',
                                  getGapColor(assessment.gap || 0)
                                )}>
                                  {assessment.gap}
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
                {assessments
                  .filter(a => !selectedPerson || a.name === selectedPerson)
                  .filter(a => selectedModule === 'all' || a.module === selectedModule)
                  .map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{assessment.department}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{assessment.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{assessment.module}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{assessment.competencyType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                          L{assessment.currentScore}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-2 py-1 text-sm bg-green-100 text-green-700 rounded">
                          L{assessment.targetScore}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={cn(
                          'px-2 py-1 text-sm rounded',
                          getGapColor(assessment.gap || 0)
                        )}>
                          {assessment.gap}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        {assessment.year}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 统计摘要 */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <Award className="w-10 h-10 text-blue-600" />
            <span className="text-xs text-gray-500">Overall</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {summaryData.length > 0 ? Math.round(summaryData.reduce((sum, s) => sum + s.averageCurrentScore, 0) / summaryData.length * 10) / 10 : 0}
          </p>
          <p className="text-sm text-gray-600 mt-1">平均当前水平</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-10 h-10 text-green-600" />
            <span className="text-xs text-gray-500">Target</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {summaryData.length > 0 ? Math.round(summaryData.reduce((sum, s) => sum + s.averageTargetScore, 0) / summaryData.length * 10) / 10 : 0}
          </p>
          <p className="text-sm text-gray-600 mt-1">平均目标水平</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-10 h-10 text-amber-600" />
            <span className="text-xs text-gray-500">Gap</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {summaryData.length > 0 ? Math.round(summaryData.reduce((sum, s) => sum + s.averageGap, 0) / summaryData.length * 10) / 10 : 0}
          </p>
          <p className="text-sm text-gray-600 mt-1">平均能力差距</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-10 h-10 text-red-600" />
            <span className="text-xs text-gray-500">Critical</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {assessments.filter(a => (a.gap || 0) >= 2).length}
          </p>
          <p className="text-sm text-gray-600 mt-1">需重点提升项</p>
        </div>
      </div>
    </div>
  );
}
