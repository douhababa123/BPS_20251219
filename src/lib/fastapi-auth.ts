/**
 * FastAPI 认证服务
 * 调用新的 FastAPI 后端 API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================================================
// 类型定义
// ============================================================================

export interface AuthResponse {
  user: any | null;
  session: any | null;
  error: Error | null;
}

export interface LoginResponse {
  message: string;
  detail: string;
}

export interface VerifyResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// ============================================================================
// 邮箱验证
// ============================================================================

/**
 * 验证邮箱域名
 */
export function validateEmailDomain(email: string): { valid: boolean; message?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, message: '请输入有效的邮箱地址' };
  }

  if (!email.endsWith('@bosch.com') && !email.endsWith('@bshg.com')) {
    return { valid: false, message: '只允许使用 @bosch.com 或 @bshg.com 邮箱' };
  }

  return { valid: true };
}

// ============================================================================
// 发送验证码
// ============================================================================

/**
 * 发送登录/注册验证码到邮箱
 */
export async function sendOTP(email: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    // 验证邮箱域名
    const validation = validateEmailDomain(email);
    if (!validation.valid) {
      return {
        success: false,
        error: new Error(validation.message!),
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/signup-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: new Error(errorData.detail || '发送验证码失败'),
      };
    }

    const data: LoginResponse = await response.json();
    console.log('✅ 验证码发送成功:', data.message);

    return {
      success: true,
      error: null,
    };
  } catch (error: any) {
    console.error('❌ 发送验证码失败:', error);
    return {
      success: false,
      error: new Error(error.message || '网络错误，请重试'),
    };
  }
}

// ============================================================================
// 验证 OTP
// ============================================================================

/**
 * 验证 OTP 码并登录
 */
export async function verifyOTP(email: string, otp: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        user: null,
        session: null,
        error: new Error(errorData.detail || '验证失败'),
      };
    }

    const data: VerifyResponse = await response.json();
    console.log('✅ OTP 验证成功，已登录');

    // 保存 token 到 localStorage
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('user_data', JSON.stringify(data.user));

    return {
      user: data.user,
      session: {
        access_token: data.access_token,
        token_type: data.token_type,
      },
      error: null,
    };
  } catch (error: any) {
    console.error('❌ 验证 OTP 失败:', error);
    return {
      user: null,
      session: null,
      error: new Error(error.message || '验证失败，请重试'),
    };
  }
}

// ============================================================================
// 会话管理
// ============================================================================

/**
 * 获取当前会话
 */
export async function getCurrentSession(): Promise<{ session: any | null }> {
  try {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');

    if (!token || !userData) {
      return { session: null };
    }

    // 验证 token 是否有效
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token 已过期或无效，清除本地数据
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      return { session: null };
    }

    const user = JSON.parse(userData);
    return {
      session: {
        access_token: token,
        user: user,
      },
    };
  } catch (error) {
    console.error('❌ 获取会话失败:', error);
    return { session: null };
  }
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  try {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    console.error('❌ 登出请求失败:', error);
  } finally {
    // 无论如何都清除本地数据
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }
}

// ============================================================================
// 用户信息
// ============================================================================

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<{ user: any | null; error: Error | null }> {
  try {
    const token = localStorage.getItem('auth_token');

    if (!token) {
      return { user: null, error: null };
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { user: null, error: new Error('获取用户信息失败') };
    }

    const user = await response.json();
    return { user, error: null };
  } catch (error: any) {
    return { user: null, error: new Error(error.message || '获取用户信息失败') };
  }
}
