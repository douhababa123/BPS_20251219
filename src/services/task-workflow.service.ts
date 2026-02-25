/**
 * 任务审批工作流 API 服务
 */

import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
    const res = await axios.post(`${API_BASE}/matching/assign`, data, {
      headers: authHeaders(),
    });
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
    const res = await axios.post(`${API_BASE}/matching/force-assign`, data, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /** admin 审批通过 */
  async approve(taskId: string) {
    const res = await axios.post(`${API_BASE}/tasks/${taskId}/approve`, {}, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /** admin 拒绝 */
  async reject(taskId: string, rejectionReason: string) {
    const res = await axios.post(`${API_BASE}/tasks/${taskId}/reject`, { rejection_reason: rejectionReason }, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /** 工程师确认接受 */
  async confirm(taskId: string) {
    const res = await axios.post(`${API_BASE}/tasks/${taskId}/confirm`, {}, {
      headers: authHeaders(),
    });
    return res.data;
  },

  /** 工程师拒绝 */
  async employeeReject(taskId: string, rejectionReason: string) {
    const res = await axios.post(`${API_BASE}/tasks/${taskId}/employee-reject`, { rejection_reason: rejectionReason }, {
      headers: authHeaders(),
    });
    return res.data;
  },
};

export default taskWorkflowService;
