/**
 * 资源任务类型服务
 */

import { BaseService } from './base.service';
import type {
  ResourceTaskType,
  ResourceTaskTypeCreate,
  ResourceTaskTypeUpdate,
} from '@/types/api';

class ResourceTaskTypesService extends BaseService<
  ResourceTaskType,
  ResourceTaskTypeCreate,
  ResourceTaskTypeUpdate
> {
  constructor() {
    super('/resource-task-types');
  }
}

export const resourceTaskTypesService = new ResourceTaskTypesService();
export default resourceTaskTypesService;
