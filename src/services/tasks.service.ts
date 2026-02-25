/**
 * 任务服务
 */

import { BaseService } from './base.service';
import type { Task, TaskCreate, TaskUpdate } from '@/types/api';

class TasksService extends BaseService<Task, TaskCreate, TaskUpdate> {
  constructor() {
    super('/tasks');
  }

  /**
   * 获取任务列表（支持过滤）
   */
  async getTasks(params?: {
    employee_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Task[]> {
    return this.getAll(params);
  }
}

export const tasksService = new TasksService();
export default tasksService;
