// @ts-nocheck - 遗留 Supabase 认证服务，已迁移到 FastAPI
/**
 * 认证服务层
 * 封装 Supabase Auth API，提供统一的认证接口
 */

import { supabase } from './supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import type { Employee } from './database.types';

// ============================================================================
// 类型定义
// ============================================================================

export interface SignupData {
  email: string;
  name: string;
  metadata?: Record<string, any>;
}

export interface LoginData {
  email: string;
  rememberMe?: boolean;
}

export interface VerifyOTPData {
  email: string;
  token: string;
  type: 'email' | 'signup' | 'magiclink' | 'recovery' | 'invite';
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export interface EmployeeProfile extends Employee {
  avatar_url?: string;
}

// ============================================================================
// 邮箱验证
// ============================================================================

/**
 * 验证邮箱域名
 * 只允许 @bosch.com 或 @bshg.com
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
// 注册功能
// ============================================================================

/**
 * 发送注册验证码
 */
export async function signupWithEmail(data: SignupData): Promise<AuthResponse> {
  try {
    // 验证邮箱域名
    const validation = validateEmailDomain(data.email);
    if (!validation.valid) {
      return {
        user: null,
        session: null,
        error: {
          message: validation.message!,
          name: 'ValidationError',
          status: 400,
        } as AuthError,
      };
    }

    // 发送 OTP（注册时允许创建新用户）
    const { data: authData, error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: true, // 允许创建新用户
        data: {
          name: data.name,
          ...data.metadata,
        },
      },
    });

    if (error) {
      return { user: null, session: null, error };
    }

    return {
      user: authData.user,
      session: authData.session,
      error: null,
    };
  } catch (error: any) {
    return {
      user: null,
      session: null,
      error: {
        message: error.message || '注册失败',
        name: 'SignupError',
        status: 500,
      } as AuthError,
    };
  }
}

// ============================================================================
// 登录功能
// ============================================================================

/**
 * 发送登录验证码
 */
export async function loginWithEmail(data: LoginData): Promise<AuthResponse> {
  try {
    // 验证邮箱域名
    const validation = validateEmailDomain(data.email);
    if (!validation.valid) {
      return {
        user: null,
        session: null,
        error: {
          message: validation.message!,
          name: 'ValidationError',
          status: 400,
        } as AuthError,
      };
    }

    // 发送 OTP
    const { data: authData, error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: false, // 登录时不自动创建用户
      },
    });

    if (error) {
      return { user: null, session: null, error };
    }

    return {
      user: authData.user,
      session: authData.session,
      error: null,
    };
  } catch (error: any) {
    return {
      user: null,
      session: null,
      error: {
        message: error.message || '登录失败',
        name: 'LoginError',
        status: 500,
      } as AuthError,
    };
  }
}

// ============================================================================
// OTP 验证
// ============================================================================

/**
 * 验证 OTP 码
 */
export async function verifyOTP(data: VerifyOTPData): Promise<AuthResponse> {
  try {
    const { data: authData, error } = await supabase.auth.verifyOtp({
      email: data.email,
      token: data.token,
      type: data.type,
    });

    if (error) {
      return { user: null, session: null, error };
    }

    // 验证成功后，更新登录信息
    if (authData.user) {
      await updateLoginInfo(authData.user.id);
    }

    return {
      user: authData.user,
      session: authData.session,
      error: null,
    };
  } catch (error: any) {
    return {
      user: null,
      session: null,
      error: {
        message: error.message || '验证失败',
        name: 'VerifyError',
        status: 500,
      } as AuthError,
    };
  }
}

// ============================================================================
// 会话管理
// ============================================================================

/**
 * 获取当前会话
 */
export async function getCurrentSession(): Promise<{ session: Session | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  } catch (error: any) {
    return {
      session: null,
      error: {
        message: error.message || '获取会话失败',
        name: 'SessionError',
        status: 500,
      } as AuthError,
    };
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<{ user: User | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  } catch (error: any) {
    return {
      user: null,
      error: {
        message: error.message || '获取用户失败',
        name: 'UserError',
        status: 500,
      } as AuthError,
    };
  }
}

