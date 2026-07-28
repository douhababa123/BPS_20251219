/**
 * 任务服务
 */

import { BaseService } from './base.service';
import { apiClient } from '@/lib/api-client';
import type { Task, TaskCreate, TaskUpdate } from '@/types/api';

export type TaskExecutionStatus = 'confirmed' | 'in_progress' | 'completed';

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

  async updateExecutionStatus(id: string, status: TaskExecutionStatus): Promise<Task> {
    const response = await apiClient.put<Task>(`${this.endpoint}/${id}/execution-status`, { status });
    return response.data;
  }
}

export const tasksService = new TasksService();
export default tasksService;
