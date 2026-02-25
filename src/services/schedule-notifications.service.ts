/**
 * 计划变更通知服务
 */

import { BaseService } from './base.service';
import type {
  ScheduleChangeNotification,
  ScheduleChangeNotificationCreate,
  ScheduleChangeNotificationUpdate,
} from '@/types/api';

class ScheduleNotificationsService extends BaseService<
  ScheduleChangeNotification,
  ScheduleChangeNotificationCreate,
  ScheduleChangeNotificationUpdate
> {
  constructor() {
    super('/notifications');
  }

  /**
   * 获取通知列表（支持过滤）
   */
  async getNotifications(params?: {
    employee_id?: string;
    is_read?: boolean;
  }): Promise<ScheduleChangeNotification[]> {
    return this.getAll(params);
  }
}

export const scheduleNotificationsService = new ScheduleNotificationsService();
export default scheduleNotificationsService;
