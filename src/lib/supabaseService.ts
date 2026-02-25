// @ts-nocheck - 遗留 Supabase 代码，已迁移到 SQL Server，跳过类型检查
import { supabase } from './supabase';
import type { 
  Department, DepartmentInsert,
  Employee, EmployeeInsert,
  Skill, SkillInsert,
  CompetencyAssessment, CompetencyAssessmentInsert,
  AssessmentFull,
  EmployeeGap,
  SkillGap,
  DepartmentGap,
  MatrixRow,
  MatrixColumn,
  MatrixFilters,
  AssessmentStats
} from './database.types';

/**
 * Supabase数据服务层（重构版）
 * 适配新的4张表结构：departments, employees, skills, competency_assessments
 */
export const supabaseService = {
  // ==================== 部门管理 ====================
  
  /**
   * 获取所有部门
   */
  async getAllDepartments(): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) throw new Error(`获取部门失败: ${error.message}`);
    return data || [];
  },

  /**
   * 批量插入/更新部门
   */
  async upsertDepartments(departments: DepartmentInsert[]): Promise<{ success: boolean; count: number }> {
    const { data, error } = await supabase
      .from('departments')
      .upsert(departments, { onConflict: 'name' })
      .select();

    if (error) throw new Error(`保存部门失败: ${error.message}`);
    return { success: true, count: data?.length || 0 };
  },

  // ==================== 员工管理 ====================
  
  /**
   * 获取所有员工
   */
  async getAllEmployees(): Promise<Employee[]> {
    const { data, error} = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`获取员工失败: ${error.message}`);
    return data || [];
  },

  /**
   * 创建新员工
   */
  async createEmployee(employeeData: {
    employee_id: string;
    name: string;
    email: string;
    auth_user_id: string;
    position?: string | null;
    department_id?: number | null;
    is_active?: boolean;
  }): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('employees')
        .insert({
          ...employeeData,
          is_active: employeeData.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || '创建员工失败') };
    }
  },

  /**
   * 根据部门ID获取员工
   */
  async getEmployeesByDepartment(departmentId: number): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(`获取部门员工失败: ${error.message}`);
    return data || [];
  },

  /**
   * 批量插入/更新员工
   */
  async upsertEmployees(employees: EmployeeInsert[]): Promise<{ success: boolean; count: number }> {
    const { data, error } = await supabase
      .from('employees')
      .upsert(employees, { onConflict: 'employee_id' })
      .select();

    if (error) throw new Error(`保存员工失败: ${error.message}`);
    return { success: true, count: data?.length || 0 };
  },

  // ==================== 技能管理 ====================
  
  /**
   * 获取所有技能
   */
  async getAllSkills(): Promise<Skill[]> {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw new Error(`获取技能失败: ${error.message}`);
    return data || [];
  },

  /**
   * 根据模块ID获取技能
   */
  async getSkillsByModule(moduleId: number): Promise<Skill[]> {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('module_id', moduleId)
      .eq('is_active', true)
      .order('display_order');

    if (error) throw new Error(`获取模块技能失败: ${error.message}`);
    return data || [];
  },

  /**
   * 批量插入/更新技能
   */
  async upsertSkills(skills: SkillInsert[]): Promise<{ success: boolean; count: number }> {
    try {
      // 使用数据库的唯一约束 (module_id, skill_name) 进行upsert
      // 如果技能已存在（相同module_id和skill_name），则更新；否则插入
      const { data, error } = await supabase
        .from('skills')
        .upsert(skills, { onConflict: 'module_id,skill_name' })
        .select();

      if (error) {
        console.error('❌ 保存技能失败:', error);
        throw error;
      }

      console.log(`✅ 成功保存 ${data?.length || 0} 个技能到数据库`);
      return { success: true, count: data?.length || 0 };
    } catch (error: any) {
      throw new Error(`保存技能失败: ${error.message}`);
    }
  },

  // ==================== 能力评估管理 ====================
  
  /**
   * 获取所有评估数据（直接查询表，不使用视图）
   */
  async getAllAssessments(year?: number): Promise<AssessmentFull[]> {
    try {
      console.log('📊 开始获取评估数据...', year ? `年份: ${year}` : '所有年份');
      
      let query = supabase
        .from('competency_assessments')
        .select(`
          id,
          employee_id,
          skill_id,
          current_level,
          target_level,
          gap,
          assessment_year,
          assessment_date,
          notes,
          created_at,
          updated_at,
          employees!inner (
            id,
            employee_id,
            name,
            department_id,
            departments (
              id,
              name,
              code
            )
          ),
          skills!inner (
            id,
            module_id,
            module_name,
            skill_name,
            display_order
          )
        `);

      if (year) {
        query = query.eq('assessment_year', year);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ 获取评估数据失败:', error);
        throw error;
      }

      console.log(`✅ 成功获取 ${data?.length || 0} 条评估数据`);

      // 转换数据结构为 AssessmentFull 格式
      const assessments: AssessmentFull[] = (data || []).map((item: any) => ({
        id: item.id,
        employee_id: item.employees.id,
        employee_code: item.employees.employee_id,
        employee_name: item.employees.name,
        department_name: item.employees.departments?.name || '',
        department_code: item.employees.departments?.code || '',
        skill_id: item.skill_id,
        module_id: item.skills.module_id,
        module_name: item.skills.module_name,
        skill_name: item.skills.skill_name,
        display_order: item.skills.display_order,
        current_level: item.current_level,
        target_level: item.target_level,
        gap: item.gap,
        assessment_year: item.assessment_year,
        assessment_date: item.assessment_date,
        notes: item.notes,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      return assessments;
    } catch (error: any) {
      console.error('❌ 获取评估数据失败:', error);
      throw new Error(`获取评估数据失败: ${error.message}`);
    }
  },

  /**
   * 批量插入/更新评估数据（覆盖模式）
   */
  async upsertAssessments(
    assessments: CompetencyAssessmentInsert[],
    clearExisting = true
  ): Promise<{ success: boolean; count: number }> {
    try {
      // 如果需要清空现有数据
      if (clearExisting) {
        const { error: deleteError } = await supabase
          .from('competency_assessments')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) throw deleteError;
      }

      // 插入新数据
      const { data, error } = await supabase
        .from('competency_assessments')
        .upsert(assessments)
        .select();

      if (error) throw error;
      return { success: true, count: data?.length || 0 };
    } catch (error: any) {
      throw new Error(`保存评估数据失败: ${error.message}`);
    }
  },

  // ==================== 统计查询 ====================
  
  /**
   * 获取员工Gap统计
   */
  async getEmployeeGaps(year?: number): Promise<EmployeeGap[]> {
    let query = supabase.from('view_employee_gaps').select('*');
    
    if (year) {
      query = query.eq('assessment_year', year);
    }

    const { data, error } = await query;

    if (error) throw new Error(`获取员工Gap统计失败: ${error.message}`);
    return data || [];
  },

  /**
   * 获取技能Gap统计
   */
  async getSkillGaps(year?: number): Promise<SkillGap[]> {
    let query = supabase.from('view_skill_gaps').select('*');
    
    if (year) {
      query = query.eq('assessment_year', year);
    }

    const { data, error } = await query;

    if (error) throw new Error(`获取技能Gap统计失败: ${error.message}`);
    return data || [];
  },

  /**
   * 获取部门Gap统计
   */
  async getDepartmentGaps(year?: number): Promise<DepartmentGap[]> {
    let query = supabase.from('view_department_gaps').select('*');
    
    if (year) {
      query = query.eq('assessment_year', year);
    }

    const { data, error } = await query;

    if (error) throw new Error(`获取部门Gap统计失败: ${error.message}`);
    return data || [];
  },

  /**
   * 获取总体统计数据
   */
  async getOverallStats(year?: number): Promise<AssessmentStats> {
    const currentYear = year || new Date().getFullYear();

    // 并行查询所有统计数据
    const [employees, skills, assessments] = await Promise.all([
      this.getAllEmployees(),
      this.getAllSkills(),
      this.getAllAssessments(currentYear),
    ]);

    // 计算统计指标
    const totalGapScore = assessments.reduce((sum, a) => sum + a.gap, 0);
    const avgCurrent = assessments.length > 0
      ? assessments.reduce((sum, a) => sum + a.current_level, 0) / assessments.length
      : 0;
    const avgTarget = assessments.length > 0
      ? assessments.reduce((sum, a) => sum + a.target_level, 0) / assessments.length
      : 0;
    const avgGap = assessments.length > 0
      ? assessments.reduce((sum, a) => sum + a.gap, 0) / assessments.length
      : 0;

    return {
      totalEmployees: employees.length,
      totalSkills: skills.length,
      totalAssessments: assessments.length,
      avgCurrentLevel: Math.round(avgCurrent * 100) / 100,
      avgTargetLevel: Math.round(avgTarget * 100) / 100,
      avgGap: Math.round(avgGap * 100) / 100,
      totalGapScore,
    };
  },

  // ==================== 矩阵视图数据 ====================
  
  /**
   * 获取矩阵视图数据
   * @param filters 筛选条件
   * @returns 矩阵数据（行=员工，列=技能）
   */
  async getMatrixData(filters?: MatrixFilters): Promise<{
    rows: MatrixRow[];
    columns: MatrixColumn[];
    stats: AssessmentStats;
  }> {
    try {
      console.log('🔍 开始获取矩阵数据...', filters);
      const year = filters?.year || new Date().getFullYear();

      // 1. 获取所有员工
      console.log('1️⃣ 获取员工数据...');
      let employeesQuery = supabase
        .from('employees')
        .select('id, employee_id, name, department_id, departments(name)')
        .eq('is_active', true)
        .order('name');

      const { data: employeesData, error: employeesError } = await employeesQuery;
      if (employeesError) {
        console.error('❌ 获取员工失败:', employeesError);
        throw new Error(`获取员工失败: ${employeesError.message}`);
      }
      console.log(`✅ 获取到 ${employeesData?.length || 0} 个员工`);

      // 2. 获取所有技能
      console.log('2️⃣ 获取技能数据...');
      let skillsQuery = supabase
        .from('skills')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (filters?.moduleIds && filters.moduleIds.length > 0) {
        skillsQuery = skillsQuery.in('module_id', filters.moduleIds);
      }

      const { data: skillsData, error: skillsError } = await skillsQuery;
      if (skillsError) {
        console.error('❌ 获取技能失败:', skillsError);
        throw new Error(`获取技能失败: ${skillsError.message}`);
      }
      console.log(`✅ 获取到 ${skillsData?.length || 0} 个技能`);

      // 3. 获取所有评估数据
      console.log('3️⃣ 获取评估数据...');
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('competency_assessments')
        .select('*')
        .eq('assessment_year', year);

      if (assessmentsError) {
        console.error('❌ 获取评估数据失败:', assessmentsError);
        throw new Error(`获取评估数据失败: ${assessmentsError.message}`);
      }
      console.log(`✅ 获取到 ${assessmentsData?.length || 0} 条评估数据`);

      // 4. 构建矩阵数据结构
      console.log('4️⃣ 构建矩阵结构...');
      const employees = employeesData || [];
      const skills = skillsData || [];
      const assessments = assessmentsData || [];

      // 按部门筛选
      let filteredEmployees = employees;
      if (filters?.departments && filters.departments.length > 0) {
        filteredEmployees = employees.filter(e => 
          e.departments && filters.departments?.includes((e.departments as any).name)
        );
      }

    // 构建员工行数据
    const rows: MatrixRow[] = filteredEmployees.map(emp => {
      const empAssessments = assessments.filter(a => a.employee_id === emp.id);
      const skillsMap: Record<number, any> = {};

      empAssessments.forEach(assessment => {
        skillsMap[assessment.skill_id] = {
          skillId: assessment.skill_id,
          currentLevel: assessment.current_level,
          targetLevel: assessment.target_level,
          gap: assessment.gap,
        };
      });

      return {
        employeeId: emp.id,
        employeeCode: emp.employee_id,
        employeeName: emp.name,
        departmentName: emp.departments ? (emp.departments as any).name : null,
        skills: skillsMap,
      };
    });

      // 构建列定义
      const columns: MatrixColumn[] = skills.map(skill => ({
        skillId: skill.id,
        moduleId: skill.module_id,
        moduleName: skill.module_name,
        skillName: skill.skill_name,
        displayOrder: skill.display_order,
      }));

      // 计算统计数据
      console.log('5️⃣ 计算统计数据...');
      const stats = await this.getOverallStats(year);

      console.log('✅ 矩阵数据构建完成！', {
        rows: rows.length,
        columns: columns.length,
        stats,
      });

      return { rows, columns, stats };
    } catch (error: any) {
      console.error('❌ 获取矩阵数据失败:', error);
      throw new Error(`获取矩阵数据失败: ${error.message}`);
    }
  },

  // ==================== 数据导入辅助 ====================
  
  /**
   * 从Excel数据导入（完整流程）
   * @param parsedData 解析后的Excel数据
   */
  async importFromExcel(parsedData: {
    departments: string[];
    employees: Array<{ employee_id: string; name: string; department: string }>;
    skills: SkillInsert[];
    assessments: Array<{
      employee_id: string;
      skill_name: string;
      module_name: string;
      current_level: number;
      target_level: number;
    }>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 导入部门
      const deptInserts: DepartmentInsert[] = parsedData.departments.map(name => ({
        name,
        code: name,
      }));
      await this.upsertDepartments(deptInserts);

      // 重新获取部门以获取ID
      const departments = await this.getAllDepartments();
      const deptMap = new Map(departments.map(d => [d.name, d.id]));

      // 2. 导入员工
      const empInserts: EmployeeInsert[] = parsedData.employees.map(emp => ({
        employee_id: emp.employee_id,
        name: emp.name,
        department_id: deptMap.get(emp.department) || null,
      }));
      await this.upsertEmployees(empInserts);

      // 重新获取员工以获取UUID
      const employees = await this.getAllEmployees();
      const empMap = new Map(employees.map(e => [e.employee_id, e.id]));

      // 3. 导入技能
      await this.upsertSkills(parsedData.skills);

      // 重新获取技能以获取ID
      const skills = await this.getAllSkills();
      const skillMap = new Map(
        skills.map(s => [`${s.module_name}-${s.skill_name}`, s.id])
      );

      // 4. 导入评估数据
      const assessmentInserts: CompetencyAssessmentInsert[] = [];
      
      for (const assessment of parsedData.assessments) {
        const employeeId = empMap.get(assessment.employee_id);
        const skillId = skillMap.get(`${assessment.module_name}-${assessment.skill_name}`);

        if (employeeId && skillId) {
          assessmentInserts.push({
            employee_id: employeeId,
            skill_id: skillId,
            current_level: assessment.current_level,
            target_level: assessment.target_level,
          });
        }
      }

      const result = await this.upsertAssessments(assessmentInserts, true);

      return {
        success: true,
        message: `成功导入 ${result.count} 条评估记录`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `导入失败: ${error.message}`,
      };
    }
  },

  // ==================== 测试连接 ====================
  
  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error} = await supabase.from('departments').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  },

  // ==================== 日程管理 ====================
  
  /**
   * 获取所有任务类型
   */
  async getAllTaskTypes() {
    const { data, error } = await supabase
      .from('task_types')
      .select('*')
      .eq('is_active', true)
      .order('is_system', { ascending: false })
      .order('name');

    if (error) throw new Error(`获取任务类型失败: ${error.message}`);
    return data || [];
  },

  /**
   * 创建自定义任务类型
   */
  async createTaskType(taskType: { code: string; name: string; color_hex: string }) {
    const { data, error } = await supabase
      .from('task_types')
      .insert({ ...taskType, is_system: false })
      .select()
      .single();

    if (error) throw new Error(`创建任务类型失败: ${error.message}`);
    return data;
  },

  /**
   * 获取所有工厂/地点
   */
  async getAllFactories() {
    const { data, error } = await supabase
      .from('factories')
      .select('*')
      .eq('is_active', true)
      .order('code');

    if (error) throw new Error(`获取工厂列表失败: ${error.message}`);
    return data || [];
  },

  /**
   * 获取所有任务
   */
  async getAllTasks(filters?: {
    start_date?: string;
    end_date?: string;
    employee_id?: string;
    status?: string;
  }) {
    console.log('🔍 supabaseService.getAllTasks 调用参数:', filters);
    
    // 先测试简单查询（不带关联）
    try {
      const { data: simpleData, error: simpleError } = await supabase
        .from('tasks')
        .select('*')
        .limit(5);
      
      console.log('🧪 简单查询测试:', {
        成功: !simpleError,
        错误: simpleError,
        数据量: simpleData?.length || 0,
        示例: simpleData?.[0]
      });
    } catch (e) {
      console.error('🧪 简单查询失败:', e);
    }
    
    // 先尝试不带嵌套 departments 的查询
    let query = supabase
      .from('tasks')
      .select(`
        *,
        employees:assigned_employee_id (
          id,
          employee_id,
          name,
          department_id
        )
      `)
      .order('start_date', { ascending: false });
    
    console.log('📝 使用简化的关联查询（不包含 departments 嵌套）');

    if (filters?.start_date) {
      console.log('  ✓ 添加过滤: end_date >=', filters.start_date);
      query = query.gte('end_date', filters.start_date);
    }
    if (filters?.end_date) {
      console.log('  ✓ 添加过滤: start_date <=', filters.end_date);
      query = query.lte('start_date', filters.end_date);
    }
    if (filters?.employee_id) {
      console.log('  ✓ 添加过滤: assigned_employee_id =', filters.employee_id);
      query = query.eq('assigned_employee_id', filters.employee_id);
    }
    if (filters?.status) {
      const statusValues = filters.status === 'active'
        ? ['active', null]
        : [filters.status];
      console.log('  ✓ 添加过滤: status in', statusValues);
      query = query.in('status', statusValues);
    }

    console.log('⏳ 正在执行 Supabase 查询...');
    const { data, error } = await query;
    console.log('⏹️ Supabase 查询完成', { 有数据: !!data, 数据量: data?.length, 有错误: !!error });

    if (error) {
      console.error('❌ Supabase 查询错误:', error);
      console.error('   错误详情:', JSON.stringify(error, null, 2));
      console.log('🔄 由于错误，将使用回退查询...');
      // 不要抛出错误，而是继续执行回退逻辑
    }
    
    console.log('✅ Supabase 返回原始数据:', data?.length, '条记录');
    if (data && data.length > 0) {
      console.log('   第一条原始记录:', data[0]);
    } else {
      console.warn('⚠️ 查询返回 0 条记录或有错误');
    }
    
    // 如果关联查询失败或有错误，回退到简单查询并手动关联
    if (error || !data || data.length === 0) {
      console.log('🔄 尝试回退查询（无关联）...');
      let simpleQuery = supabase
        .from('tasks')
        .select('*')
        .order('start_date', { ascending: false });
      
      // 应用相同的过滤条件
      if (filters?.start_date) {
        simpleQuery = simpleQuery.gte('end_date', filters.start_date);
      }
      if (filters?.end_date) {
        simpleQuery = simpleQuery.lte('start_date', filters.end_date);
      }
      if (filters?.employee_id) {
        simpleQuery = simpleQuery.eq('assigned_employee_id', filters.employee_id);
      }
      if (filters?.status) {
        const statusValues = filters.status === 'active' ? ['active', null] : [filters.status];
        simpleQuery = simpleQuery.in('status', statusValues);
      }
      
      const { data: simpleTasks, error: simpleError } = await simpleQuery;
      
      if (simpleError) {
        throw new Error(`简单查询也失败: ${simpleError.message}`);
      }
      
      console.log('✅ 回退查询成功:', simpleTasks?.length, '条');
      
      // 手动查询员工信息
      const employeeIds = [...new Set(simpleTasks?.map(t => t.assigned_employee_id).filter(Boolean))];
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, employee_id, name, department_id')
        .in('id', employeeIds);
      
      const employeesMap = new Map(employeesData?.map(e => [e.id, e]));
      
      return (simpleTasks || []).map((task: any) => {
        const employee = employeesMap.get(task.assigned_employee_id);
        return {
          ...task,
          employees: employee,
          employee_code: employee?.employee_id,
          employee_name: employee?.name,
        };
      });
    }
    
    // 转换数据格式
    const result = (data || []).map((task: any) => ({
      ...task,
      employee_code: task.employees?.employee_id,
      employee_name: task.employees?.name,
      department_name: task.employees?.departments?.name,
      department_code: task.employees?.departments?.code,
    }));
    
    console.log('📦 转换后数据:', result.length, '条记录');
    
    return result;
  },

  /**
   * 创建任务
   */
  async createTask(task: any) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single();

    if (error) throw new Error(`创建任务失败: ${error.message}`);
    return data;
  },

  /**
   * 更新任务
   */
  async updateTask(id: string, updates: any) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`更新任务失败: ${error.message}`);
    return data;
  },

  /**
   * 删除任务
   */
  async deleteTask(id: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`删除任务失败: ${error.message}`);
    return { success: true };
  },

  /**
   * 计算工程师饱和度（按周）
   */
  async calculateSaturationByWeek(year: number, month: number, employeeIds?: string[]) {
    // 获取该月的所有任务
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active')
      .gte('start_date', startDate)
      .lte('start_date', endDate);

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('assigned_employee_id', employeeIds);
    }

    const { data: tasks, error } = await query;

    if (error) throw new Error(`计算饱和度失败: ${error.message}`);

    // 按周聚合
    const weeklyStats = new Map();
    
    (tasks || []).forEach((task: any) => {
      const startDate = new Date(task.start_date);
      const weekNum = Math.ceil(startDate.getDate() / 7);
      const key = `Week ${weekNum}`;
      
      const existing = weeklyStats.get(key) || { label: key, total_hours: 0 };
      existing.total_hours += task.total_hours || 0;
      weeklyStats.set(key, existing);
    });

    return Array.from(weeklyStats.values());
  },

  /**
   * 获取任务类型统计
   */
  async getTaskTypeStats(startDate: string, endDate: string, employeeIds?: string[]) {
    let query = supabase
      .from('tasks')
      .select('task_type, total_hours')
      .eq('status', 'active')
      .gte('start_date', startDate)
      .lte('end_date', endDate);

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('assigned_employee_id', employeeIds);
    }

    const { data, error } = await query;

    if (error) throw new Error(`获取任务类型统计失败: ${error.message}`);

    // 聚合统计
    const statsMap = new Map();
    let totalHours = 0;

    (data || []).forEach((task: any) => {
      const existing = statsMap.get(task.task_type) || { 
        task_type: task.task_type, 
        count: 0, 
        total_hours: 0 
      };
      existing.count += 1;
      existing.total_hours += task.total_hours || 0;
      totalHours += task.total_hours || 0;
      statsMap.set(task.task_type, existing);
    });

    // 计算百分比
    return Array.from(statsMap.values()).map(stat => ({
      ...stat,
      percentage: totalHours > 0 ? (stat.total_hours / totalHours) * 100 : 0,
    }));
  },

  /**
   * 获取任务地点统计
   */
  async getTaskLocationStats(startDate: string, endDate: string, employeeIds?: string[]) {
    let query = supabase
      .from('tasks')
      .select('task_location, total_hours')
      .eq('status', 'active')
      .gte('start_date', startDate)
      .lte('end_date', endDate);

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('assigned_employee_id', employeeIds);
    }

    const { data, error } = await query;

    if (error) throw new Error(`获取任务地点统计失败: ${error.message}`);

    // 聚合统计
    const statsMap = new Map();
    let totalHours = 0;

    (data || []).forEach((task: any) => {
      const existing = statsMap.get(task.task_location) || { 
        location: task.task_location, 
        count: 0, 
        total_hours: 0 
      };
      existing.count += 1;
      existing.total_hours += task.total_hours || 0;
      totalHours += task.total_hours || 0;
      statsMap.set(task.task_location, existing);
    });

    // 计算百分比
    return Array.from(statsMap.values()).map(stat => ({
      ...stat,
      percentage: totalHours > 0 ? (stat.total_hours / totalHours) * 100 : 0,
    }));
  },

  // ==================== 资源规划管理 ====================

  /**
   * 获取所有资源任务类型
   */
  async getAllResourceTaskTypes() {
    const { data, error } = await supabase
      .from('resource_task_types')
      .select('*')
      .eq('is_active', true)
      .order('code');

    if (error) throw new Error(`获取资源任务类型失败: ${error.message}`);
    return data || [];
  },

  /**
   * 创建资源任务类型
   */
  async createResourceTaskType(taskType: {
    code: string;
    name: string;
    color_hex: string;
    description?: string;
  }) {
    const { data, error } = await supabase
      .from('resource_task_types')
      .insert([taskType])
      .select()
      .single();

    if (error) throw new Error(`创建资源任务类型失败: ${error.message}`);
    return data;
  },

  /**
   * 批量导入资源规划任务（旧版本：按周）
   */
  async batchImportResourceTasks(tasks: Array<{
    employee_id: string;
    task_type_code: string;
    start_week: string;
    end_week: string;
    start_date: string;
    end_date: string;
    topic?: string;
    location?: string;
    notes?: string;
    import_batch_id: string;
    source_file_name: string;
  }>) {
    const { data, error } = await supabase
      .from('resource_planning_tasks')
      .insert(tasks)
      .select();

    if (error) throw new Error(`批量导入任务失败: ${error.message}`);
    return data || [];
  },

  /**
   * 批量导入资源规划任务（V2版本：按天）
   */
  async batchImportResourceTasksDaily(tasks: Array<{
    employee_id: string;
    task_date: string;
    year_month: string;
    cw_week: string;
    day_of_month: number;
    topic: string;
    task_type: string;
    task_type_code?: string;
    location: string;
    start_week?: string;  // 兼容旧字段
    end_week?: string;    // 兼容旧字段
    start_date?: string;  // 兼容旧字段
    end_date?: string;    // 兼容旧字段
    import_batch_id: string;
    source_file_name: string;
  }>) {
    console.log('💾 开始批量插入数据库，任务数:', tasks.length);

    const { data, error } = await supabase
      .from('resource_planning_tasks')
      .insert(tasks)
      .select();

    if (error) {
      console.error('❌ 数据库插入失败:', error);
      throw new Error(`批量导入任务失败: ${error.message}`);
    }

    console.log('✅ 数据库插入成功，返回记录数:', data?.length || 0);
    return data || [];
  },

  /**
   * 获取资源规划任务（最新版本）
   * @param filters 筛选条件
   */
  async getResourcePlanningTasks(filters?: {
    employeeIds?: string[];
    departmentIds?: number[];
    startDate?: string;
    endDate?: string;
    taskTypeCodes?: string[];
  }) {
    let query = supabase
      .from('view_resource_planning_latest')
      .select('*');

    if (filters?.employeeIds && filters.employeeIds.length > 0) {
      query = query.in('employee_id', filters.employeeIds);
    }

    if (filters?.startDate) {
      query = query.gte('end_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('start_date', filters.endDate);
    }

    if (filters?.taskTypeCodes && filters.taskTypeCodes.length > 0) {
      query = query.in('task_type_code', filters.taskTypeCodes);
    }

    query = query.order('employee_name').order('start_date');

    const { data, error } = await query;

    if (error) throw new Error(`获取资源规划任务失败: ${error.message}`);
    return data || [];
  },

  /**
   * 获取指定员工的资源规划任务（最新版本）
   */
  async getEmployeeResourceTasks(employeeId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('view_resource_planning_latest')
      .select('*')
      .eq('employee_id', employeeId);

    if (startDate) {
      query = query.gte('end_date', startDate);
    }

    if (endDate) {
      query = query.lte('start_date', endDate);
    }

    query = query.order('start_date');

    const { data, error } = await query;

    if (error) throw new Error(`获取员工资源规划任务失败: ${error.message}`);
    return data || [];
  },

  /**
   * 获取所有导入批次
   */
  async getImportBatches() {
    const { data, error } = await supabase
      .from('resource_planning_tasks')
      .select('import_batch_id, source_file_name, imported_at')
      .not('import_batch_id', 'is', null)
      .order('imported_at', { ascending: false });

    if (error) throw new Error(`获取导入批次失败: ${error.message}`);

    // 去重并统计
    const batchMap = new Map();
    (data || []).forEach((item: any) => {
      if (!batchMap.has(item.import_batch_id)) {
        batchMap.set(item.import_batch_id, {
          batchId: item.import_batch_id,
          fileName: item.source_file_name,
          importedAt: item.imported_at,
          count: 0,
        });
      }
      const batch = batchMap.get(item.import_batch_id);
      batch.count += 1;
    });

    return Array.from(batchMap.values());
  },

  /**
   * 周数转日期（CW格式）
   * @param weekStr 周数字符串，如 "CW23"
   * @param year 年份，默认当前年
   */
  weekToDate(weekStr: string, year: number = new Date().getFullYear()): string {
    // 提取周数
    const weekNum = parseInt(weekStr.replace('CW', ''));
    
    // 获取该年1月4日（ISO 8601规定包含1月4日的周为第1周）
    const jan4 = new Date(year, 0, 4);
    
    // 计算该年第1周的周一
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    
    // 计算目标周的周一
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
    
    // 返回YYYY-MM-DD格式
    return targetMonday.toISOString().split('T')[0];
  },

  /**
   * 周数范围转日期范围
   * @param startWeek 开始周，如 "CW23"
   * @param endWeek 结束周，如 "CW25"
   * @param year 年份，默认当前年
   */
  weekRangeToDateRange(startWeek: string, endWeek: string, year: number = new Date().getFullYear()): {
    startDate: string;
    endDate: string;
  } {
    const startDate = this.weekToDate(startWeek, year);
    const endWeekDate = this.weekToDate(endWeek, year);
    
    // 结束日期为该周的周日（+6天）
    const endDateObj = new Date(endWeekDate);
    endDateObj.setDate(endDateObj.getDate() + 6);
    const endDate = endDateObj.toISOString().split('T')[0];
    
    return { startDate, endDate };
  },

  /**
   * 计算任务跨越的周数
   * @param startWeek 开始周
   * @param endWeek 结束周
   */
  calculateWeekSpan(startWeek: string, endWeek: string): number {
    const startNum = parseInt(startWeek.replace('CW', ''));
    const endNum = parseInt(endWeek.replace('CW', ''));
    return endNum - startNum + 1;
  },

  /**
   * 删除指定批次的任务
   * @param batchId 批次ID
   */
  async deleteImportBatch(batchId: string) {
    const { error } = await supabase
      .from('resource_planning_tasks')
      .delete()
      .eq('import_batch_id', batchId);

    if (error) throw new Error(`删除导入批次失败: ${error.message}`);
  },

  // ==================== 通知管理 ====================

  /**
   * 创建日程修改通知
   */
  async createScheduleNotification(notification: {
    task_id: string;
    affected_employee_id: string;
    modified_by_employee_id: string;
    notification_type: 'CREATED' | 'UPDATED' | 'DELETED';
    change_description?: string;
  }) {
    const { data, error } = await supabase
      .from('schedule_change_notifications')
      .insert(notification as any) // 类型断言：数据库表存在但TypeScript定义不完整
      .select()
      .single();

    if (error) throw new Error(`创建通知失败: ${error.message}`);
    return data;
  },

  /**
   * 获取用户的未读通知
   */
  async getUnreadNotifications(employeeId: string) {
    const { data, error } = await supabase
      .from('schedule_change_notifications')
      .select(`
        *,
        task:tasks(*),
        affected_employee:employees!affected_employee_id(*),
        modified_by:employees!modified_by_employee_id(*)
      `)
      .eq('affected_employee_id', employeeId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`获取通知失败: ${error.message}`);
    return data || [];
  },

  /**
   * 获取所有通知（包括已读）
   */
  async getAllNotifications(employeeId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('schedule_change_notifications')
      .select(`
        *,
        task:tasks(*),
        affected_employee:employees!affected_employee_id(*),
        modified_by:employees!modified_by_employee_id(*)
      `)
      .eq('affected_employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`获取通知失败: ${error.message}`);
    return data || [];
  },

  /**
   * 标记通知为已读
   */
  async markNotificationAsRead(notificationId: string) {
    const { error } = await supabase
      .from('schedule_change_notifications')
      .update({ is_read: true } as any) // 类型断言：数据库表存在但TypeScript定义不完整
      .eq('id', notificationId);

    if (error) throw new Error(`标记通知失败: ${error.message}`);
  },

  /**
   * 批量标记通知为已读
   */
  async markAllNotificationsAsRead(employeeId: string) {
    const { error } = await supabase
      .from('schedule_change_notifications')
      .update({ is_read: true } as any) // 类型断言：数据库表存在但TypeScript定义不完整
      .eq('affected_employee_id', employeeId)
      .eq('is_read', false);

    if (error) throw new Error(`批量标记通知失败: ${error.message}`);
  },

  /**
   * 获取未读通知数量
   */
  async getUnreadNotificationCount(employeeId: string): Promise<number> {
    const { count, error } = await supabase
      .from('schedule_change_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('affected_employee_id', employeeId)
      .eq('is_read', false);

    if (error) throw new Error(`获取未读通知数量失败: ${error.message}`);
    return count || 0;
  },
};
