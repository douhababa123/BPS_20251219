import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService, employeesService, scheduleNotificationsService, taskTypesService, competencyDefinitionsService } from '../services';
import { TASK_TYPES, getCompetenceConfig } from '../lib/taskTypeConfig';
import {
  applyTaskTypeChange,
  buildContinuousTaskSegments,
  getTaskLocationOptions,
  normalizeOptionalStatus,
  sortHourStats,
} from '../lib/scheduleRules';
import { taskWorkflowService } from '../services/task-workflow.service';
import { Plus, Download, Calendar as CalendarIcon, Users, X, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNewAuth } from '../contexts/NewAuthContext';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import { TaskCard, TaskCardCompact } from '../components/TaskCard';
import { TaskDetailModal } from '../components/TaskDetailModal';
import {
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
  Legend,
} from 'recharts';

type ViewMode = 'team' | 'personal';
type PeriodType = 'month' | 'quarter' | 'year';
type TaskStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'pending_approval' | 'rejected' | 'confirmed' | 'employee_rejected' | 'all';
const COMPETENCE_SEPARATOR = ' | ';
const NON_REPORTABLE_STATUSES = new Set(['rejected', 'employee_rejected']);
const UNASSIGNED_ROW_ID = '__unassigned__';

function parseTaskCompetence(value: string | null | undefined) {
  if (!value) return { moduleName: '', competencyType: '' };
  const [moduleName, ...rest] = value.split(COMPETENCE_SEPARATOR);
  if (rest.length === 0) return { moduleName: '', competencyType: value };
  return { moduleName, competencyType: rest.join(COMPETENCE_SEPARATOR) };
}

