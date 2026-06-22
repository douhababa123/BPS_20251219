/**
 * BPS API 客户端 - Axios 配置
 * 
 * 功能：
 * - 统一 API 请求基础配置
 * - JWT Token 自动注入
 * - 401 错误处理（token 过期自动跳转登录）
 * - 错误响应拦截和格式化
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// API 基础地址（从环境变量读取，生产环境用相对路径由 nginx 代理）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');

/**
 * Axios 实例
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器 - 自动添加 JWT Token
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ 请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器 - 处理错误和 Token 过期
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 成功响应直接返回
    return response;
  },
  async (error) => {
    if (error.response) {
      const status = error.response.status;

      // 401 未授权 - Token 过期或无效
      if (status === 401) {
        console.warn('⚠️ Token 过期或无效，清除本地存储并跳转登录');
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_role');
        localStorage.removeItem('must_change_password');
        
        // 跳转到登录页（避免死循环）
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }

      // 403 权限不足
      if (status === 403) {
        console.error('❌ 权限不足，无法访问此资源');
      }

      // 500 服务器错误
      if (status === 500) {
        console.error('❌ 服务器内部错误:', error.response.data);
      }
    } else if (error.request) {
      // 请求已发出但未收到响应
      console.error('❌ 网络错误：未收到服务器响应', error.message);
    } else {
      // 其他错误
      console.error('❌ 请求配置错误:', error.message);
    }

    return Promise.reject(error);
  }
);

/**
 * 上传文件专用配置
 * 用于 CSV/Excel 导入等场景
 */
export const createUploadConfig = (onUploadProgress?: (progressEvent: any) => void) => ({
  headers: {
    'Content-Type': 'multipart/form-data',
  },
  onUploadProgress,
});

/**
 * 格式化错误消息
 * @param error Axios 错误对象
 * @returns 用户友好的错误消息
 */
export const formatErrorMessage = (error: any): string => {
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return '未知错误，请稍后重试';
};

export default apiClient;
