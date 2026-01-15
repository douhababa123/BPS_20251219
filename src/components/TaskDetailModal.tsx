import { X, Calendar, Clock, MapPin, User, FileText, Tag } from 'lucide-react';
import { getTimeSlotLabel, getTimeSlotColor } from './TimeSlotSelector';
import { cn } from '../lib/utils';

interface TaskDetailModalProps {
  task: any;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskDetailModal({ task, onClose, onEdit, onDelete }: TaskDetailModalProps) {
  const timeSlot = task.time_slot || 'FULL_DAY';
  const timeSlotLabel = getTimeSlotLabel(timeSlot);
  const timeSlotColorClass = getTimeSlotColor(timeSlot);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* 头部 */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{task.task_name}</h2>
            <span className={cn('inline-block px-3 py-1 rounded-full text-sm font-medium', timeSlotColorClass)}>
              {timeSlotLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 详细信息 */}
        <div className="space-y-4">
          {/* 任务类型 */}
          <div className="flex items-start gap-3">
            <Tag className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-500">任务类型</p>
              <p className="text-base text-gray-900">{task.task_type}</p>
            </div>
          </div>

          {/* 任务地点 */}
          {task.task_location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-500">任务地点</p>
                <p className="text-base text-gray-900">{task.task_location}</p>
              </div>
            </div>
          )}

          {/* 分配工程师 */}
          {task.employee_name && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-500">分配工程师</p>
                <p className="text-base text-gray-900">{task.employee_name}</p>
              </div>
            </div>
          )}

          {/* 日期范围 */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-500">日期范围</p>
              <p className="text-base text-gray-900">
                {task.start_date} ~ {task.end_date}
                {task.days_count && <span className="text-gray-500 ml-2">({task.days_count} 天)</span>}
              </p>
            </div>
          </div>

          {/* 工时信息 */}
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-500">工时信息</p>
              <p className="text-base text-gray-900">
                总工时: {task.total_hours || 0}h
                {task.hours_per_day && <span className="text-gray-500 ml-2">(每天 {task.hours_per_day}h)</span>}
              </p>
            </div>
          </div>

          {/* 备注 */}
          {task.notes && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-500">备注</p>
                <p className="text-base text-gray-900 whitespace-pre-wrap">{task.notes}</p>
              </div>
            </div>
          )}

          {/* 状态 */}
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center mt-0.5">
              <div className={cn(
                "w-3 h-3 rounded-full",
                task.status === 'active' ? 'bg-green-500' :
                task.status === 'completed' ? 'bg-blue-500' :
                task.status === 'cancelled' ? 'bg-red-500' :
                'bg-gray-400'
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">状态</p>
              <p className="text-base text-gray-900 capitalize">{task.status || 'pending'}</p>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              编辑任务
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
            >
              删除任务
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}




