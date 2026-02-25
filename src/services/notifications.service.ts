/**
 * 通知服务
 */

import axios from 'axios';
import type { NotificationListResponse } from '@/types/api';

const API_BASE = 'http://localhost:8000/api';

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const notificationsService = {
  /** 获取通知列表（含未读数） */
  async getAll(): Promise<NotificationListResponse> {
    const res = await axios.get(`${API_BASE}/notifications/`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /** 标记单条已读 */
  async markRead(id: string): Promise<void> {
    await axios.post(`${API_BASE}/notifications/${id}/read`, {}, {
      headers: authHeaders(),
    });
  },

  /** 标记全部已读 */
  async markAllRead(): Promise<void> {
    await axios.post(`${API_BASE}/notifications/read-all`, {}, {
      headers: authHeaders(),
    });
  },
};

export default notificationsService;
