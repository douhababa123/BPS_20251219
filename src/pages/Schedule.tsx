import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseService } from '../lib/supabaseService';
import { Plus, Download, Calendar as CalendarIcon, Users, X, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
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

// 预设颜色
const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#64748B', '#14B8A6', '#EC4899'];

export function Schedule() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('team');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
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
    queryFn: () => supabaseService.getAllEmployees(),
    retry: 1, // 减少重试次数
  });
  
  // 如果员工查询失败，使用空数组继续
  const employeeList = employees || [];
  
  console.log('👥 员工数据状态:', {
    isLoading: isEmployeesLoading,
    count: employeeList.length,
    error: employeesError
  });

  const { data: taskTypes = [] } = useQuery({
    queryKey: ['task-types'],
    queryFn: () => supabaseService.getAllTaskTypes(),
    retry: 1,
  });

  const { data: factories = [] } = useQuery({
    queryKey: ['factories'],
    queryFn: () => supabaseService.getAllFactories(),
    retry: 1,
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
        const allTasks = await supabaseService.getAllTasks({ 
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

  // 删除任务 mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => supabaseService.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // 更新任务 mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      supabaseService.updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // 筛选任务
  const filteredTasks = useMemo(() => {
    if (selectedEmployeeIds.length === 0) return tasks;
    return tasks.filter((task: any) => selectedEmployeeIds.includes(task.assigned_employee_id));
  }, [tasks, selectedEmployeeIds]);

  // 计算统计数据
  const statistics = useMemo(() => {
    const workingDays = 22; // 假设每月22个工作日
    const standardHours = selectedEmployeeIds.length * workingDays * 8;
    const totalHours = filteredTasks.reduce((sum: number, task: any) => sum + (task.total_hours || 0), 0);
    const saturation = standardHours > 0 ? Math.round((totalHours / standardHours) * 100) : 0;

    return {
      totalTasks: filteredTasks.length,
      totalHours,
      standardHours,
      saturation,
      taskCount: filteredTasks.length,
    };
  }, [filteredTasks, selectedEmployeeIds.length]);

  // 任务类型统计
  const typeStats = useMemo(() => {
    const statsMap = new Map();
    let total = 0;

    filteredTasks.forEach((task: any) => {
      const hours = task.total_hours || 0;
      const existing = statsMap.get(task.task_type) || { name: task.task_type, value: 0 };
      existing.value += hours;
      total += hours;
      statsMap.set(task.task_type, existing);
    });

    return Array.from(statsMap.values());
  }, [filteredTasks]);

  // 任务地点统计
  const locationStats = useMemo(() => {
    const statsMap = new Map();
    filteredTasks.forEach((task: any) => {
      const hours = task.total_hours || 0;
      const existing = statsMap.get(task.task_location) || { name: task.task_location, value: 0 };
      existing.value += hours;
      statsMap.set(task.task_location, existing);
    });

    return Array.from(statsMap.values());
  }, [filteredTasks]);

  // 个人饱和度
  const personalSaturation = useMemo(() => {
    const workingDays = 22;
    return selectedEmployeeIds.map(empId => {
      const emp = employees.find((e: any) => e.id === empId);
      const empTasks = filteredTasks.filter((t: any) => t.assigned_employee_id === empId);
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
  }, [selectedEmployeeIds, employees, filteredTasks]);

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
            typeStats={typeStats}
            locationStats={locationStats}
            periodType={periodType}
            setPeriodType={setPeriodType}
            onEditTask={setEditingTask}
            onDeleteTask={(taskId: string) => {
              if (confirm('确定要删除这个任务吗？')) {
                deleteTaskMutation.mutate(taskId);
              }
            }}
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
            tasks={filteredTasks}
          />
        )}
      </div>

      {/* 任务表单弹窗 - 新建 */}
      {showTaskForm && (
        <TaskFormModal
          employees={employees}
          taskTypes={taskTypes}
          factories={factories}
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
          taskTypes={taskTypes}
          factories={factories}
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
  typeStats,
  locationStats,
  periodType,
  setPeriodType,
  onEditTask,
  onDeleteTask,
  onQuickAdd,
}: any) {
  const { days } = calendarData;
  const [selectedTask, setSelectedTask] = useState<any>(null);

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
                        return task.assigned_employee_id === emp.id &&
                          task.start_date <= dateStr &&
                          task.end_date >= dateStr;
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
                            <div key={task.id} className="task-card-compact">
                              <TaskCardCompact
                                task={task}
                                onClick={() => setSelectedTask(task)}
                              />
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 任务详情弹窗 */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onEdit={() => {
            onEditTask(selectedTask);
            setSelectedTask(null);
          }}
          onDelete={() => {
            onDeleteTask(selectedTask.id);
            setSelectedTask(null);
          }}
        />
      )}

      {/* 分析图表 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 任务类型占比 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">任务类型占比 Task Types</h3>
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
            <PieChart>
              <Pie
                data={typeStats}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {typeStats.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => `${value}h`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 任务地点占比 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">任务地点占比 Locations</h3>
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

  // 个人任务类型统计
  const empTypeStats = useMemo(() => {
    const statsMap = new Map();
    empTasks.forEach((task: any) => {
      const existing = statsMap.get(task.task_type) || { name: task.task_type, value: 0 };
      existing.value += task.total_hours || 0;
      statsMap.set(task.task_type, existing);
    });
    return Array.from(statsMap.values());
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
                  {emp.name} - {emp.departments?.name || '无部门'}
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
              <h3 className="text-lg font-bold text-gray-900 mb-4">任务类型占比</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={empTypeStats}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {empTypeStats.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${value}h`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">任务地点占比</h3>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
function TaskFormModal({ employees, taskTypes, factories, editingTask, prefilledData, onClose, onSuccess, onUpdate }: any) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const isEditMode = !!editingTask;
  
  const [formData, setFormData] = useState({
    task_name: editingTask?.task_name || '',
    task_type: editingTask?.task_type || '',
    custom_task_type: '',
    task_location: editingTask?.task_location || '',
    assigned_employee_id: editingTask?.assigned_employee_id || prefilledData?.employeeId || '',
    start_date: editingTask?.start_date || prefilledData?.date || '',
    end_date: editingTask?.end_date || prefilledData?.date || '',
    time_slot: (editingTask?.time_slot || 'FULL_DAY') as 'AM' | 'PM' | 'FULL_DAY',
    notes: editingTask?.notes || '',
  });
  const [showCustomType, setShowCustomType] = useState(false);

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const task: any = await supabaseService.createTask(data);
      
      // 如果是 Site PS 为其他员工创建任务，发送通知
      if (currentUser && task.assigned_employee_id && task.assigned_employee_id !== currentUser.id) {
        const assignedEmployee = employees.find((emp: any) => emp.id === task.assigned_employee_id);
        if (assignedEmployee) {
          await supabaseService.createScheduleNotification({
            task_id: task.id,
            affected_employee_id: assignedEmployee.id,
            modified_by_employee_id: currentUser.id,
            notification_type: 'CREATED',
            change_description: `创建任务：${task.task_name}（${task.start_date} - ${task.end_date}）`,
          });
        }
      }
      
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskType = showCustomType ? formData.custom_task_type : formData.task_type;
    const taskData = {
      task_name: formData.task_name,
      task_type: taskType,
      task_location: formData.task_location,
      assigned_employee_id: formData.assigned_employee_id || null,
      start_date: formData.start_date,
      end_date: formData.end_date,
      time_slot: formData.time_slot,
      notes: formData.notes,
      source: 'manual',
      status: 'active',
    };
    
    if (isEditMode && onUpdate) {
      // 编辑模式：更新任务
      onUpdate(editingTask.id, taskData);
    } else {
      // 新建模式：创建任务
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
              required
              value={formData.task_name}
              onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入任务名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务类型 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {!showCustomType ? (
                <>
                  <select
                    required
                    value={formData.task_type}
                    onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择...</option>
                    {taskTypes.map((type: any) => (
                      <option key={type.id} value={type.code}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCustomType(true)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    自定义
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    required
                    value={formData.custom_task_type}
                    onChange={(e) => setFormData({ ...formData, custom_task_type: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入自定义类型"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomType(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              任务地点 <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.task_location}
              onChange={(e) => setFormData({ ...formData, task_location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择...</option>
              {factories.map((factory: any) => (
                <option key={factory.id} value={factory.code}>
                  {factory.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              分配工程师
            </label>
            <select
              value={formData.assigned_employee_id}
              onChange={(e) => setFormData({ ...formData, assigned_employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">未分配</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} - {emp.departments?.name || '无部门'}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
