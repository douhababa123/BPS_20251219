/**
 * 任务匹配 API 服务
 * Task Matching API Service - 连接SQL Server后端
 */

import { apiClient } from './api-client';
import type { MatchingRequest, MatchingCandidate } from './types';

export interface Module {
  id: number;
  name: string;
}

export interface Skill {
  id: number;
  moduleId: number;
  moduleName: string;
  name: string;
  code: string;
  isKeyDefault: boolean;
}

export interface AssignmentRequest {
  taskName: string;
  employeeId: string;
  taskType: string;
  location: string;
  startDate: string;
  endDate: string;
  required: Array<{
    skill_id: number;
    required_level: number;
    is_key: boolean;
  }>;
  notes?: string;
}

export const matchingApi = {
  /**
   * 获取所有能力模块
   */
  getModules: async (): Promise<Module[]> => {
    const response = await apiClient.get<Module[]>('/matching/modules');
    return response.data;
  },

  /**
   * 获取技能列表（可按模块筛选）
   */
  getSkills: async (moduleId?: number): Promise<Skill[]> => {
    const params = moduleId ? { module_id: moduleId } : {};
    const response = await apiClient.get<Skill[]>('/matching/skills', { params });
    return response.data;
  },

  /**
   * 预览任务匹配结果
   */
  previewMatching: async (request: MatchingRequest): Promise<MatchingCandidate[]> => {
    // 转换前端格式到后端格式
    const backendRequest = {
      name: request.name,
      role: request.role,
      moduleId: request.moduleId,
      type: request.type,
      location: request.location,
      topic: request.topic,
      startDate: request.startDate,
      endDate: request.endDate,
      required: request.required.map(item => ({
        skill_id: item.itemId,
        required_level: item.requiredLevel,
        is_key: item.isKey
      })),
      suggestedUserId: request.suggestedUserId
    };

    const response = await apiClient.post<MatchingCandidate[]>('/matching/preview', backendRequest);
    return response.data;
  },

  /**
   * 确认任务分配
   */
  assignTask: async (assignment: AssignmentRequest) => {
    const response = await apiClient.post('/matching/assign', assignment);
    return response.data;
  },

  /**
   * 获取匹配历史记录
   */
  getMatchingHistory: async (limit: number = 20) => {
    const response = await apiClient.get('/matching/history', {
      params: { limit }
    });
    return response.data;
  }
};
