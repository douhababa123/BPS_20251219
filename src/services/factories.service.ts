/**
 * 工厂服务
 */

import { BaseService } from './base.service';
import type { Factory, FactoryCreate, FactoryUpdate } from '@/types/api';

class FactoriesService extends BaseService<Factory, FactoryCreate, FactoryUpdate> {
  constructor() {
    super('/factories');
  }
}

export const factoriesService = new FactoriesService();
export default factoriesService;