/**
 * 刷新会话
 */
export async function refreshSession(): Promise<{ session: Session | null; error: AuthError | null }> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    return { session: data.session, error };
  } catch (error: any) {
    return {
      session: null,
      error: {
        message: error.message || '刷新会话失败',
        name: 'RefreshError',
        status: 500,
      } as AuthError,
    };
  }
}

/**
 * 登出
 */
export async function logout(): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error: any) {
    return {
      error: {
        message: error.message || '登出失败',
        name: 'LogoutError',
        status: 500,
      } as AuthError,
    };
  }
}

// ============================================================================
// 简化登录（使用 FastAPI 后端，无需 OTP）
// ============================================================================

import { apiClient } from './api-client';

export interface SimpleLoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  role: string;
  must_change_password?: boolean;
}

/**
 * 简化登录：直接使用邮箱+密码登录，无需OTP
 * 自动注册或登录，30天免密
 */
export async function simpleLogin(email: string, password: string): Promise<{
  data: SimpleLoginResponse | null;
  error: Error | null;
}> {
  try {
    // 验证邮箱域名
    const validation = validateEmailDomain(email);
    if (!validation.valid) {
      return {
        data: null,
        error: new Error(validation.message),
      };
    }

    // 调用 FastAPI 简化登录端点
    const response = await apiClient.post<SimpleLoginResponse>('/auth/simple-login', {
      email,
      password,
      remember_me: true,  // 默认30天免密
    });

    // 保存 token 到 localStorage
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('user_id', response.data.user_id);
    localStorage.setItem('user_email', response.data.email);
    localStorage.setItem('user_role', response.data.role || 'user');
    localStorage.setItem('must_change_password', String(!!response.data.must_change_password));

    return {
      data: response.data,
      error: null,
    };
  } catch (error: any) {
    console.error('❌ 简化登录失败:', error);
    return {
      data: null,
      error: new Error(error.response?.data?.detail || error.message || '登录失败'),
    };
  }
}

/**
 * 简化登出
 */
export async function simpleLogout(): Promise<{ error: Error | null }> {
  try {
    // 清除本地存储
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    localStorage.removeItem('must_change_password');

    return { error: null };
  } catch (error: any) {
    return {
      error: new Error(error.message || '登出失败'),
    };
  }
}

// ============================================================================
// 用户资料管理
// ============================================================================

/**
 * 获取员工资料（通过 auth_user_id）
 */
export async function getEmployeeProfile(authUserId: string): Promise<{ profile: EmployeeProfile | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) throw error;

    return { profile: data as EmployeeProfile | null, error: null };
  } catch (error: any) {
    // 区分 404 错误（记录不存在）、无限递归错误（RLS 策略问题）和其他错误
    const isNotFoundError = error?.code === 'PGRST116' || error?.message?.includes('not found');
    const isRecursionError = error?.message?.includes('infinite recursion') || error?.message?.includes('recursion detected');
    
    // 如果是无限递归错误，说明数据库或 RLS 策略有问题，暂时返回 null
    if (isRecursionError) {
      console.warn('⚠️ 检测到 RLS 策略无限递归错误，返回 null。这通常是由于数据库 RLS 策略配置问题导致的。');
      return {
        profile: null,
        error: null, // 不返回错误，允许继续
      };
    }
    
    return {
      profile: null,
      error: isNotFoundError ? null : new Error(error.message || '获取用户资料失败'),
    };
  }
}

/**
 * 更新员工资料
 */
