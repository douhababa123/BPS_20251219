import { useState, useEffect, useMemo } from 'react';
import { Filter, Download, Loader2, Database, Maximize2, Minimize2 } from 'lucide-react';
import type { MatrixRow, MatrixColumn, MatrixFilters, AssessmentStats } from '../lib/database.types';
import { apiClient } from '../lib/api-client';

interface MatrixViewProps {
  rows: MatrixRow[];
  columns: MatrixColumn[];
  stats: AssessmentStats;
  isLoading?: boolean;
}

const formatLevel = (level: number): string => level > 0 ? String(level) : '-';
const hasIncompleteLevel = (currentLevel: number, targetLevel: number): boolean =>
  currentLevel <= 0 || targetLevel <= 0;

// 根据技能名称返回对应的图标（41个不同的图标）
const getSkillIcon = (skillName: string): string => {
  const iconMap: Record<string, string> = {
    // BPS elements
    'Leading in a BPS Plant': '🎯',
    'VSM/VSD': '📋',
    'SMC, Process confirmation, Visual management': '👁️',
    'WAS': '🔍',
    'Problem solving: 10KK/A3/PSS': '🧩',
    
    // Investment efficiency
    'Premises & Risk Assessment': '⚠️',
    'DFMA': '🔧',
    'LLD': '📐',
    'FOL': '📊',
    'Scaling': '📈',
    
    // IE
    'Workplace design(LCA & EAWS & Karakuri)': '🏭',
    'MTM-UAS & SD & MTM1': '⏱️',
    'MTM-LOG': '📦',
    'MTM-Inspection/Q': '🔬',
    
    // TPM
    'TPM program management': '⚙️',
    'Change management': '🔄',
    'Loss intelligence: Key Performance Indicators & Loss cost matrix & Loss Deployment (Levels 1, 2,3..)': '📉',
    'Loss eradication: 10KK, RBC, QAM... & AM team': '🎯',
    'Loss prevention: PCS(incl. DLR)': '🛡️',
    
    // LBP
    'Logistic index': '📍',
    'Pull & Levelling': '⚖️',
    'Package design(PFEP)': '📦',
    'Material supply(POUP, Milkrun AGV)': '🚚',
    'Ship to line': '🚢',
    
    // Everybody's CIP
    'Top idea': '💡',
    'Give me 5': '🖐️',
    'Speed week/ Kaizen week': '⚡',
    'BLI(BPS Leading improvement)': '🌟',
    'Kyoben/Jishuken (Project)': '🎓',
    
    // Leadership commitment
    'BMT(Moderator/coach)': '👨‍🏫',
    'BPS Basic': '📘',
    'BPS maturity assessment': '📊',
    'A2_Customer interview': '🎤',
    'B1_Employee capacity & B2_VSDiA': '👥',
    'C1_Meeting cascade & C2_WILO': '📢',
    'D3_Skill Matrix': '📋',
    
    // LEAN
    'Lean Leadership system': '🎖️',
    
    // Digital Transformation
    'Business analysis and spec. preparation of digital product': '📊',
    
    // 其他
    '设备管理': '🔧',
  };
  return iconMap[skillName] || '📌';
};

