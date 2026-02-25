import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications.service';
import { useNewAuth } from '../contexts/NewAuthContext';
import { Bell, CheckCheck, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Notification } from '../types/api';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useNewAuth();
  const queryClient = useQueryClient();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-all', user?.id],
    queryFn: () => notificationsService.getAll(),
    enabled: !!user,
    refetchInterval: 30000, // 每30秒刷新一次
  });

  const unreadCount = notifData?.unread_count ?? 0;
  const notifications: Notification[] = notifData?.notifications ?? [];

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      await notificationsService.markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
    } catch (error) {
      console.error('标记全部已读失败:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsService.markRead(notificationId);
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 通知面板 */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                通知 ({unreadCount} 条未读)
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                    全部已读
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 通知列表 */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>暂无通知</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification: any) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'task_submitted': return '📋';
      case 'task_approved': return '✅';
      case 'task_rejected': return '❌';
      case 'task_confirmed': return '🎉';
      case 'task_employee_rejected': return '⚠️';
      default: return '📝';
    }
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return time.toLocaleDateString('zh-CN');
  };

  return (
    <div
      className={cn(
        'p-4 hover:bg-gray-50 transition-colors cursor-pointer',
        !notification.is_read && 'bg-blue-50'
      )}
      onClick={() => !notification.is_read && onMarkAsRead(notification.id)}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{getNotificationIcon()}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 font-medium">{notification.title}</p>
          <p className="text-xs text-gray-600 mt-1">{notification.body}</p>
          <p className="text-xs text-gray-500 mt-1">
            {notification.created_at ? formatTime(notification.created_at) : ''}
          </p>
        </div>
        {!notification.is_read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 shrink-0" />
        )}
      </div>
    </div>
  );
}