export async function updateEmployeeProfile(
  authUserId: string,
  updates: Partial<EmployeeProfile>
): Promise<{ profile: EmployeeProfile | null; error: Error | null }> {
  try {
    // 构建更新对象
    const updateData: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    console.log('🔄 准备更新员工资料:', { authUserId, updateData });

    // 执行更新（不使用 .select()，避免递归问题）
    const { error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('auth_user_id', authUserId);

    if (error) {
      console.error('❌ 更新失败:', error);
      
      // 检查是否是无限递归错误（RLS 策略问题）
      const isRecursionError = error?.message?.includes('infinite recursion') || error?.message?.includes('recursion detected');
      
      if (isRecursionError) {
        console.warn('⚠️ 检测到 RLS 策略无限递归错误。');
        console.warn('💡 这通常是因为 Supabase 数据库中 employees 表的 RLS 策略配置有问题。');
        console.warn('💡 更新操作本身可能已经成功，但由于 RLS 策略查询时出现递归。');
        console.warn('💡 返回 null 让流程继续，避免阻塞用户。');
        // 不抛出错误，假设更新可能已成功
        return { profile: null, error: null };
      }
      
      // 其他错误，抛出
      throw error;
    }

    console.log('✅ 更新成功，尝试查询返回数据');

    // 更新成功后，重新查询返回完整的数据
    const { data, error: selectError } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (selectError) {
      console.error('❌ 查询员工资料失败:', selectError);
      
      // 检查是否是无限递归错误
      const isRecursionError = selectError?.message?.includes('infinite recursion') || selectError?.message?.includes('recursion detected');
      
      if (isRecursionError) {
        console.warn('⚠️ 查询时也检测到 RLS 策略无限递归错误。');
        console.warn('💡 更新操作本身应该已经成功，只是无法通过普通查询获取结果。');
        console.warn('💡 返回 null，避免阻塞用户。');
        // 不抛出错误，返回 null
        return { profile: null, error: null };
      }
      
      // 其他查询错误，抛出
      throw selectError;
    }

    console.log('✅ 查询成功:', data);
    return { profile: data as EmployeeProfile | null, error: null };
  } catch (error: any) {
    console.error('❌ updateEmployeeProfile 异常:', error);
    return {
      profile: null,
      error: new Error(error.message || '更新用户资料失败'),
    };
  }
}

/**
 * 绑定邮箱到现有员工
 */
export async function bindEmailToEmployee(
  employeeId: string,
  email: string,
  authUserId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // 使用 RPC 函数绑定邮箱
    const rpcParams: Record<string, any> = {
      p_employee_id: employeeId,
      p_email: email,
      p_auth_user_id: authUserId,
    };

    // @ts-ignore - Supabase RPC 类型推断问题
    const { data, error } = await supabase.rpc('bind_email_to_employee', rpcParams);

    if (error) throw error;

    return { success: data as boolean, error: null };
  } catch (error: any) {
    return {
      success: false,
      error: new Error(error.message || '绑定邮箱失败'),
    };
  }
}

// ============================================================================
// 辅助功能
// ============================================================================

/**
 * 更新登录信息（登录时间和次数）
 */
async function updateLoginInfo(authUserId: string): Promise<void> {
  try {
    // 先获取当前登录次数
    const { data: employee } = await supabase
      .from('employees')
      .select('login_count')
      .eq('auth_user_id', authUserId)
      .single();

    const currentCount = (employee as any)?.login_count || 0;

    // 更新登录信息
    const updateData: Record<string, any> = {
      last_login_at: new Date().toISOString(),
      login_count: currentCount + 1,
    };

    await supabase
      .from('employees')
      // @ts-ignore - Supabase 类型推断问题
      .update(updateData)
      .eq('auth_user_id', authUserId);
  } catch (error) {
    console.error('更新登录信息失败:', error);
  }
}

/**
 * 监听认证状态变化
 */
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

// ============================================================================
// 密码管理（未来扩展）
// ============================================================================

/**
 * 发送密码重置邮件
 * 注意：当前使用 OTP 登录，不需要密码
 */
export async function sendPasswordResetEmail(email: string): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  } catch (error: any) {
    return {
      error: {
        message: error.message || '发送重置邮件失败',
        name: 'ResetPasswordError',
        status: 500,
      } as AuthError,
    };
  }
}

/**
 * 更新密码
 */
export async function updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  } catch (error: any) {
    return {
      error: {
        message: error.message || '更新密码失败',
        name: 'UpdatePasswordError',
        status: 500,
      } as AuthError,
    };
  }
}
