import { Sun, Sunset, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import type { TimeSlot } from '../lib/database.types';

interface TimeSlotSelectorProps {
  value: TimeSlot;
  onChange: (value: TimeSlot) => void;
  disabled?: boolean;
  className?: string;
}

export function TimeSlotSelector({ value, onChange, disabled = false, className }: TimeSlotSelectorProps) {
  const options: Array<{ value: TimeSlot; label: string; hours: string; icon: typeof Sun }> = [
    { value: 'AM', label: '上午', hours: '3.5h', icon: Sun },
    { value: 'PM', label: '下午', hours: '4.5h', icon: Sunset },
    { value: 'FULL_DAY', label: '全天', hours: '8h', icon: Clock },
  ];

  return (
    <div className={cn('flex gap-2', className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 transition-all',
              'hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              isSelected
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              disabled && 'opacity-50 cursor-not-allowed hover:border-gray-200 hover:bg-white'
            )}
          >
            <Icon className={cn('w-5 h-5', isSelected ? 'text-blue-600' : 'text-gray-400')} />
            <span className="font-medium text-sm">{option.label}</span>
            <span className={cn('text-xs', isSelected ? 'text-blue-600' : 'text-gray-500')}>
              {option.hours}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// 辅助函数：根据时间槽计算工时
export function getHoursByTimeSlot(timeSlot: TimeSlot, days: number = 1): number {
  const hoursPerSlot: Record<TimeSlot, number> = {
    AM: 3.5,
    PM: 4.5,
    FULL_DAY: 8,
  };
  return hoursPerSlot[timeSlot] * days;
}

// 辅助函数：获取时间槽的显示标签
export function getTimeSlotLabel(timeSlot: TimeSlot): string {
  const labels: Record<TimeSlot, string> = {
    AM: '上午',
    PM: '下午',
    FULL_DAY: '全天',
  };
  return labels[timeSlot];
}

// 辅助函数：获取时间槽的颜色类（用于任务卡片）
export function getTimeSlotColor(timeSlot: TimeSlot): string {
  const colors: Record<TimeSlot, string> = {
    AM: 'bg-amber-100 text-amber-700 border-amber-300',
    PM: 'bg-orange-100 text-orange-700 border-orange-300',
    FULL_DAY: 'bg-blue-100 text-blue-700 border-blue-300',
  };
  return colors[timeSlot];
}

