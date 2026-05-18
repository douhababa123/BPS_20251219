/**
 * 任务审批工作流 API 服务
 */

import { apiClient } from '../lib/api-client';

export const taskWorkflowService = {
  /** 提交任务申请（pending_approval） */
  async assign(data: {
    taskName: string;
    employeeId: string;
    taskType: string;
    location: string;
    startDate: string;
    endDate: string;
    notes?: string;
  }) {
    const res = await apiClient.post('/matching/assign', data);
    return res.data;
  },

  /** 强制指派（仅 admin，直接 planned） */
  async forceAssign(data: {
    taskName: string;
    employeeId: string;
    taskType: string;
    location: string;
    startDate: string;
    endDate: string;
    notes?: string;
  }) {
    const res = await apiClient.post('/matching/force-assign', data);
    return res.data;
  },

  /** admin 审批通过 */
  async approve(taskId: string) {
    const res = await apiClient.post(`/tasks/${taskId}/approve`, {});
    return res.data;
  },

  /** admin 拒绝 */
  async reject(taskId: string, rejectionReason: string) {
    const res = await apiClient.post(`/tasks/${taskId}/reject`, { rejection_reason: rejectionReason });
    return res.data;
  },

  /** 工程师确认接受 */
  async confirm(taskId: string) {
    const res = await apiClient.post(`/tasks/${taskId}/confirm`, {});
    return res.data;
  },

  /** 工程师拒绝 */
  async employeeReject(taskId: string, rejectionReason: string) {
    const res = await apiClient.post(`/tasks/${taskId}/employee-reject`, { rejection_reason: rejectionReason });
    return res.data;
  },
};

export default taskWorkflowService;
