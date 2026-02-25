/**
 * 任务类型服务
 */

import { BaseService } from './base.service';
import type { TaskType, TaskTypeCreate, TaskTypeUpdate } from '@/types/api';

class TaskTypesService extends BaseService<TaskType, TaskTypeCreate, TaskTypeUpdate> {
  constructor() {
    super('/task-types');
  }
}

export const taskTypesService = new TaskTypesService();
export default taskTypesService;
