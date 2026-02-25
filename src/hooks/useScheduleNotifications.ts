/**
 * 调度通知 React Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleNotificationsService } from '@/services';
import type { ScheduleChangeNotificationCreate } from '@/types/api';

const SCHEDULE_NOTIFICATIONS_KEY = 'scheduleNotifications';

/**
 * 获取所有调度通知（支持过滤）
 */
export const useScheduleNotifications = (params?: {
  employee_id?: string;
  is_read?: boolean;
}) => {
  return useQuery({
    queryKey: [SCHEDULE_NOTIFICATIONS_KEY, params],
    queryFn: () => scheduleNotificationsService.getNotifications(params),
  });
};

/**
 * 获取单个调度通知
 */
export const useScheduleNotification = (id: string) => {
  return useQuery({
    queryKey: [SCHEDULE_NOTIFICATIONS_KEY, id],
    queryFn: () => scheduleNotificationsService.getById(id),
    enabled: !!id,
  });
};

/**
 * 创建调度通知
 */
export const useCreateScheduleNotification = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ScheduleChangeNotificationCreate) => scheduleNotificationsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCHEDULE_NOTIFICATIONS_KEY] });
    },
  });
};

/**
 * 标记通知为已读
 */
export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => scheduleNotificationsService.update(id, { is_read: true }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [SCHEDULE_NOTIFICATIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: [SCHEDULE_NOTIFICATIONS_KEY, id] });
    },
  });
};

/**
 * 标记所有通知为已读
 */
export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => {
      // 这需要后端提供批量更新的 API
      // 目前先返回一个 Promise
      return Promise.resolve({ message: 'All notifications marked as read' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SCHEDULE_NOTIFICATIONS_KEY] });
    },
  });
};
