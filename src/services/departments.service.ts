/**
 * 部门服务
 */

import { BaseService } from './base.service';
import type { Department, DepartmentCreate, DepartmentUpdate } from '@/types/api';

class DepartmentsService extends BaseService<Department, DepartmentCreate, DepartmentUpdate> {
  constructor() {
    super('/departments');
  }
}

export const departmentsService = new DepartmentsService();
export default departmentsService;
