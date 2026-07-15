import { useCallback, useLayoutEffect, useRef } from 'react';
import { getTimeSlotLabel, getTimeSlotColor } from './TimeSlotSelector';
import { getCompetenceConfig } from '../lib/taskTypeConfig';
import type { TimeSlot } from '../lib/database.types';
import { cn } from '../lib/utils';
import type { ContinuousTaskSegmentMeta } from '../lib/scheduleRules';

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

export interface TaskCardTask {
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
}

interface TaskCardProps {
  task: TaskCardTask;
  onClick?: () => void;
  className?: string;
  showEmployee?: boolean;
  segmentMeta?: ContinuousTaskSegmentMeta;
  continuousHeight?: number;
  onContinuousHeightChange?: (groupId: string, height: number) => void;
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
export function TaskCardCompact({
  task,
  onClick,
  segmentMeta,
  continuousHeight,
  onContinuousHeightChange,
}: TaskCardProps) {
  const timeSlot = task.time_slot || 'FULL_DAY';
  const timeSlotLabel = getTimeSlotLabel(timeSlot);
  const competenceConfig = getCompetenceConfig(task.competence);
  const statusConfig = getTaskStatusConfig(task.status);

  // 根据能力域hex色生成半透明背景和边框
  const hexColor = competenceConfig.color;
  const borderStyle = hexColor === '#808080' ? '#666666' : hexColor;
  const textColor = getReadableTextColor(hexColor);

  // 生成 tooltip 内容
  const displayHours = segmentMeta?.continuousHours ?? task.total_hours ?? 0;
  const showLabel = segmentMeta?.showLabel ?? true;
  const isConnected = !!segmentMeta && segmentMeta.position !== 'single';
  const contentRef = useRef<HTMLDivElement>(null);
  const tooltipContent = `${task.task_name}
类型: ${task.task_type}
能力域: ${competenceConfig.label}
状态: ${statusConfig.label}
时间: ${timeSlotLabel} (${displayHours}h)
日期: ${task.start_date} ~ ${task.end_date}`;

  const reportNaturalHeight = useCallback(() => {
    if (!isConnected || !segmentMeta?.showLabel || !contentRef.current || !onContinuousHeightChange) {
      return;
    }
    const contentHeight = Math.ceil(contentRef.current.getBoundingClientRect().height);
    onContinuousHeightChange(segmentMeta.groupId, Math.max(26, contentHeight + 10));
  }, [isConnected, onContinuousHeightChange, segmentMeta]);

  useLayoutEffect(() => {
    reportNaturalHeight();
    window.addEventListener('resize', reportNaturalHeight);
    const observer = contentRef.current && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(reportNaturalHeight)
      : null;
    if (contentRef.current) observer?.observe(contentRef.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reportNaturalHeight);
    };
  }, [reportNaturalHeight]);

  const segmentClasses = segmentMeta && segmentMeta.position !== 'single'
    ? {
        start: 'rounded-r-none border-r-0',
        middle: 'rounded-none border-l-0 border-r-0 ml-[-5px]',
        end: 'rounded-l-none border-l-0 ml-[-5px]',
      }[segmentMeta.position]
    : '';
  const connectedWidth = segmentMeta && segmentMeta.position !== 'single'
    ? segmentMeta.position === 'middle'
      ? 'calc(100% + 10px)'
      : 'calc(100% + 5px)'
    : undefined;

  return (
    <div
      onClick={onClick}
      title={tooltipContent}
      data-segment-position={segmentMeta?.position || 'single'}
      data-continuous-group={segmentMeta?.groupId}
      style={{
        backgroundColor: hexColor,
        borderColor: borderStyle,
        color: textColor,
        height: isConnected && continuousHeight ? continuousHeight : undefined,
        minHeight: 26,
        width: connectedWidth,
      }}
      className={cn(
        'w-full box-border px-2 py-1 mb-1 rounded text-xs cursor-pointer transition-all hover:shadow-md border group',
        segmentClasses,
      )}
    >
      {showLabel && (
        <div ref={contentRef} data-task-card-content>
          <div className="whitespace-normal break-words font-medium leading-tight group-hover:font-semibold">
            {task.task_name}
          </div>
          <div
            data-testid="task-card-metadata"
            className="mt-1 whitespace-normal break-words text-[9px] leading-tight opacity-80"
          >
            {!isConnected && `${timeSlotLabel} · `}
            {displayHours > 0 && `${displayHours}h · `}
            {statusConfig.icon} {statusConfig.label}
          </div>
        </div>
      )}
    </div>
  );
}
