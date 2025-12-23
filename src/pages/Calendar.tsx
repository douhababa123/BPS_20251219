import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mockApi } from '../lib/mockApi';
import { TOPICS, TASK_TYPES } from '../lib/constants';
import { cn } from '../lib/utils';
import { Download, BarChart2, PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';
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
} from 'recharts';

export function Calendar() {
  const [selectedUsers, setSelectedUsers] = useState<number[]>([101, 102, 104]);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentMonth] = useState('2025-01');
  const [analysisPeriod, setAnalysisPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: mockApi.getUsers,
  });

  const { data: slots } = useQuery({
    queryKey: ['slots', `${currentMonth}-01`, `${currentMonth}-31`],
    queryFn: () => mockApi.getCalendarSlots(`${currentMonth}-01`, `${currentMonth}-31`),
  });

  const filteredSlots = slots?.filter(s => selectedUsers.includes(s.userId)) || [];

  const getDaysInMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getSlotsForUserDateHalf = (userId: number, day: number, half: 'AM' | 'PM') => {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    return filteredSlots.filter(s => s.userId === userId && s.date === dateStr && s.half === half);
  };

  const exportToCSV = () => {
    const headers = ['User', 'Date', 'Half', 'Type', 'Location', 'Topic', 'Hours', 'Source'];
    const rows = filteredSlots.map(s => {
      const user = users?.find(u => u.id === s.userId);
      return [
        user?.name || '',
        s.date,
        s.half,
        s.type,
        s.location,
        s.topic,
        s.hours,
        s.source,
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-export-${currentMonth}.csv`;
    a.click();
  };

  const totalWorkingHours = selectedUsers.length === 0 ? 0 : selectedUsers.length * daysInMonth * 8;
  const totalBookedHours = filteredSlots.reduce((sum, slot) => sum + slot.hours, 0);

  const calculateSaturation = () => {
    if (totalWorkingHours === 0) return 0;
    return Math.round((totalBookedHours / totalWorkingHours) * 100);
  };

  const saturation = calculateSaturation();
  const saturationColor = saturation < 70 ? 'bg-green-500' : saturation <= 90 ? 'bg-amber-500' : 'bg-red-500';

  const userSaturation = useMemo(() => selectedUsers.map(userId => {
    const user = users?.find(u => u.id === userId);
    const bookings = filteredSlots.filter(slot => slot.userId === userId);
    const hours = bookings.reduce((sum, slot) => sum + slot.hours, 0);
    const saturationRate = Math.min(100, Math.round((hours / (daysInMonth * 8)) * 100));
    const warning = bookings.some(slot => slot.hours >= 8 && slot.source === 'system');
    return {
      userId,
      name: user?.name || `User ${userId}`,
      hours,
      saturation: saturationRate,
      warning,
    };
  }), [selectedUsers, filteredSlots, users, daysInMonth]);

  const highLoadCount = userSaturation.filter(user => user.saturation >= 90).length;
  const mediumLoadCount = userSaturation.filter(user => user.saturation >= 70 && user.saturation < 90).length;

  const typeBreakdown = useMemo(() => {
    return filteredSlots.reduce((acc, slot) => {
      const existing = acc.find(item => item.name === slot.type);
      if (existing) {
        existing.value += slot.hours;
      } else {
        acc.push({ name: slot.type, value: slot.hours });
      }
      return acc;
    }, [] as Array<{ name: string; value: number }>);
  }, [filteredSlots]);

  const locationBreakdown = useMemo(() => {
    return filteredSlots.reduce((acc, slot) => {
      const existing = acc.find(item => item.name === slot.location);
      if (existing) {
        existing.value += slot.hours;
      } else {
        acc.push({ name: slot.location, value: slot.hours });
      }
      return acc;
    }, [] as Array<{ name: string; value: number }>);
  }, [filteredSlots]);

  const weeklySaturation = useMemo(() => {
    if (selectedUsers.length === 0) return [] as Array<{ label: string; saturation: number }>;
    const buckets = new Map<number, { label: string; hours: number }>();
    filteredSlots.forEach(slot => {
      const day = Number(slot.date.split('-')[2]);
      const weekIndex = Math.ceil(day / 7);
      const existing = buckets.get(weekIndex) || { label: `Week ${weekIndex}`, hours: 0 };
      existing.hours += slot.hours;
      buckets.set(weekIndex, existing);
    });
    return Array.from(buckets.values()).map(bucket => ({
      label: bucket.label,
      saturation: Math.round((bucket.hours / (selectedUsers.length * 40)) * 100),
    }));
  }, [filteredSlots, selectedUsers.length]);

  const conflictSlots = useMemo(() => {
    const map = new Map<string, { key: string; date: string; half: string; user: string; tasks: string[] }>();
    filteredSlots.forEach(slot => {
      const key = `${slot.userId}-${slot.date}-${slot.half}`;
      const user = users?.find(u => u.id === slot.userId);
      const record = map.get(key) || { key, date: slot.date, half: slot.half, user: user?.name || `User ${slot.userId}`, tasks: [] };
      record.tasks.push(slot.type);
      map.set(key, record);
    });
    return Array.from(map.values()).filter(item => item.tasks.length > 1).slice(0, 5);
  }, [filteredSlots, users]);

  const legendType = analysisPeriod === 'month' ? '月度' : analysisPeriod === 'quarter' ? '季度' : '年度';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-2">筛选设置 Filter Settings</h3>
            <div className="flex items-center gap-4">
              <div className="flex gap-2 flex-wrap">
                {users?.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUsers(prev =>
                        prev.includes(user.id)
                          ? prev.filter(id => id !== user.id)
                          : [...prev, user.id]
                      );
                    }}
                    className={cn(
                      'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                      selectedUsers.includes(user.id)
                        ? 'bg-blue-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {user.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-900 rounded-xl border border-blue-100">
              <BarChart2 className="w-4 h-4" />
              <span className="text-sm font-semibold">总工时 {totalBookedHours}h / {totalWorkingHours}h</span>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出 Export
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700">团队饱和度 Saturation:</span>
              <span className="text-lg font-bold text-gray-900">{saturation}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className={cn('h-full transition-all', saturationColor)} style={{ width: `${saturation}%` }}></div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'month' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-700'
              )}
            >
              月视图 Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                viewMode === 'week' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-700'
              )}
            >
              周视图 Week
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h4 className="text-lg font-bold text-gray-900 mb-4">资源健康指数 Team Health</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">高负荷 ≥90%</span>
              <span className="text-base font-semibold text-red-600">{highLoadCount} 人</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">关注区域 70-90%</span>
              <span className="text-base font-semibold text-amber-600">{mediumLoadCount} 人</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">可用工时 Available</span>
              <span className="text-base font-semibold text-green-600">{Math.max(totalWorkingHours - totalBookedHours, 0)}h</span>
            </div>
          </div>
        </div>
        <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h4 className="text-lg font-bold text-gray-900 mb-4">未来周度饱和度 Weekly Saturation</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeklySaturation}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 120]} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="saturation" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{currentMonth} 日历 Calendar</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>分析粒度</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['month', 'quarter', 'year'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setAnalysisPeriod(option)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    analysisPeriod === option ? 'bg-blue-900 text-white' : 'bg-white text-gray-600'
                  )}
                >
                  {option === 'month' ? '月度' : option === 'quarter' ? '季度' : '年度'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="min-w-max">
          <div className="grid grid-cols-[150px_repeat(31,80px)] gap-px bg-gray-200 border border-gray-200">
            <div className="bg-white p-2 font-medium text-sm text-gray-700">人员 / 日期</div>
            {days.map(day => (
              <div key={day} className="bg-white p-2 text-center font-medium text-sm text-gray-700">
                {day}
              </div>
            ))}

            {users?.filter(u => selectedUsers.includes(u.id)).map(user => (
              <>
                {['AM', 'PM'].map(half => (
                  <div key={`${user.id}-${half}`} className="contents">
                    <div className="bg-white p-2 text-sm">
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{half}</div>
                    </div>
                    {days.map(day => {
                      const daySlots = getSlotsForUserDateHalf(user.id, day, half as 'AM' | 'PM');
                      const hasConflict = daySlots.length > 1;

                      return (
                        <div
                          key={`${user.id}-${day}-${half}`}
                          className={cn(
                            'bg-white p-1 relative group min-h-[72px]',
                            hasConflict && 'bg-red-50 border border-red-200'
                          )}
                        >
                          {daySlots.map((slot) => {
                            const topic = TOPICS.find(t => t.code === slot.topic);
                            return (
                              <div
                                key={slot.id}
                                className="text-xs p-1 rounded mb-1 relative"
                                style={{ borderLeft: `3px solid ${topic?.colorHex}` }}
                              >
                                <div className="font-medium">{slot.type}</div>
                                {hasConflict && <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>}
                                <div className="opacity-0 group-hover:opacity-100 absolute left-0 top-full mt-1 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10 whitespace-nowrap">
                                  <div>Type: {TASK_TYPES.find(t => t.code === slot.type)?.name}</div>
                                  <div>Location: {slot.location}</div>
                                  <div>Topic: {slot.topic}</div>
                                  <div>Hours: {slot.hours}h</div>
                                  <div>Source: {slot.source}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">任务类型占比 {legendType} Mix</h3>
            <PieChartIcon className="w-4 h-4 text-blue-900" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={typeBreakdown} dataKey="value" nameKey="name" outerRadius={100} label>
                {typeBreakdown.map((_, index) => (
                  <Cell key={`type-${index}`} fill={TOPICS[index % TOPICS.length].colorHex} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}h`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">任务地点占比 Location</h3>
            <PieChartIcon className="w-4 h-4 text-blue-900" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={locationBreakdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `${value}h`} />
              <Bar dataKey="value" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">个人饱和度看板 Personal Saturation</h3>
          <div className="space-y-3">
            {userSaturation.map(user => (
              <div key={user.userId} className="p-3 border border-gray-100 rounded-xl hover:border-blue-200 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.hours}h / {daysInMonth * 8}h</p>
                  </div>
                  <span className={cn(
                    'text-sm font-semibold',
                    user.saturation >= 90 ? 'text-red-600' : user.saturation >= 70 ? 'text-amber-600' : 'text-green-600'
                  )}>
                    {user.saturation}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full',
                      user.saturation >= 90 ? 'bg-red-500' : user.saturation >= 70 ? 'bg-amber-500' : 'bg-green-500'
                    )}
                    style={{ width: `${user.saturation}%` }}
                  ></div>
                </div>
                {user.warning && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    自动录入任务集中，请关注冲突
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">冲突提醒 Conflict Alerts</h3>
          {conflictSlots.length === 0 ? (
            <p className="text-sm text-gray-500">暂无冲突，资源安排合理</p>
          ) : (
            <div className="space-y-3">
              {conflictSlots.map(conflict => (
                <div key={conflict.key} className="p-3 border border-red-200 rounded-xl bg-red-50">
                  <div className="flex items-center justify-between text-sm text-red-700 mb-1">
                    <span>{conflict.user}</span>
                    <span>{conflict.date} {conflict.half}</span>
                  </div>
                  <div className="text-xs text-red-600">冲突任务: {conflict.tasks.join(', ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">主题图例 Topic Legend</h3>
        <div className="flex flex-wrap gap-4">
          {TOPICS.map(topic => (
            <div key={topic.code} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: topic.colorHex }}></div>
              <span className="text-sm text-gray-700">{topic.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
