/**
 * 通知 API 服务
 * 使用 FastAPI 后端 /api/schedule-change-notifications 端点
 */

import apiClient from './api-client';

export interface Notification {
  id: string;
  task_id: string | null;
  affected_employee_id: string;
  modified_by_employee_id: string | null;
  notification_type: 'CREATED' | 'UPDATED' | 'DELETED';
  change_description: string | null;
  is_read: boolean;
  notification_date: string;
  created_at: string;
}

/**
 * 获取用户的未读通知数量
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const response = await apiClient.get<Notification[]>('/schedule-change-notifications', {
      params: {
        employee_id: userId,
        is_read: false
      }
    });
    return response.data.length;
  } catch (error) {
    console.error('获取未读通知数量失败:', error);
    return 0;
  }
}

/**
 * 获取用户的所有通知（限制数量）
 */
export async function getAllNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
  try {
    const response = await apiClient.get<Notification[]>('/schedule-change-notifications', {
      params: {
        employee_id: userId
      }
    });
    // 后端按created_at DESC排序，前端再截取limit数量
    return response.data.slice(0, limit);
  } catch (error) {
    console.error('获取通知列表失败:', error);
    return [];
  }
}

/**
 * 标记单个通知为已读
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await apiClient.put(`/schedule-change-notifications/${notificationId}`, {
      is_read: true
    });
  } catch (error) {
    console.error('标记通知已读失败:', error);
    throw error;
  }
}

/**
 * 标记所有通知为已读（需要后端支持批量更新，当前逐个更新）
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  try {
    // 先获取所有未读通知
    const response = await apiClient.get<Notification[]>('/schedule-change-notifications', {
      params: {
        employee_id: userId,
        is_read: false
      }
    });
    
    // 逐个标记为已读
    await Promise.all(
      response.data.map(notification => 
        markNotificationAsRead(notification.id)
      )
    );
  } catch (error) {
    console.error('标记所有通知已读失败:', error);
    throw error;
  }
}
