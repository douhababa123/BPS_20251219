import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseService } from '../lib/supabaseService';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { cn } from '../lib/utils';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notification-count', currentUser?.id],
    queryFn: () => supabaseService.getUnreadNotificationCount(currentUser!.id),
    enabled: !!currentUser,
    refetchInterval: 30000, // 每30秒刷新一次
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: () => supabaseService.getAllNotifications(currentUser!.id, 20),
    enabled: !!currentUser && isOpen,
  });

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    try {
      await supabaseService.markAllNotificationsAsRead(currentUser.id);
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      console.error('标记全部已读失败:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await supabaseService.markNotificationAsRead(notificationId);
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
  notification: any;
  onMarkAsRead: (id: string) => void;
}) {
  const getNotificationIcon = () => {
    switch (notification.notification_type) {
      case 'CREATED':
        return '✨';
      case 'UPDATED':
        return '✏️';
      case 'DELETED':
        return '🗑️';
      default:
        return '📝';
    }
  };

  const getNotificationMessage = () => {
    const modifierName = notification.modified_by?.name || '管理员';
    const taskName = notification.task?.task_name || '任务';
    
    switch (notification.notification_type) {
      case 'CREATED':
        return `${modifierName} 为您创建了新任务：${taskName}`;
      case 'UPDATED':
        return `${modifierName} 修改了您的任务：${taskName}`;
      case 'DELETED':
        return `${modifierName} 删除了您的任务：${taskName}`;
      default:
        return `${modifierName} 修改了您的日程`;
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
          <p className="text-sm text-gray-900 font-medium">
            {getNotificationMessage()}
          </p>
          {notification.change_description && (
            <p className="text-xs text-gray-600 mt-1">
              {notification.change_description}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formatTime(notification.created_at)}
          </p>
        </div>
        {!notification.is_read && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            className="text-blue-600 hover:text-blue-700"
            title="标记为已读"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

