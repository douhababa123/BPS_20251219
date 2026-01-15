import { getTimeSlotLabel, getTimeSlotColor } from './TimeSlotSelector';
import { getTaskTypeConfig } from '../lib/taskTypeConfig';
import type { TimeSlot } from '../lib/database.types';
import { cn } from '../lib/utils';

interface TaskCardProps {
  task: {
    id: string;
    task_name: string;
    task_type: string;
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

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-2 rounded-lg border cursor-pointer transition-all hover:shadow-md',
        'bg-white hover:bg-gray-50',
        className
      )}
    >
      {/* 时间槽标识 */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium border',
            timeSlotColorClass
          )}
        >
          {timeSlotLabel}
        </span>
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
  const taskTypeConfig = getTaskTypeConfig(task.task_type);

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
时间: ${timeSlotLabel} (${task.total_hours || 0}h)
日期: ${task.start_date} ~ ${task.end_date}`;

  return (
    <div
      onClick={onClick}
      title={tooltipContent}
      className={cn(
        'px-2 py-1 mb-1 rounded text-xs cursor-pointer transition-all hover:shadow-md hover:scale-105 border group',
        taskTypeConfig.bgColor,
        taskTypeConfig.borderColor,
        taskTypeConfig.color
      )}
    >
      <div className="flex items-center gap-1">
        {/* 任务类型图标 */}
        <span className="flex-shrink-0 text-sm">{taskTypeConfig.icon}</span>
        
        {/* 任务名称 */}
        <span className="truncate flex-1 font-medium group-hover:font-semibold">
          {task.task_name}
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

