import { supabase } from './supabase';
import type { Database } from './database.types';

type CompetencyDefinition = Database['public']['Tables']['competency_definitions']['Row'];
type CompetencyDefinitionInsert = Database['public']['Tables']['competency_definitions']['Insert'];
type CompetencyAssessment = Database['public']['Tables']['competency_assessments']['Row'];
type CompetencyAssessmentInsert = Database['public']['Tables']['competency_assessments']['Insert'];

/**
 * Supabase数据服务层
 * 封装所有数据库操作，提供统一的API接口
 */
export const supabaseService = {
  // ==================== 能力定义表操作 ====================
  
  /**
   * 获取所有能力定义
   */
  async getAllCompetencyDefinitions(): Promise<CompetencyDefinition[]> {
    const { data, error } = await supabase
      .from('competency_definitions')
      .select('*')
      .order('module_id', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching competency definitions:', error);
      throw new Error(`获取能力定义失败: ${error.message}`);
    }

    return data || [];
  },

  /**
   * 批量插入能力定义（覆盖模式）
   * @param definitions 能力定义数组
   * @param clearExisting 是否清空现有数据（默认true）
   */
  async upsertCompetencyDefinitions(
    definitions: CompetencyDefinitionInsert[],
    clearExisting = true
  ): Promise<{ success: boolean; count: number }> {
    try {
      // 第一步：如果需要，清空现有数据
      if (clearExisting) {
        const { error: deleteError } = await supabase
          .from('competency_definitions')
          .delete()
          .neq('id', 0); // 删除所有记录

        if (deleteError) {
          throw new Error(`清空数据失败: ${deleteError.message}`);
        }
      }

      // 第二步：批量插入新数据
      const { data, error: insertError } = await supabase
        .from('competency_definitions')
        .insert(definitions)
        .select();

      if (insertError) {
        throw new Error(`插入数据失败: ${insertError.message}`);
      }

      return {
        success: true,
        count: data?.length || 0,
      };
    } catch (error) {
      console.error('Error upserting competency definitions:', error);
      throw error;
    }
  },

  // ==================== 能力评估表操作 ====================

  /**
   * 获取所有能力评估
   */
  async getAllCompetencyAssessments(): Promise<CompetencyAssessment[]> {
    const { data, error } = await supabase
      .from('competency_assessments')
      .select('*')
      .order('engineer_name', { ascending: true })
      .order('module_name', { ascending: true });

    if (error) {
      console.error('Error fetching competency assessments:', error);
      throw new Error(`获取能力评估失败: ${error.message}`);
    }

    return data || [];
  },

  /**
   * 根据工程师姓名获取评估
   */
  async getAssessmentsByEngineer(engineerName: string): Promise<CompetencyAssessment[]> {
    const { data, error } = await supabase
      .from('competency_assessments')
      .select('*')
      .eq('engineer_name', engineerName)
      .order('module_name', { ascending: true });

    if (error) {
      console.error('Error fetching assessments by engineer:', error);
      throw new Error(`获取工程师评估失败: ${error.message}`);
    }

    return data || [];
  },

  /**
   * 根据部门获取评估
   */
  async getAssessmentsByDepartment(department: string): Promise<CompetencyAssessment[]> {
    const { data, error } = await supabase
      .from('competency_assessments')
      .select('*')
      .eq('department', department)
      .order('engineer_name', { ascending: true });

    if (error) {
      console.error('Error fetching assessments by department:', error);
      throw new Error(`获取部门评估失败: ${error.message}`);
    }

    return data || [];
  },

  /**
   * 批量插入能力评估（覆盖模式）
   * @param assessments 能力评估数组
   * @param clearExisting 是否清空现有数据（默认true）
   */
  async upsertCompetencyAssessments(
    assessments: CompetencyAssessmentInsert[],
    clearExisting = true
  ): Promise<{ success: boolean; count: number }> {
    try {
      // 第一步：如果需要，清空现有数据
      if (clearExisting) {
        const { error: deleteError } = await supabase
          .from('competency_assessments')
          .delete()
          .neq('id', 0); // 删除所有记录

        if (deleteError) {
          throw new Error(`清空数据失败: ${deleteError.message}`);
        }
      }

      // 第二步：批量插入新数据
      const { data, error: insertError } = await supabase
        .from('competency_assessments')
        .insert(assessments)
        .select();

      if (insertError) {
        throw new Error(`插入数据失败: ${insertError.message}`);
      }

      return {
        success: true,
        count: data?.length || 0,
      };
    } catch (error) {
      console.error('Error upserting competency assessments:', error);
      throw error;
    }
  },

  /**
   * 获取统计数据
   */
  async getStatistics(): Promise<{
    totalEngineers: number;
    totalAssessments: number;
    avgCurrentScore: number;
    avgTargetScore: number;
    avgGap: number;
    criticalGaps: number;
  }> {
    const assessments = await this.getAllCompetencyAssessments();

    if (assessments.length === 0) {
      return {
        totalEngineers: 0,
        totalAssessments: 0,
        avgCurrentScore: 0,
        avgTargetScore: 0,
        avgGap: 0,
        criticalGaps: 0,
      };
    }

    const uniqueEngineers = new Set(assessments.map(a => a.engineer_name));
    const totalCurrent = assessments.reduce((sum, a) => sum + a.current_score, 0);
    const totalTarget = assessments.reduce((sum, a) => sum + a.target_score, 0);
    const totalGap = assessments.reduce((sum, a) => sum + a.gap, 0);
    const criticalGaps = assessments.filter(a => a.gap >= 2).length;

    return {
      totalEngineers: uniqueEngineers.size,
      totalAssessments: assessments.length,
      avgCurrentScore: Math.round((totalCurrent / assessments.length) * 10) / 10,
      avgTargetScore: Math.round((totalTarget / assessments.length) * 10) / 10,
      avgGap: Math.round((totalGap / assessments.length) * 10) / 10,
      criticalGaps,
    };
  },

  // ==================== 测试连接 ====================

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('competency_definitions')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  },
};

// 导出类型供其他文件使用
export type {
  CompetencyDefinition,
  CompetencyDefinitionInsert,
  CompetencyAssessment,
  CompetencyAssessmentInsert,
};
