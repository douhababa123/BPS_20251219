import { ChevronDown, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationBell } from './NotificationPanel';
import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { currentUser, logout, isSitePS, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = () => {
    if (isAdmin) return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Admin</span>;
    if (isSitePS) return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Site PS</span>;
    return null;
  };

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* 通知铃铛 */}
        <NotificationBell />

        {/* 用户菜单 */}
        <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <User className="w-5 h-5 text-gray-600" />
          <div className="flex flex-col items-start">
            <span className="font-medium text-gray-700 text-sm">
              {currentUser?.name || '未登录'}
            </span>
            {getRoleBadge()}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            {/* 用户信息 */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{currentUser?.name}</p>
              <p className="text-xs text-gray-500">{currentUser?.employee_id}</p>
              <p className="text-xs text-gray-500">{currentUser?.email}</p>
            </div>

            {/* 权限信息 */}
            {(isSitePS || isAdmin) && (
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <Shield className="w-3 h-3" />
                  <span>管理员权限</span>
                </div>
              </div>
            )}

            {/* 退出登录 */}
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-red-50 transition-colors text-red-600 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
