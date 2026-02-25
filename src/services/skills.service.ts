/**
 * 技能服务
 */

import { BaseService } from './base.service';
import type { Skill, SkillCreate, SkillUpdate } from '@/types/api';

class SkillsService extends BaseService<Skill, SkillCreate, SkillUpdate> {
  constructor() {
    super('/skills');
  }
}

export const skillsService = new SkillsService();
export default skillsService;
