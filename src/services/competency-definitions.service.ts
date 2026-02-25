/**
 * 能力定义服务
 */

import { BaseService } from './base.service';
import type {
  CompetencyDefinition,
  CompetencyDefinitionCreate,
  CompetencyDefinitionUpdate,
} from '@/types/api';

class CompetencyDefinitionsService extends BaseService<
  CompetencyDefinition,
  CompetencyDefinitionCreate,
  CompetencyDefinitionUpdate
> {
  constructor() {
    super('/competency-definitions');
  }
}

export const competencyDefinitionsService = new CompetencyDefinitionsService();
export default competencyDefinitionsService;