// 任务状态配置
const TASK_STATUS_CONFIG = {
  all: { label: '全部', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  planned: { label: '计划中', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  in_progress: { label: '进行中', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700 border-green-300' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700 border-red-300' },
  pending_approval: { label: '待审批', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-600 border-red-200' },
  confirmed: { label: '已确认', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  employee_rejected: { label: '工程师拒绝', color: 'bg-purple-100 text-purple-700 border-purple-300' },
};

export function Schedule() {
  const queryClient = useQueryClient();
  const { user } = useNewAuth();
  const isAdmin = user?.role === 'admin';
  const [viewMode, setViewMode] = useState<ViewMode>('team');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [prefilledTaskData, setPrefilledTaskData] = useState<{ employeeId: string; date: string } | null>(null);

  const formatMonthValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  const handleMonthChange = (offset: number) => {
    const [year, month] = selectedDate.split('-').map(Number);
    const baseDate = new Date(year, month - 1 + offset, 1);
    setSelectedDate(formatMonthValue(baseDate));
  };

  const handleJumpToToday = () => {
    setSelectedDate(formatMonthValue(new Date()));
  };

  // 获取数据
  const { data: employees = [], error: employeesError, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesService.getAll(),
    retry: 1, // 减少重试次数
  });
  
  // 如果员工查询失败，使用空数组继续
  const employeeList = employees || [];
  
  console.log('👥 员工数据状态:', {
    isLoading: isEmployeesLoading,
    count: employeeList.length,
    error: employeesError
  });

  const [year, month] = selectedDate.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const { data: tasks = [], isLoading: isTasksLoading, refetch } = useQuery({
    queryKey: ['tasks', startDate, endDate],
    queryFn: async () => {
      console.log('🔍 Schedule 查询参数:', { startDate, endDate });
      try {
        // 先查询所有任务（不过滤 status）
        const allTasks = await tasksService.getTasks({ 
          start_date: startDate, 
          end_date: endDate
        });
        console.log('📊 查询到的任务总数:', allTasks.length);
        
        // 只在有任务时才打印详情
        if (allTasks.length > 0 && allTasks[0]) {
          console.log('📋 第一个任务示例:', {
            id: allTasks[0].id,
            task_name: allTasks[0].task_name,
            assigned_employee_id: allTasks[0].assigned_employee_id,
            start_date: allTasks[0].start_date,
            end_date: allTasks[0].end_date,
            status: allTasks[0].status,
          });
        }
        
        return allTasks || [];
      } catch (error) {
        console.error('❌ 查询任务失败:', error);
        return []; // 返回空数组，避免阻塞
      }
    },
    retry: 1, // 减少重试次数
    enabled: !!startDate && !!endDate, // 只有日期存在时才查询
  });
  
  console.log('📅 日程管理数据状态:', {
    employeesCount: employeeList.length,
    tasksCount: tasks.length,
    isEmployeesLoading,
    isTasksLoading
  });

  const normalizedTasks = useMemo(() => {
    return (tasks || []).map((task: any) => {
      const assignedEmployee = employeeList.find((emp: any) => emp.id === task.assigned_employee_id);

      return {
        ...task,
        task_name: task.task_name || task.name || '未命名任务',
        task_type: task.task_type || '未分类',
        employee_name: task.employee_name || assignedEmployee?.name || '',
        assigned_employee_email: task.assigned_employee_email || assignedEmployee?.email || '',
      };
    });
  }, [tasks, employeeList]);

  // 删除任务 mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => tasksService.delete(taskId),
    onSuccess: (_: any, taskId: string) => {
      // 直接从缓存中移除，立即反映删除
      queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((t: any) => t.id !== taskId);
      });
      queryClient.refetchQueries({ queryKey: ['tasks'] });
    },
  });

  // 更新任务 mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      tasksService.update(id, updates),
    onSuccess: (updatedTask: any) => {
      // 直接替换缓存中的旧任务，立即反映更新
      queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((t: any) => t.id === updatedTask.id ? updatedTask : t);
      });
      queryClient.refetchQueries({ queryKey: ['tasks'] });
    },
  });

  // 工程师确认 / 拒绝 mutation
  const [empRejectModal, setEmpRejectModal] = useState<{ taskId: string; taskName: string } | null>(null);
  const [empRejectReason, setEmpRejectReason] = useState('');

  const confirmTaskMutation = useMutation({
    mutationFn: (taskId: string) => taskWorkflowService.confirm(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: any) => alert(`确认失败: ${e.message}`),
  });

  const empRejectMutation = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      taskWorkflowService.employeeReject(taskId, reason),
    onSuccess: () => {
      setEmpRejectModal(null);
      setEmpRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e: any) => alert(`拒绝失败: ${e.message}`),
  });

  // 我的待确认任务：status=planned 且 assigned_employee_id 与当前用户匹配（通过邮箱）
  const myPlannedTasks = useMemo(() => {
    if (!user) return [];
    const userEmail = user.email.toLowerCase();
    return normalizedTasks.filter((t: any) =>
      t.status === 'planned' && (t.assigned_employee_email || '').toLowerCase() === userEmail
    );
  }, [normalizedTasks, user]);

  // Admin 待审批任务
  const pendingApprovalTasks = useMemo(() => {
    if (!isAdmin) return [];
    return normalizedTasks.filter((t: any) => t.status === 'pending_approval');
  }, [normalizedTasks, isAdmin]);

  const canModifyTask = (task: any) => {
    if (isAdmin) return true;
    return (
      task.status === 'pending_approval'
      && (task.requester_id || '').toLowerCase() === (user?.id || '').toLowerCase()
    );
  };

  // Admin 审批 / 拒绝 mutation
  const [adminRejectModal, setAdminRejectModal] = useState<{ taskId: string; taskName: string } | null>(null);
  const [adminRejectReason, setAdminRejectReason] = useState('');

  const approveMutation = useMutation({
    mutationFn: (taskId: string) => taskWorkflowService.approve(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: any) => alert(`审批失败: ${e.message}`),
  });

  const adminRejectMutation = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) =>
      taskWorkflowService.reject(taskId, reason),
    onSuccess: () => {
      setAdminRejectModal(null);
      setAdminRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e: any) => alert(`拒绝失败: ${e.message}`),
  });

  // 筛选任务（增加状态筛选）
  const filteredTasks = useMemo(() => {
    let result = normalizedTasks;
    
    // 员工筛选
    if (selectedEmployeeIds.length > 0 && selectedEmployeeIds.length < employeeList.length) {
      result = result.filter((task: any) => selectedEmployeeIds.includes(task.assigned_employee_id));
    }
    
    // 状态筛选
    if (statusFilter !== 'all') {
      result = result.filter((task: any) => task.status === statusFilter);
    }
    
    return result;
  }, [normalizedTasks, selectedEmployeeIds, statusFilter, employeeList.length]);

  const reportableTasks = useMemo(() => {
    return filteredTasks.filter((task: any) => !NON_REPORTABLE_STATUSES.has(task.status));
  }, [filteredTasks]);

  // 计算统计数据
  const statistics = useMemo(() => {
    const workingDays = 22; // 假设每月22个工作日
    const selectedEmployeeCount = selectedEmployeeIds.length || employeeList.length;
    const standardHours = selectedEmployeeCount * workingDays * 8;
    const totalHours = reportableTasks.reduce((sum: number, task: any) => sum + (task.total_hours || 0), 0);
    const saturation = standardHours > 0 ? Math.round((totalHours / standardHours) * 100) : 0;

    return {
      totalTasks: reportableTasks.length,
      totalHours,
      standardHours,
      saturation,
      taskCount: reportableTasks.length,
    };
  }, [reportableTasks, selectedEmployeeIds.length, employeeList.length]);

  // 任务地点统计
  const locationStats = useMemo(() => {
    const statsMap = new Map();
    reportableTasks.forEach((task: any) => {
      const hours = task.total_hours || 0;
      const location = task.task_location || 'Unspecified';
      const existing = statsMap.get(location) || { name: location, value: 0 };
      existing.value += hours;
      statsMap.set(location, existing);
    });

    return sortHourStats(Array.from(statsMap.values()));
  }, [reportableTasks]);

  // 能力域统计（用于图表，带hex颜色）
  const competenceStats = useMemo(() => {
    const statsMap = new Map<string, { name: string; value: number; color: string }>();
    reportableTasks.forEach((task: any) => {
      const key = task.competence || 'Others';
      const cfg = getCompetenceConfig(key);
      const existing = statsMap.get(key) || { name: cfg.label, value: 0, color: cfg.color };
      existing.value += task.total_hours || 0;
      statsMap.set(key, existing);
    });
    return Array.from(statsMap.values());
  }, [reportableTasks]);

  // 个人饱和度
  const personalSaturation = useMemo(() => {
    const workingDays = 22;
    return selectedEmployeeIds.map(empId => {
      const emp = employees.find((e: any) => e.id === empId);
      const empTasks = reportableTasks.filter((t: any) => t.assigned_employee_id === empId);
      const hours = empTasks.reduce((sum: number, t: any) => sum + (t.total_hours || 0), 0);
      const saturation = Math.min(100, Math.round((hours / (workingDays * 8)) * 100));

      return {
        id: empId,
        name: emp?.name || 'Unknown',
        hours,
        saturation,
        taskCount: empTasks.length,
      };
    });
  }, [selectedEmployeeIds, employees, reportableTasks]);

  // 日历数据
  const calendarData = useMemo(() => {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return { days, daysInMonth };
  }, [daysInMonth]);

  // 导出CSV
  const handleExport = () => {
    const headers = ['任务名称', '类型', '地点', '工程师', '开始日期', '结束日期', '天数', '总工时'];
    const rows = filteredTasks.map((task: any) => [
      task.task_name,
      task.task_type,
      task.task_location,
      task.employee_name || '',
      task.start_date,
      task.end_date,
      task.days_count,
      task.total_hours,
    ]);

    const csvContent = '\ufeff' + [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schedule-${selectedDate}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="w-full space-y-4">
        {/* 顶部区域 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">BPS工程师日程管理</h1>
              <p className="text-gray-600 mt-1">Schedule Management System</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTaskForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新增任务
              </button>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
            </div>
          </div>

          {/* 筛选和统计 */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-blue-600 text-sm font-medium">本月任务</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{statistics.taskCount}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-green-600 text-sm font-medium">总工时</div>
              <div className="text-2xl font-bold text-green-900 mt-1">{statistics.totalHours}h</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-amber-600 text-sm font-medium">团队饱和度</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{statistics.saturation}%</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-purple-600 text-sm font-medium">参与人数</div>
              <div className="text-2xl font-bold text-purple-900 mt-1">{selectedEmployeeIds.length || employees.length}</div>
            </div>
          </div>

          {/* 工程师选择和日期 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-gray-600" />
              <input
                type="month"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMonthChange(-1)}
                  className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  上个月
                </button>
                <button
                  onClick={() => handleMonthChange(1)}
                  className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  下个月
                </button>
                <button
                  onClick={handleJumpToToday}
                  className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  回到本月
                </button>
              </div>
            </div>
            <div className="flex-1 flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  if (selectedEmployeeIds.length === employees.length) {
                    setSelectedEmployeeIds([]);
                  } else {
                    setSelectedEmployeeIds(employees.map((e: any) => e.id));
                  }
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                  selectedEmployeeIds.length === employees.length
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                全选
              </button>
              {employees.map((emp: any) => (
                <button
                  key={emp.id}
                  onClick={() => {
                    setSelectedEmployeeIds(prev =>
                      prev.includes(emp.id)
                        ? prev.filter(id => id !== emp.id)
                        : [...prev, emp.id]
                    );
                  }}
                  className={cn(
                    'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                    selectedEmployeeIds.includes(emp.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {emp.name}
                </button>
              ))}
            </div>
          </div>

          {/* 任务状态筛选器 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">任务状态筛选：</span>
            {(Object.keys(TASK_STATUS_CONFIG) as TaskStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm font-medium transition-colors border',
                  statusFilter === status
                    ? TASK_STATUS_CONFIG[status].color
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                )}
              >
                {TASK_STATUS_CONFIG[status].label}
                {status !== 'all' && (
                  <span className="ml-1 text-xs">
                    ({tasks.filter((t: any) => t.status === status).length})
                  </span>
                )}
                {status === 'all' && (
                  <span className="ml-1 text-xs">
                    ({tasks.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 视图切换 */}
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

        {/* Admin 待审批任务区 */}
        {isAdmin && pendingApprovalTasks.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-2">
            <h3 className="text-sm font-bold text-orange-800 mb-3">
              ⏳ 有 {pendingApprovalTasks.length} 个任务申请待您审批：
            </h3>
            <div className="space-y-2">
              {pendingApprovalTasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between gap-4 bg-white rounded-lg px-4 py-3 border border-orange-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{task.task_name}</p>
                    <p className="text-xs text-gray-500">{task.start_date} → {task.end_date} · {task.task_location} · {task.task_type}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveMutation.mutate(task.id)}
                      disabled={approveMutation.isPending}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
                    >
                      ✅ 审批通过
                    </button>
                    <button
                      onClick={() => { setAdminRejectModal({ taskId: task.id, taskName: task.task_name }); setAdminRejectReason(''); }}
                      disabled={adminRejectMutation.isPending}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      ❌ 拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin 待审批任务区 */}
        {isAdmin && pendingApprovalTasks.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-2">
            <h3 className="text-sm font-bold text-orange-800 mb-3">
              ⏳ 有 {pendingApprovalTasks.length} 个任务申请待您审批：
            </h3>
            <div className="space-y-2">
              {pendingApprovalTasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between gap-4 bg-white rounded-lg px-4 py-3 border border-orange-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{task.task_name}</p>
                    <p className="text-xs text-gray-500">{task.start_date} → {task.end_date} · {task.task_location} · {task.task_type}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveMutation.mutate(task.id)}
                      disabled={approveMutation.isPending}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
                    >
                      ✅ 审批通过
                    </button>
                    <button
                      onClick={() => { setAdminRejectModal({ taskId: task.id, taskName: task.task_name }); setAdminRejectReason(''); }}
                      disabled={adminRejectMutation.isPending}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      ❌ 拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 工程师待确认任务区 (工程师看到 planned 任务) */}
        {!isAdmin && myPlannedTasks.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-2">
            <h3 className="text-sm font-bold text-amber-800 mb-3">
              ⏳ 您有 {myPlannedTasks.length} 个待确认任务，请尽快处理：
            </h3>
            <div className="space-y-2">
              {myPlannedTasks.map((task: any) => (
                <div key={task.id} className="flex items-center justify-between gap-4 bg-white rounded-lg px-4 py-3 border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{task.task_name || task.name}</p>
                    <p className="text-xs text-gray-500">{task.start_date} → {task.end_date} · {task.task_location}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => confirmTaskMutation.mutate(task.id)}
                      disabled={confirmTaskMutation.isPending}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
                    >
                      ✅ 接受
                    </button>
                    <button
                      onClick={() => { setEmpRejectModal({ taskId: task.id, taskName: task.task_name || task.name }); setEmpRejectReason(''); }}
                      disabled={empRejectMutation.isPending}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
                    >
                      ❌ 拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 内容区域 */}
        {isTasksLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">正在加载数据...</p>
          </div>
        ) : viewMode === 'team' ? (
          <TeamView
            tasks={filteredTasks}
            calendarData={calendarData}
            selectedDate={selectedDate}
            selectedEmployeeIds={selectedEmployeeIds}
            employees={employees}
            competenceStats={competenceStats}
            locationStats={locationStats}
            periodType={periodType}
            setPeriodType={setPeriodType}
            onEditTask={setEditingTask}
            onDeleteTask={(taskId: string) => {
              if (confirm('确定要删除这个任务吗？')) {
                deleteTaskMutation.mutate(taskId);
              }
            }}
            canModifyTask={canModifyTask}
            onQuickAdd={(data: { employeeId: string; date: string }) => {
              // 打开新增任务对话框，预填充员工和日期
              setPrefilledTaskData(data);
              setShowTaskForm(true);
            }}
          />
        ) : (
          <PersonalView
            personalSaturation={personalSaturation}
            selectedEmployeeIds={selectedEmployeeIds}
            employees={employees}
            tasks={reportableTasks}
          />
        )}
      </div>

      {/* 任务表单弹窗 - 新建 */}
      {showTaskForm && (
        <TaskFormModal
          employees={employees}
          prefilledData={prefilledTaskData}
          onClose={() => {
            setShowTaskForm(false);
            setPrefilledTaskData(null);
          }}
          onSuccess={() => {
            setShowTaskForm(false);
            setPrefilledTaskData(null);
            refetch();
          }}
        />
      )}

      {/* 任务表单弹窗 - 编辑 */}
      {editingTask && (
        <TaskFormModal
          employees={employees}
          editingTask={editingTask}
          onClose={() => setEditingTask(null)}
          onSuccess={() => {
            setEditingTask(null);
            refetch();
          }}
          onUpdate={(id: string, updates: any) => {
            updateTaskMutation.mutate({ id, updates });
            setEditingTask(null);
          }}
        />
      )}

      {/* 工程师拒绝原因弹窗 */}
      {empRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md">
            <h4 className="font-bold text-gray-900 mb-1">拒绝任务</h4>
            <p className="text-sm text-gray-500 mb-3">{empRejectModal.taskName}</p>
            <textarea
              value={empRejectReason}
              onChange={e => setEmpRejectReason(e.target.value)}
              rows={3}
              placeholder="请输入拒绝原因（必填）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setEmpRejectModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!empRejectReason.trim()) { alert('请填写拒绝原因'); return; }
                  empRejectMutation.mutate({ taskId: empRejectModal.taskId, reason: empRejectReason });
                }}
                disabled={empRejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50"
              >
                {empRejectMutation.isPending ? '处理中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin 拒绝原因弹窗 */}
      {adminRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md">
            <h4 className="font-bold text-gray-900 mb-1">拒绝任务申请</h4>
            <p className="text-sm text-gray-500 mb-3">{adminRejectModal.taskName}</p>
            <textarea
              value={adminRejectReason}
              onChange={e => setAdminRejectReason(e.target.value)}
              rows={3}
              placeholder="请输入拒绝原因（必填）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => setAdminRejectModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!adminRejectReason.trim()) { alert('请填写拒绝原因'); return; }
                  adminRejectMutation.mutate({ taskId: adminRejectModal.taskId, reason: adminRejectReason });
                }}
                disabled={adminRejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50"
              >
                {adminRejectMutation.isPending ? '处理中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 团队视图
function TeamView({
  tasks,
  calendarData,
  selectedDate,
  selectedEmployeeIds,
  employees,
  competenceStats,
  locationStats,
  periodType,
  setPeriodType,
  onEditTask,
  onDeleteTask,
  canModifyTask,
  onQuickAdd,
}: any) {
  const { days } = calendarData;
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const unassignedTasks = tasks.filter((task: any) => !task.assigned_employee_id);
  const continuousSegments = useMemo(() => buildContinuousTaskSegments(tasks), [tasks]);

  // 判断是否为周末
  const isWeekend = (day: any) => {
    const [year, month] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0=周日, 6=周六
  };

  // 获取星期几的中文
  const getWeekdayLabel = (day: any) => {
    const [year, month] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  };

  return (
    <div className="space-y-4">
      {/* 日历视图 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedDate} 日历 Calendar</h3>
        <div className="overflow-auto max-h-[600px] relative border-2 border-gray-300 rounded-lg">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-50 p-2 font-medium text-sm text-gray-700 border-b-2 border-r-2 border-gray-300 min-w-[150px]">
                  工程师
                </th>
                {days.map((day: any) => {
                  const weekend = isWeekend(day);
                  const weekdayLabel = getWeekdayLabel(day);
                  return (
                    <th 
                      key={day} 
                      className={cn(
                        "p-2 text-center font-medium text-sm border-b-2 border-r border-gray-300 min-w-[80px]",
                        weekend ? "bg-gray-100 text-gray-600" : "bg-gray-50 text-gray-700"
                      )}
                    >
                      <div className="flex flex-col items-center">
                        <span>{day}日</span>
                        <span className="text-xs font-normal">{weekdayLabel}</span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* 每个工程师的行 */}
              {employees
                .filter((emp: any) => selectedEmployeeIds.length === 0 || selectedEmployeeIds.includes(emp.id))
                .map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-white p-2 text-sm font-medium text-gray-900 border-r-2 border-b border-gray-300">
                      {emp.name}
                    </td>
                    {days.map((day: any) => {
                      const dateStr = `${selectedDate}-${String(day).padStart(2, '0')}`;
                      const weekend = isWeekend(day);
                      const dayTasks = tasks.filter((task: any) => {
                        const sd = task.start_date ? String(task.start_date).substring(0, 10) : '';
                        const ed = task.end_date ? String(task.end_date).substring(0, 10) : '';
                        return task.assigned_employee_id === emp.id &&
                          sd <= dateStr &&
                          ed >= dateStr;
                      });

                      return (
                        <td
                          key={`${emp.id}-${day}`}
                          className={cn(
                            "p-1 min-h-[60px] text-xs border-b border-r border-gray-200 align-top relative",
                            weekend ? "bg-gray-50/50" : "bg-white"
                          )}
                          onDoubleClick={(e) => {
                            // 如果双击的是任务卡片，不触发新增
                            if ((e.target as HTMLElement).closest('.task-card-compact')) return;
                            // 触发新增任务，预填充员工和日期
                            onQuickAdd({ employeeId: emp.id, date: dateStr });
                          }}
                        >
                          {dayTasks.map((task: any) => (
                            continuousSegments.get(`${task.id}|${dateStr}`)?.hidden ? null : (
                            <div key={task.id} className="task-card-compact">
                              <TaskCardCompact
                                task={task}
                                segmentMeta={continuousSegments.get(`${task.id}|${dateStr}`)}
                                onClick={() => setSelectedTask(task)}
                              />
                            </div>
                            )
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              {unassignedTasks.length > 0 && (
                <tr className="hover:bg-amber-50/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-amber-50 p-2 text-sm font-medium text-amber-900 border-r-2 border-b border-gray-300">
                    未分配
                  </td>
                  {days.map((day: any) => {
                    const dateStr = `${selectedDate}-${String(day).padStart(2, '0')}`;
                    const weekend = isWeekend(day);
                    const dayTasks = unassignedTasks.filter((task: any) => {
                      const sd = task.start_date ? String(task.start_date).substring(0, 10) : '';
                      const ed = task.end_date ? String(task.end_date).substring(0, 10) : '';
                      return sd <= dateStr && ed >= dateStr;
                    });

                    return (
                      <td
                        key={`${UNASSIGNED_ROW_ID}-${day}`}
                        className={cn(
                          "p-1 min-h-[60px] text-xs border-b border-r border-gray-200 align-top relative",
                          weekend ? "bg-amber-50/50" : "bg-amber-50/20"
                        )}
                        onDoubleClick={(e) => {
                          if ((e.target as HTMLElement).closest('.task-card-compact')) return;
                          onQuickAdd({ employeeId: '', date: dateStr });
                        }}
                      >
                        {dayTasks.map((task: any) => (
                          continuousSegments.get(`${task.id}|${dateStr}`)?.hidden ? null : (
                          <div key={task.id} className="task-card-compact">
                            <TaskCardCompact
                              task={task}
                              segmentMeta={continuousSegments.get(`${task.id}|${dateStr}`)}
                              onClick={() => setSelectedTask(task)}
                            />
                          </div>
                          )
                        ))}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 任务详情弹窗 */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={canModifyTask(selectedTask) ? () => {
            onEditTask(selectedTask);
            setSelectedTask(null);
          } : undefined}
          onDelete={canModifyTask(selectedTask) ? () => {
            onDeleteTask(selectedTask.id);
            setSelectedTask(null);
          } : undefined}
        />
      )}

      {/* 分析图表 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 能力域占比 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">能力域工时分布 Competence Hours</h3>
            <div className="flex gap-1 text-xs">
              {(['month', 'quarter', 'year'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => setPeriodType(period)}
                  className={cn(
                    'px-2 py-1 rounded transition-colors',
                    periodType === period
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {period === 'month' ? '月度' : period === 'quarter' ? '季度' : '年度'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={competenceStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(value: any) => `${value}h`} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {competenceStats.map((entry: any) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 任务地点占比 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">任务地点工时分布 Location Hours</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={locationStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip formatter={(value: any) => `${value}h`} />
              <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// 个人视图
function PersonalView({ personalSaturation, selectedEmployeeIds, employees, tasks }: any) {
  const [selectedEmpId, setSelectedEmpId] = useState(selectedEmployeeIds[0] || null);

  const selectedEmp = employees.find((e: any) => e.id === selectedEmpId);
  const empTasks = tasks.filter((t: any) => t.assigned_employee_id === selectedEmpId);

  // 个人能力域统计（带hex颜色）
  const empCompetenceStats = useMemo(() => {
    const statsMap = new Map<string, { name: string; value: number; color: string }>();
    empTasks.forEach((task: any) => {
      const key = task.competence || 'Others';
      const cfg = getCompetenceConfig(key);
      const existing = statsMap.get(key) || { name: cfg.label, value: 0, color: cfg.color };
      existing.value += task.total_hours || 0;
      statsMap.set(key, existing);
    });
    return sortHourStats(Array.from(statsMap.values()));
  }, [empTasks]);

  // 个人任务地点统计
  const empLocationStats = useMemo(() => {
    const statsMap = new Map();
    empTasks.forEach((task: any) => {
      const existing = statsMap.get(task.task_location) || { name: task.task_location, value: 0 };
      existing.value += task.total_hours || 0;
      statsMap.set(task.task_location, existing);
    });
    return Array.from(statsMap.values());
  }, [empTasks]);

  return (
    <div className="space-y-4">
      {/* 工程师选择 */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">选择工程师：</label>
          <select
            value={selectedEmpId || ''}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">请选择...</option>
            {employees
              .filter((emp: any) => selectedEmployeeIds.length === 0 || selectedEmployeeIds.includes(emp.id))
              .map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} - {emp.department_name || '无部门'}
                </option>
              ))}
          </select>
        </div>
      </div>

      {selectedEmpId ? (
        <>
          {/* 个人饱和度 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {selectedEmp?.name} - 工作饱和度
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {personalSaturation
                .filter((p: any) => p.id === selectedEmpId)
                .map((person: any) => (
                  <div key={person.id} className="p-4 border border-gray-200 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">本月饱和度</span>
                      <span className={cn(
                        'text-2xl font-bold',
                        person.saturation >= 90 ? 'text-red-600' : person.saturation >= 70 ? 'text-amber-600' : 'text-green-600'
                      )}>
                        {person.saturation}%
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full transition-all',
                          person.saturation >= 90 ? 'bg-red-500' : person.saturation >= 70 ? 'bg-amber-500' : 'bg-green-500'
                        )}
                        style={{ width: `${person.saturation}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {person.hours}h / 176h ({person.taskCount}个任务)
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 个人任务占比 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">能力域工时分布 Competence Hours</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={empCompetenceStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `${value}h`} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {empCompetenceStats.map((entry: any) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">任务地点工时分布 Location Hours</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={empLocationStats}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {empLocationStats.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#6366F1','#64748B','#14B8A6','#EC4899'][index % 9]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${value}h`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 个人任务列表 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">任务列表 ({empTasks.length}个)</h3>
            {empTasks.length > 0 ? (
              <div className="space-y-2">
                {empTasks.map((task: any) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => {
                      // TODO: 打开任务详情/编辑弹窗
                      console.log('点击任务:', task);
                    }}
                    className="hover:border-blue-300"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                暂无任务
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">请选择工程师查看详细信息</p>
        </div>
      )}
    </div>
  );
}

// 任务表单弹窗
export function TaskFormModal({ employees, editingTask, prefilledData, onClose, onSuccess, onUpdate }: any) {
  const queryClient = useQueryClient();
  const { user } = useNewAuth();
  const isEditMode = !!editingTask;
  const initialCompetence = parseTaskCompetence(editingTask?.competence || '');

  const baseFormData = {
    task_name: editingTask?.task_name || '',
    task_type: editingTask?.task_type || '',
    task_location: editingTask?.task_location || '',
    competence: editingTask?.competence || '',
    competence_module: initialCompetence.moduleName,
    competence_type: initialCompetence.competencyType,
    assigned_employee_id: editingTask?.assigned_employee_id || prefilledData?.employeeId || '',
    start_date: editingTask?.start_date || prefilledData?.date || '',
    end_date: editingTask?.end_date || prefilledData?.date || '',
    time_slot: (editingTask?.time_slot || 'FULL_DAY') as 'AM' | 'PM' | 'FULL_DAY',
    status: editingTask?.status || '',
    notes: editingTask?.notes || '',
  };
  const [formData, setFormData] = useState(
    baseFormData.task_type === 'Leave' ? applyTaskTypeChange(baseFormData, 'Leave') : baseFormData
  );
  const isLeave = formData.task_type === 'Leave';
  const taskLocationOptions = useMemo(
    () => getTaskLocationOptions(formData.task_location),
    [formData.task_location]
  );

  const { data: taskTypes = [] } = useQuery({
    queryKey: ['schedule-task-types'],
    queryFn: () => taskTypesService.getAll(),
  });

  const { data: competencyDefinitions = [] } = useQuery({
    queryKey: ['schedule-competency-definitions'],
    queryFn: () => competencyDefinitionsService.getAll(),
  });

  const availableTaskTypes = useMemo(() => {
    const apiOptions = taskTypes
      .filter((item: any) => item.is_active !== false)
      .map((item: any) => ({ value: item.code, label: item.name || item.code }));

    const fallbackOptions = TASK_TYPES.map((item) => ({ value: item.code, label: item.label }));
    const merged = apiOptions.length > 0 ? apiOptions : fallbackOptions;

    if (formData.task_type && !merged.some((item) => item.value === formData.task_type)) {
      return [{ value: formData.task_type, label: formData.task_type }, ...merged];
    }

    return merged;
  }, [taskTypes, formData.task_type]);

  const competenceModules = useMemo(() => {
    const moduleMap = new Map<string, number>();
    competencyDefinitions
      .filter((item: any) => item.module_name && item.competency_type)
      .forEach((item: any) => {
        if (!moduleMap.has(item.module_name)) {
          moduleMap.set(item.module_name, item.module_id ?? 999);
        }
      });

    return Array.from(moduleMap.entries())
      .map(([value, moduleId]) => {
        const cfg = getCompetenceConfig(value);
        return { value, label: value, moduleId, color: cfg.color, colorKey: cfg.colorKey };
      })
      .sort((left, right) => left.moduleId - right.moduleId || left.label.localeCompare(right.label, 'zh-CN'));
  }, [competencyDefinitions]);

  const competenceItems = useMemo(() => {
    if (!formData.competence_module) return [];

    const rows = competencyDefinitions
      .filter((item: any) => item.module_name === formData.competence_module && item.competency_type)
      .map((item: any) => ({
        value: item.competency_type,
        label: item.competency_type,
        code: item.competency_code || '',
      }))
      .sort((left, right) => {
        const leftNo = Number(left.code.match(/-(\d+)$/)?.[1] || 999);
        const rightNo = Number(right.code.match(/-(\d+)$/)?.[1] || 999);
        return leftNo - rightNo || left.label.localeCompare(right.label, 'zh-CN');
      });

    if (formData.competence_type && !rows.some((item) => item.value === formData.competence_type)) {
      return [{ value: formData.competence_type, label: formData.competence_type, code: '' }, ...rows];
    }

    return rows;
  }, [competencyDefinitions, formData.competence_module, formData.competence_type]);

  const selectedCompetenceConfig = useMemo(() => {
    return getCompetenceConfig(formData.competence_module || formData.competence);
  }, [formData.competence_module, formData.competence]);

  useEffect(() => {
    if (!formData.competence || formData.competence_module || competencyDefinitions.length === 0) return;

    const match = competencyDefinitions.find((item: any) => item.competency_type === formData.competence);
    if (match) {
      setFormData((current) => ({
        ...current,
        competence_module: match.module_name,
        competence_type: match.competency_type,
      }));
    }
  }, [competencyDefinitions, formData.competence, formData.competence_module]);
  
  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const task: any = await tasksService.create(data);
      
      // 如果是 Site PS 为其他员工创建任务，发送通知
      // 注意：user.id 是 users 表的 ID，而 employees.id 是员工表的 ID，需要通过 email 匹配找到当前用户的员工记录
      const currentEmployee = user
        ? employees.find((emp: any) => (emp.email || '').toLowerCase() === user.email.toLowerCase())
        : null;
      if (currentEmployee && task.assigned_employee_id && task.assigned_employee_id !== currentEmployee.id) {
        const assignedEmployee = employees.find((emp: any) => emp.id === task.assigned_employee_id);
        if (assignedEmployee) {
          try {
            await scheduleNotificationsService.create({
              task_id: task.id,
              affected_employee_id: assignedEmployee.id,
              modified_by_employee_id: currentEmployee.id,
              notification_type: 'CREATED',
              change_description: `创建任务：${task.task_name}（${task.start_date} - ${task.end_date}）`,
            });
          } catch (notifError) {
            // 通知发送失败不影响任务创建成功
            console.warn('📭 通知发送失败（不影响任务创建）:', notifError);
          }
        }
      }
      
      return task;
    },
    onSuccess: (newTask: any) => {
      // 将新任务直接插入缓存，立即显示，无需等待重新请求
      queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return [...old, newTask];
      });
      // 强制立即重新请求（不受 staleTime 限制）
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      onSuccess();
    },
    onError: (e: any) => {
      alert(`创建任务失败: ${e?.response?.data?.detail || e?.message || '未知错误'}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 计算工时
    const hoursPerDay = formData.time_slot === 'AM' ? 3.5 : formData.time_slot === 'PM' ? 4.5 : 8;
    const daysCount = formData.start_date && formData.end_date
      ? Math.round((new Date(formData.end_date).getTime() - new Date(formData.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : 1;
    const totalHours = daysCount * hoursPerDay;

    const competenceValue = formData.competence_module && formData.competence_type
      ? `${formData.competence_module}${COMPETENCE_SEPARATOR}${formData.competence_type}`
      : formData.competence_type || formData.competence || null;

    const taskData = {
      task_name: formData.task_name,
      task_type: formData.task_type,
      task_location: formData.task_location,
      competence: competenceValue,
      assigned_employee_id: formData.assigned_employee_id || null,
      start_date: formData.start_date,
      end_date: formData.end_date,
      time_slot: formData.time_slot,
      hours_per_day: hoursPerDay,
      days_count: daysCount,
      total_hours: totalHours,
      status: normalizeOptionalStatus(formData.status),
      notes: formData.notes,
      source: 'manual',
    };
    
    if (isEditMode && onUpdate) {
      onUpdate(editingTask.id, taskData);
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditMode ? '编辑任务 Edit Task' : '新增任务 New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required={!isLeave}
              disabled={isLeave}
              value={formData.task_name}
              onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="输入任务名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务类型 <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.task_type}
              onChange={(e) => setFormData((current) => applyTaskTypeChange(current, e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择...</option>
              {availableTaskTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务地点 <span className="text-red-500">*</span>
            </label>
            <select
              required={!isLeave}
              disabled={isLeave}
              value={formData.task_location}
              onChange={(e) => setFormData({ ...formData, task_location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">请选择...</option>
              {taskLocationOptions.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              能力域 Competence <span className="text-red-500">*</span>
            </label>
            <select
              required={!isLeave}
              value={formData.competence_module}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  competence_module: e.target.value,
                  competence_type: '',
                  competence: '',
                });
              }}
              disabled={isLeave}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">请选择能力域...</option>
              {competenceModules.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} ({item.colorKey})
                </option>
              ))}
            </select>
            {formData.competence_module && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                <span
                  className="w-3 h-3 rounded-full border border-gray-300"
                  style={{ backgroundColor: selectedCompetenceConfig.color }}
                />
                <span>{selectedCompetenceConfig.colorKey}</span>
                <span className="text-gray-400">{selectedCompetenceConfig.color}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Competence Item <span className="text-red-500">*</span>
            </label>
            <select
              required={!isLeave}
              value={formData.competence_type}
              onChange={(e) => {
                const competenceType = e.target.value;
                setFormData({
                  ...formData,
                  competence_type: competenceType,
                  competence: formData.competence_module && competenceType
                    ? `${formData.competence_module}${COMPETENCE_SEPARATOR}${competenceType}`
                    : '',
                });
              }}
              disabled={isLeave || !formData.competence_module}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">Select competence item...</option>
              {competenceItems.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              分配工程师
            </label>
            <select
              value={formData.assigned_employee_id}
              disabled={isLeave}
              onChange={(e) => setFormData({ ...formData, assigned_employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">未分配</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} - {emp.department_name || '无部门'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束日期 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              时间槽 <span className="text-red-500">*</span>
            </label>
            <TimeSlotSelector
              value={formData.time_slot}
              onChange={(value) => setFormData({ ...formData, time_slot: value })}
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 提示：选择时间槽后系统会自动计算工时（上午3.5h，下午4.5h，全天8h）
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              任务状态（可选）
            </label>
            <select
              value={formData.status}
              disabled={isLeave}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">请选择...</option>
              {(['planned', 'in_progress', 'completed', 'cancelled'] as const).map((status) => (
                <option key={status} value={status}>{TASK_STATUS_CONFIG[status].label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={formData.notes}
              disabled={isLeave}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              placeholder="可选备注信息"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createTaskMutation.isPending ? '保存中...' : (isEditMode ? '更新' : '保存')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
