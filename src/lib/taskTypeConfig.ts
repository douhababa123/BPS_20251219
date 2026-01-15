// 任务类型配置：颜色和图标
export const TASK_TYPE_CONFIG: Record<string, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  icon: string; 
  label: string;
}> = {
  'coaching': {
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    icon: '👨‍🏫',
    label: 'Coaching',
  },
  'leave': {
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '🏖️',
    label: 'Leave',
  },
  'meeting': {
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    icon: '📅',
    label: 'Meeting',
  },
  'project': {
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    icon: '🚀',
    label: 'Project',
  },
  'self-develop': {
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    borderColor: 'border-indigo-300',
    icon: '📚',
    label: 'Self-develop',
  },
  'speed_week': {
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
    icon: '⚡',
    label: 'Speed week',
  },
  'training': {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
    icon: '🎓',
    label: 'Training',
  },
  'workshop': {
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    icon: '🔧',
    label: 'Workshop',
  },
};

// 获取任务类型配置（带默认值）
export function getTaskTypeConfig(taskType: string) {
  const normalizedType = taskType?.toLowerCase().replace(/\s+/g, '_') || '';
  return TASK_TYPE_CONFIG[normalizedType] || {
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    icon: '📋',
    label: taskType || 'Unknown',
  };
}