export default function MatrixView({ rows, columns, stats, isLoading = false }: MatrixViewProps) {
  const [filters] = useState<MatrixFilters>({
    year: new Date().getFullYear(),
  });
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<number[]>([]);
  const [allModules, setAllModules] = useState<Array<{ module_id: number; module_name: string }>>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // 获取所有模块（包括没有评估数据的模块）
  useEffect(() => {
    const fetchAllModules = async () => {
      try {
        const response = await apiClient.get<Array<{ module_id: number; module_name: string }>>('/skills/modules');
        setAllModules(response.data);
        console.log('✅ 获取所有模块:', response.data.length);
      } catch (err) {
        console.error('❌ 获取模块列表失败:', err);
        // 如果API调用失败，回退到从columns提取
        const mods = new Map<number, string>();
        columns.forEach(col => {
          if (!mods.has(col.moduleId)) {
            mods.set(col.moduleId, col.moduleName);
          }
        });
        setAllModules(Array.from(mods.entries()).map(([module_id, module_name]) => ({ module_id, module_name })));
      }
    };
    fetchAllModules();
  }, [columns]);

  // 提取唯一的部门和模块列表
  const departments = useMemo(() => {
    const depts = new Set(rows.map(r => r.departmentName).filter(Boolean));
    return Array.from(depts).sort();
  }, [rows]);

  const modules = useMemo(() => {
    // 使用从API获取的所有模块，如果未获取到则从columns提取
    if (allModules.length > 0) {
      return allModules.map(m => [m.module_id, m.module_name] as [number, string]).sort((a, b) => a[0] - b[0]);
    }
    const mods = new Map<number, string>();
    columns.forEach(col => {
      if (!mods.has(col.moduleId)) {
        mods.set(col.moduleId, col.moduleName);
      }
    });
    return Array.from(mods.entries()).sort((a, b) => a[0] - b[0]);
  }, [allModules, columns]);

  // 应用筛选
  const filteredRows = useMemo(() => {
    let filtered = rows;

    if (selectedDepartments.length > 0) {
      filtered = filtered.filter(row => 
        row.departmentName && selectedDepartments.includes(row.departmentName)
      );
    }

    return filtered;
  }, [rows, selectedDepartments]);

  const filteredColumns = useMemo(() => {
    if (selectedModules.length === 0) return columns;
    
    return columns.filter(col => selectedModules.includes(col.moduleId));
  }, [columns, selectedModules]);

  const matrixTableMinWidth = `${240 + filteredColumns.length * 88}px`;

  // 导出CSV
  const handleExport = () => {
    const BOM = '\ufeff';
    const headers = ['部门', '姓名', ...filteredColumns.map(col => col.skillName)];
    const csvRows = [headers.join(',')];

    filteredRows.forEach(row => {
      const rowData = [
        row.departmentName || '',
        row.employeeName,
        ...filteredColumns.map(col => {
          const skill = row.skills[col.skillId];
          return skill ? `${formatLevel(skill.currentLevel)}/${formatLevel(skill.targetLevel)}` : '';
        }),
      ];
      csvRows.push(rowData.join(','));
    });

    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `能力矩阵_${filters.year}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600">加载矩阵数据...</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <Database className="w-16 h-16 mb-4 text-gray-400" />
        <p className="text-lg font-medium">暂无评估数据</p>
        <p className="text-sm mt-2">请先导入能力评估数据</p>
      </div>
    );
  }

  return (
    <div
      data-testid="matrix-view-root"
      className={
        isFullscreen
          ? 'fixed inset-0 z-[100] flex flex-col gap-3 overflow-hidden bg-gray-50 p-3'
          : 'space-y-3'
      }
    >
      {/* 统计卡片 */}
      {!isFullscreen && (
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-600 text-sm font-medium">员工总数</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{filteredRows.length}</div>
            </div>
            <div className="text-3xl">👥</div>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-green-600 text-sm font-medium">技能总数</div>
              <div className="text-2xl font-bold text-green-900 mt-1">{filteredColumns.length}</div>
            </div>
            <div className="text-3xl">🎯</div>
          </div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-600 text-sm font-medium">平均现状</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{stats.avgCurrentLevel.toFixed(1)}</div>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-purple-600 text-sm font-medium">平均目标</div>
              <div className="text-2xl font-bold text-purple-900 mt-1">{stats.avgTargetLevel.toFixed(1)}</div>
            </div>
            <div className="text-3xl">🎖️</div>
          </div>
        </div>
      </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-700">
            <Filter className="w-5 h-5" />
            <span className="font-medium">筛选条件</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(value => !value)}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? '退出全屏' : '全屏查看'}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>导出CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* 部门筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">部门</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedDepartments([])}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedDepartments.length === 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                全部
              </button>
              {departments.map(dept => (
                <button
                  key={dept}
                  onClick={() => {
                    setSelectedDepartments(prev =>
                      prev.includes(dept as string)
                        ? prev.filter(d => d !== dept)
                        : [...prev, dept as string]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedDepartments.includes(dept as string)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>

          {/* 模块筛选 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">模块</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedModules([])}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedModules.length === 0
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                全部
              </button>
              {modules.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => {
                    setSelectedModules(prev =>
                      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedModules.includes(id)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 矩阵表格 */}
      <div
        data-testid="matrix-table-shell"
        className={isFullscreen ? 'min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg bg-white shadow' : 'bg-white rounded-lg shadow overflow-hidden'}
      >
        {/* 提示：横向滚动查看更多列 */}
        {filteredColumns.length > 10 && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span>表格支持横向滚动查看所有技能列</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        )}
        <div data-testid="matrix-scroll-container" className="w-full min-w-0 overflow-x-auto overflow-y-auto" style={isFullscreen ? {
          height: '100%',
          maxHeight: 'none',
        } : { 
          height: 'calc(100vh - 320px)',
          maxHeight: 'calc(100vh - 320px)'
        }}>
          <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: `max(100%, ${matrixTableMinWidth})` }}>
            <thead className="bg-gray-50 sticky top-0 z-30 shadow-sm">
              <tr>
                <th className="sticky left-0 z-40 bg-gray-50 px-4 py-1.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                  部门
                </th>
                <th className="sticky z-40 bg-gray-50 px-4 py-1.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r-2 border-gray-300" style={{ left: '120px' }}>
                  姓名
                </th>
                {filteredColumns.map(col => {
                  const icon = getSkillIcon(col.skillName);
                  return (
                    <th
                      key={col.skillId}
                      className="px-2 py-1.5 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200"
                      style={{ minWidth: '80px' }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-lg">{icon}</span>
                        <div className="text-[9px] text-gray-400 leading-tight">{col.moduleName}</div>
                        <div className="whitespace-normal break-words text-[10px] leading-tight">{col.skillName}</div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRows.map(row => (
                <tr key={row.employeeId} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm text-gray-600 border-r border-gray-200" style={{ minWidth: '120px' }}>
                    {row.departmentName || '-'}
                  </td>
                  <td className="sticky z-10 bg-white px-4 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300" style={{ left: '120px', minWidth: '120px' }}>
                    {row.employeeName}
                  </td>
                  {filteredColumns.map(col => {
                    const skill = row.skills[col.skillId];
                    
                    if (!skill) {
                      return (
                        <td key={col.skillId} className="px-3 py-3 text-center text-gray-300 border-r border-gray-200">
                          -
                        </td>
                      );
                    }

                    const gap = skill.gap;
                    const incomplete = hasIncompleteLevel(skill.currentLevel, skill.targetLevel);
                    const bgColor = incomplete
                      ? 'bg-gray-50'
                      : gap === 0 
                      ? 'bg-green-50' 
                      : gap === 1 
                      ? 'bg-yellow-50' 
                      : 'bg-red-50';
                    const textColor = incomplete
                      ? 'text-gray-500'
                      : gap === 0 
                      ? 'text-green-700' 
                      : gap === 1 
                      ? 'text-yellow-700' 
                      : 'text-red-700';

                    return (
                      <td key={col.skillId} className={`px-3 py-3 text-center border-r border-gray-200 ${bgColor}`}>
                        <div className={`text-sm font-medium ${textColor}`}>
                          {formatLevel(skill.currentLevel)}/{formatLevel(skill.targetLevel)}
                        </div>
                        {!incomplete && gap > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Gap: {gap}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 图例 */}
      {!isFullscreen && (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-medium text-gray-700 mb-2">图例说明</div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <span className="text-gray-600">Gap = 0（已达标）</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
            <span className="text-gray-600">Gap = 1（接近目标）</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span className="text-gray-600">Gap ≥ 2（需重点提升）</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
            <span className="text-gray-600">-（暂无评估）</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
