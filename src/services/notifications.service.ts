/**
 * 通知服务
 */

import { apiClient } from '../lib/api-client';
import type { NotificationListResponse } from '@/types/api';

export const notificationsService = {
  /** 获取通知列表（含未读数） */
  async getAll(): Promise<NotificationListResponse> {
    const res = await apiClient.get<NotificationListResponse>('/notifications/');
    return res.data;
  },

  /** 标记单条已读 */
  async markRead(id: string): Promise<void> {
    await apiClient.post(`/notifications/${id}/read`, {});
  },

  /** 标记全部已读 */
  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all', {});
  },
};

export default notificationsService;
