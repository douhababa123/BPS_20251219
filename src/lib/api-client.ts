/**
 * API 客户端配置
 * 基于 Axios 的 HTTP 客户端，用于与 FastAPI 后端通信
 */

import axios from 'axios';

// API 基础 URL - 从环境变量获取（生产环境用相对路径由 nginx 代理）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');

/**
 * 创建 Axios 实例
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 秒超时 - 增加以支持能力评估数据加载
});

/**
 * 请求拦截器 - 自动添加 JWT Token
 * 注意：不要自动补全 trailing slash，FastAPI 路由均以无斜杠定义
 * 添加 trailing slash 会触发 FastAPI 307 重定向，且重定向会丢失端口号
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器 - 处理错误、token 过期和自动重试
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Token 过期或无效
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // 清除本地存储
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_email');
      
      // 重定向到登录页
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      
      return Promise.reject(new Error('认证已过期，请重新登录'));
    }

    // 网络错误或超时自动重试（最多2次）
    if (
      (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response) &&
      !originalRequest._retryCount
    ) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      if (originalRequest._retryCount <= 2) {
        console.warn(`⚠️ 网络请求失败，正在重试 (${originalRequest._retryCount}/2)...`, {
          url: originalRequest.url,
          error: error.message,
        });
        
        // 等待一小段时间后重试（指数退避）
        const delay = originalRequest._retryCount * 1000; // 1秒、2秒
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return apiClient.request(originalRequest);
      }
    }

    // 处理其他错误
    const errorMessage = error.response?.data?.detail || error.message || '请求失败';
    console.error('API Error:', errorMessage, error.response?.data);
    
    return Promise.reject(error);
  }
);

export default apiClient;
