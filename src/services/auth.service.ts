/**
 * 认证服务
 * 处理 OTP 登录、Token 管理和用户状态
 */

import { apiClient } from '@/lib/api-client';
import type {
  OTPRequest,
  OTPVerifyRequest,
  TokenResponse,
  MessageResponse,
  CurrentUser,
} from '@/types/api';

class AuthService {
  // LocalStorage 键名
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_ID_KEY = 'user_id';
  private readonly USER_EMAIL_KEY = 'user_email';
  private readonly MUST_CHANGE_PASSWORD_KEY = 'must_change_password';

  /**
   * 请求 OTP - 发送验证码到邮箱
   */
  async requestOTP(data: OTPRequest): Promise<MessageResponse> {
    const response = await apiClient.post<MessageResponse>('/auth/signup-otp', data);
    return response.data;
  }

  /**
   * 验证 OTP 并登录
   */
  async verifyOTP(data: OTPVerifyRequest): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/auth/verify-otp', data);
    const tokenData = response.data;

    // 保存 token 和用户信息到 localStorage
    this.saveToken(tokenData);

    return tokenData;
  }

  /**
   * 登出
   */
  async logout(): Promise<MessageResponse> {
    try {
      const response = await apiClient.post<MessageResponse>('/auth/logout');
      return response.data;
    } finally {
      // 无论 API 调用是否成功，都清除本地存储
      this.clearToken();
    }
  }

  /**
   * 保存 token 和用户信息
   */
  private saveToken(tokenData: TokenResponse): void {
    localStorage.setItem(this.TOKEN_KEY, tokenData.access_token);
    localStorage.setItem(this.USER_ID_KEY, tokenData.user_id);
    localStorage.setItem(this.USER_EMAIL_KEY, tokenData.email);
    localStorage.setItem(this.MUST_CHANGE_PASSWORD_KEY, String(!!tokenData.must_change_password));
  }

  /**
   * 清除本地存储
   */
  private clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_ID_KEY);
    localStorage.removeItem(this.USER_EMAIL_KEY);
    localStorage.removeItem(this.MUST_CHANGE_PASSWORD_KEY);
  }

  /**
   * 获取当前 token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser(): CurrentUser | null {
    const id = localStorage.getItem(this.USER_ID_KEY);
    const email = localStorage.getItem(this.USER_EMAIL_KEY);
    const mustChangePassword = localStorage.getItem(this.MUST_CHANGE_PASSWORD_KEY) === 'true';

    if (!id || !email) {
      return null;
    }

    return { id, email, must_change_password: mustChangePassword };
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<MessageResponse> {
    const response = await apiClient.post<MessageResponse>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    localStorage.setItem(this.MUST_CHANGE_PASSWORD_KEY, 'false');
    return response.data;
  }
}

// 导出单例
export const authService = new AuthService();
export default authService;
