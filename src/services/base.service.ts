/**
 * 基础 CRUD 服务类
 * 为所有资源提供通用的 CRUD 操作
 */

import { apiClient } from '@/lib/api-client';
import type { AxiosResponse } from 'axios';

export class BaseService<T, TCreate, TUpdate> {
  protected endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * 获取所有记录
   */
  async getAll(params?: Record<string, any>): Promise<T[]> {
    const response: AxiosResponse<T[]> = await apiClient.get(this.endpoint, { params });
    return response.data;
  }

  /**
   * 根据 ID 获取单个记录
   */
  async getById(id: string | number): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.get(`${this.endpoint}/${id}`);
    return response.data;
  }

  /**
   * 创建新记录
   */
  async create(data: TCreate): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.post(this.endpoint, data);
    return response.data;
  }

  /**
   * 更新记录
   */
  async update(id: string | number, data: TUpdate): Promise<T> {
    const response: AxiosResponse<T> = await apiClient.put(`${this.endpoint}/${id}`, data);
    return response.data;
  }

  /**
   * 删除记录
   */
  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`${this.endpoint}/${id}`);
  }
}

export default BaseService;
