import { LayoutDashboard, Calendar, Target, Award, BarChart3, FileSpreadsheet } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: '总览' },
  { id: 'schedule', icon: Calendar, label: '日程管理' },
  { id: 'competency', icon: Award, label: '能力画像' },
  { id: 'assessment', icon: BarChart3, label: '能力评估' },
  { id: 'matching', icon: Target, label: '任务分配' },
  { id: 'importNew', icon: FileSpreadsheet, label: '数据导入' },
];

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-lg font-bold text-blue-900">BPS 能力与排程平台</h1>
        <p className="text-xs text-gray-500 mt-1">BPS Capacity & Scheduling</p>
      </div>

      <nav className="flex-1 p-4">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1',
              currentPage === item.id
                ? 'bg-blue-900 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
