import { getTimeSlotLabel, getTimeSlotColor } from './TimeSlotSelector';
import { getCompetenceConfig } from '../lib/taskTypeConfig';
import type { TimeSlot } from '../lib/database.types';
import { cn } from '../lib/utils';

// 任务状态配置
const TASK_STATUS_CONFIG = {
  planned: { label: '计划中', icon: '📋', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: '进行中', icon: '⚡', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  completed: { label: '已完成', icon: '✅', color: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: '已取消', icon: '❌', color: 'bg-red-50 text-red-700 border-red-200' },
  pending_approval: { label: '待审批', icon: '⏳', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  rejected: { label: '已拒绝', icon: '🚫', color: 'bg-red-50 text-red-600 border-red-200' },
  confirmed: { label: '已确认', icon: '🎉', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  employee_rejected: { label: '工程师拒绝', icon: '⚠️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

// 获取任务状态配置
const getTaskStatusConfig = (status?: string) => {
  if (!status || !(status in TASK_STATUS_CONFIG)) {
    return TASK_STATUS_CONFIG.planned;
  }
  return TASK_STATUS_CONFIG[status as keyof typeof TASK_STATUS_CONFIG];
};

const getReadableTextColor = (hexColor: string) => {
  const normalized = hexColor.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '#111827';
  }

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const linear = [r, g, b].map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];

  return luminance > 0.45 ? '#111827' : '#FFFFFF';
};

interface TaskCardProps {
  task: {
    id: string;
    task_name: string;
    task_type: string;
    competence?: string;
    status?: 'planned' | 'in_progress' | 'completed' | 'cancelled'
           | 'pending_approval' | 'rejected' | 'confirmed' | 'employee_rejected';
    time_slot?: TimeSlot;
    total_hours?: number;
    employee_name?: string;
    start_date?: string;
    end_date?: string;
  };
  onClick?: () => void;
  className?: string;
  showEmployee?: boolean;
}

export function TaskCard({ task, onClick, className, showEmployee = false }: TaskCardProps) {
  const timeSlot = task.time_slot || 'FULL_DAY';
  const timeSlotLabel = getTimeSlotLabel(timeSlot);
  const timeSlotColorClass = getTimeSlotColor(timeSlot);
  const statusConfig = getTaskStatusConfig(task.status);
  const competenceConfig = getCompetenceConfig(task.competence);

  return (
    <div
      onClick={onClick}
      style={{
        borderLeftColor: competenceConfig.color,
        borderLeftWidth: 4,
      }}
      className={cn(
        'p-2 rounded-lg border cursor-pointer transition-all hover:shadow-md',
        'bg-white hover:bg-gray-50',
        className
      )}
    >
      {/* 时间槽和状态标识 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium border',
              timeSlotColorClass
            )}
          >
            {timeSlotLabel}
          </span>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium border',
              statusConfig.color
            )}
          >
            {statusConfig.icon} {statusConfig.label}
          </span>
        </div>
        {task.total_hours && (
          <span className="text-xs text-gray-500">
            {task.total_hours}h
          </span>
        )}
      </div>

      {/* 任务名称 */}
      <div className="font-medium text-sm text-gray-900 truncate">
        {task.task_name}
      </div>

      {/* 任务类型 */}
      <div className="text-xs text-gray-600 mt-1">
        {task.task_type}
      </div>

      <div className="flex items-center gap-1 mt-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: competenceConfig.color }}
        />
        <span className="text-xs text-gray-500 truncate">
          {competenceConfig.label}
        </span>
      </div>

      {/* 员工姓名（可选） */}
      {showEmployee && task.employee_name && (
        <div className="text-xs text-gray-500 mt-1 truncate">
          👤 {task.employee_name}
        </div>
      )}
    </div>
  );
}

// 任务卡片紧凑版（用于日历格子中）
export function TaskCardCompact({ task, onClick }: TaskCardProps) {
  const timeSlot = task.time_slot || 'FULL_DAY';
  const timeSlotLabel = getTimeSlotLabel(timeSlot);
  const competenceConfig = getCompetenceConfig(task.competence);
  const statusConfig = getTaskStatusConfig(task.status);

  // 根据能力域hex色生成半透明背景和边框
  const hexColor = competenceConfig.color;
  const borderStyle = hexColor === '#808080' ? '#666666' : hexColor;
  const textColor = getReadableTextColor(hexColor);

  // 根据时间槽显示不同的标记
  const getTimeIcon = () => {
    switch (timeSlot) {
      case 'AM':
        return '🌅'; // 上午
      case 'PM':
        return '🌆'; // 下午
      default:
        return null; // 全天不显示额外图标
    }
  };

  // 生成 tooltip 内容
  const tooltipContent = `${task.task_name}
类型: ${task.task_type}
能力域: ${competenceConfig.label}
状态: ${statusConfig.label}
时间: ${timeSlotLabel} (${task.total_hours || 0}h)
日期: ${task.start_date} ~ ${task.end_date}`;

  return (
    <div
      onClick={onClick}
      title={tooltipContent}
      style={{
        backgroundColor: hexColor,
        borderColor: borderStyle,
        color: textColor,
      }}
      className="px-2 py-1 mb-1 rounded text-xs cursor-pointer transition-all hover:shadow-md hover:scale-105 border group"
    >
      <div className="flex items-center gap-1">
        {/* 任务类型首字母 */}
        <span className="flex-shrink-0 font-bold text-[10px] opacity-80">{task.task_type.charAt(0)}</span>
        
        {/* 任务名称 */}
        <span className="truncate flex-1 font-medium group-hover:font-semibold">
          {task.task_name}
        </span>
        
        {/* 状态图标 */}
        <span className="flex-shrink-0 text-[10px]" title={statusConfig.label}>
          {statusConfig.icon}
        </span>
        
        {/* 时间槽标记（仅半天任务显示） */}
        {getTimeIcon() && (
          <span className="flex-shrink-0 text-[10px]">{getTimeIcon()}</span>
        )}
        
        {/* 工时 */}
        {task.total_hours && (
          <span className="flex-shrink-0 text-[10px] opacity-70 font-semibold">
            {task.total_hours}h
          </span>
        )}
      </div>
    </div>
  );
}
