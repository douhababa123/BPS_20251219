/**
 * 员工服务
 */

import { BaseService } from './base.service';
import type { Employee, EmployeeCreate, EmployeeUpdate } from '@/types/api';

class EmployeesService extends BaseService<Employee, EmployeeCreate, EmployeeUpdate> {
  constructor() {
    super('/employees');
  }
}

export const employeesService = new EmployeesService();
export default employeesService;
