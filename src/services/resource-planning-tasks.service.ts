/**
 * 资源规划任务服务
 */

import { BaseService } from './base.service';
import type {
  ResourcePlanningTask,
  ResourcePlanningTaskCreate,
  ResourcePlanningTaskUpdate,
} from '@/types/api';

class ResourcePlanningTasksService extends BaseService<
  ResourcePlanningTask,
  ResourcePlanningTaskCreate,
  ResourcePlanningTaskUpdate
> {
  constructor() {
    super('/resource-planning-tasks');
  }

  /**
   * 获取资源规划任务（支持过滤）
   */
  async getTasks(params?: {
    employee_id?: string;
    year?: number;
    week_number?: number;
  }): Promise<ResourcePlanningTask[]> {
    return this.getAll(params);
  }
}

export const resourcePlanningTasksService = new ResourcePlanningTasksService();
export default resourcePlanningTasksService;
