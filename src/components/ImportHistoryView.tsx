/**
 * 导入历史记录组件
 * 
 * 功能：
 * - 显示最近的导入操作历史
 * - 按批次聚合显示
 * - 支持按表名筛选
 * - 显示操作人、时间、成功/失败数量
 */

import { useQuery } from '@tanstack/react-query';
import { getImportHistory, type ImportHistoryItem } from '@/services/adminService';
import { Clock, User, FileText, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface ImportHistoryViewProps {
  /** 默认筛选的表名 */
  defaultTable?: string;
}

/**
 * 格式化时间戳
 */
const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);
  
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}小时前`;
  
  return date.toLocaleString('zh-CN', { 
    month: 'numeric', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

/**
 * 表名中文映射
 */
const TABLE_NAMES: Record<string, string> = {
  'departments': '部门',
  'employees': '员工',
  'skills': '技能',
  'factories': '工厂',
  'task_types': '任务类型',
  'tasks': '任务',
  'competency_definitions': '能力定义',
  'competency_assessments': '能力评估',
  'resource_task_types': '资源任务类型',
  'resource_planning_tasks': '资源规划任务',
};

const getTableDisplayName = (tableName: string): string => {
  return TABLE_NAMES[tableName] || tableName;
};

export function ImportHistoryView({ defaultTable }: ImportHistoryViewProps) {
  const [selectedTable, setSelectedTable] = useState<string | undefined>(defaultTable);

  // 查询导入历史
  const { 
    data: history = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<ImportHistoryItem[]>({
    queryKey: ['import-history', selectedTable],
    queryFn: () => getImportHistory(selectedTable, 50),
    staleTime: 30 * 1000, // 30秒内不重新请求
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center text-red-700">
          <XCircle className="w-5 h-5 mr-2" />
          <span>加载失败: {(error as Error).message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">导入历史</h3>
          
          {/* 表名筛选 */}
          <select
            value={selectedTable || 'all'}
            onChange={(e) => setSelectedTable(e.target.value === 'all' ? undefined : e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部表</option>
            <option value="departments">部门</option>
            <option value="employees">员工</option>
            <option value="skills">技能</option>
          </select>
        </div>

        {/* 刷新按钮 */}
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* 历史记录列表 */}
      {history.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无导入记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item, index) => (
            <div
              key={`${item.batch_id}-${index}`}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                {/* 左侧：操作信息 */}
                <div className="flex-1 space-y-2">
                  {/* 第一行：表名 + 时间 */}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getTableDisplayName(item.table_name)}
                    </span>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatTimestamp(item.operated_at)}
                    </div>
                  </div>

                  {/* 第二行：操作人 */}
                  <div className="flex items-center text-sm text-gray-700">
                    <User className="w-4 h-4 mr-1.5 text-gray-400" />
                    <span className="font-medium">{item.operator_name}</span>
                    <span className="mx-2 text-gray-400">·</span>
                    <span className="text-gray-500">{item.operator_email}</span>
                  </div>

                  {/* 第三行：记录预览 */}
                  {item.preview && (
                    <div className="text-xs text-gray-500 truncate">
                      <FileText className="w-3 h-3 inline mr-1" />
                      {item.preview}
                    </div>
                  )}
                </div>

                {/* 右侧：统计数据 */}
                <div className="flex gap-4 ml-6">
                  {/* 成功数量 */}
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div className="text-right">
                      <div className="text-lg font-semibold text-green-600">
                        {item.success_count}
                      </div>
                      <div className="text-xs text-gray-500">成功</div>
                    </div>
                  </div>

                  {/* 失败数量 */}
                  {item.failed_count > 0 && (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <div className="text-right">
                        <div className="text-lg font-semibold text-red-600">
                          {item.failed_count}
                        </div>
                        <div className="text-xs text-gray-500">失败</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部统计 */}
      {history.length > 0 && (
        <div className="text-sm text-gray-500 text-center pt-2">
          共 {history.length} 条导入记录
        </div>
      )}
    </div>
  );
}
