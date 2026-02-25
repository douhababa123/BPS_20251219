import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Employee } from '../lib/database.types';
import { supabase } from '../lib/supabase';
// import * as authService from '../lib/authService'; // 旧的 Supabase 认证
import * as authService from '../lib/fastapi-auth'; // 新的 FastAPI 认证

// ============================================================================
// 类型定义
// ============================================================================

interface AuthContextType {
  // 用户状态
  currentUser: Employee | null;
  authUser: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // 权限
  isSitePS: boolean;
  isAdmin: boolean;
  canEditEmployee: (employeeId: string) => boolean;
  
  // 认证方法
  signupWithEmail: (email: string, name: string) => Promise<{ error: Error | null }>;
  loginWithEmail: (email: string) => Promise<{ error: Error | null }>;
  verifyOTP: (email: string, token: string, type: 'signup' | 'email') => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  
  // 用户资料管理
  updateProfile: (updates: Partial<Employee>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  
  // 邮箱绑定（现有用户迁移）
  bindEmail: (employeeId: string, email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// AuthProvider 组件
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================================
  // 初始化：检查会话状态
  // ============================================================================

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('🚀 开始初始化认证系统...');
        
        // 1. 获取当前会话
        const { session: currentSession } = await authService.getCurrentSession();
        
        if (!mounted) {
          console.log('⚠️ 组件已卸载，停止初始化');
          return;
        }

        if (currentSession) {
          console.log('✅ 找到现有会话:', currentSession.user.email);
          setSession(currentSession);
          setAuthUser(currentSession.user);
          
          // 2. 加载员工资料
          await loadEmployeeProfile(currentSession.user.id);
        } else {
          console.log('ℹ️ 未找到会话，用户未登录');
          
          // 3. 检查是否有旧的 localStorage 数据（迁移逻辑）
          const oldUserId = localStorage.getItem('currentUserId');
          if (oldUserId) {
            console.log('🔄 检测到旧的登录状态，需要绑定邮箱');
            // 保留旧的 employee_id，用于邮箱绑定流程
            localStorage.setItem('pendingMigrationEmployeeId', oldUserId);
            localStorage.removeItem('currentUserId');
          }
        }
      } catch (error) {
        console.error('❌ 初始化认证失败:', error);
      } finally {
        if (mounted) {
          console.log('✅ 认证初始化完成，设置 isLoading = false');
          setIsLoading(false);
        }
      }
    };

    // 设置超时保护（5秒后强制完成加载）
    timeoutId = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('⚠️ 认证初始化超时，强制完成加载');
        setIsLoading(false);
      }
    }, 5000);

    initializeAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // ============================================================================
  // 监听认证状态变化
  // ============================================================================

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('认证状态变化:', event, newSession?.user?.email);

        setSession(newSession);
        setAuthUser(newSession?.user ?? null);

        if (event === 'SIGNED_IN' && newSession?.user) {
          // 用户登录成功，加载员工资料
          await loadEmployeeProfile(newSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          // 用户登出，清除状态
          setCurrentUser(null);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token 刷新，更新会话
          console.log('Token 已刷新');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ============================================================================
  // 加载员工资料
  // ============================================================================

  const loadEmployeeProfile = async (authUserId: string) => {
    try {
      console.log('🔍 加载员工资料:', authUserId);
      const { profile, error } = await authService.getEmployeeProfile(authUserId);
      
      if (error) {
        console.warn('⚠️ 加载员工资料失败:', error.message);
        // 新注册的用户可能还没有员工记录，这是正常的
        return;
      }

      if (profile) {
        console.log('✅ 员工资料加载成功:', profile.name);
        setCurrentUser(profile);
      } else {
        console.warn('⚠️ 未找到员工资料，可能是新注册用户');
        // 新注册用户需要完善资料
      }
    } catch (error) {
      console.error('❌ 加载员工资料异常:', error);
      // 即使失败也不应该阻止应用加载
    }
  };

  // ============================================================================
  // 认证方法
  // ============================================================================

  /**
   * 注册：发送验证码到邮箱
   */
  const signupWithEmail = async (email: string, name: string) => {
    try {
      // FastAPI 后端的注册和登录使用相同的 OTP 端点
      const { success, error } = await authService.sendOTP(email);
      
      if (error || !success) {
        return { error: new Error(error?.message || '注册失败，请重试') };
      }

      return { error: null };
    } catch (error: any) {
      console.error('❌ 注册失败:', error);
      return { error: new Error(error.message || '注册失败') };
    }
  };

  /**
   * 登录：发送验证码到邮箱
   */
  const loginWithEmail = async (email: string) => {
    try {
      const { success, error } = await authService.sendOTP(email);
      
      if (error || !success) {
        return { error: new Error(error?.message || '发送验证码失败，请重试') };
      }

      return { error: null };
    } catch (error: any) {
      console.error('❌ 登录失败:', error);
      return { error: new Error(error.message || '登录失败') };
    }
  };

  /**
   * 验证 OTP 码
   */
  const verifyOTP = async (email: string, token: string, type: 'signup' | 'email') => {
    try {
      const { user, session: newSession, error } = await authService.verifyOTP(email, token);

      if (error) {
        return { error: new Error(error.message) };
      }

      if (user && newSession) {
        setAuthUser(user as any);
        setSession(newSession as any);
        
        // 暂时跳过加载员工资料（新系统中 user 就是完整的用户信息）
        // 如果需要，可以从 employees 表加载额外信息
        setCurrentUser({
          id: user.id,
          email: user.email,
          name: user.name,
        } as Employee);
      }

      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message || '验证失败') };
    }
  };

  /**
   * 登出
   */
  const logout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
      setAuthUser(null);
      setSession(null);
      
      // 清除所有本地存储
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('pendingMigrationEmployeeId');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  // ============================================================================
  // 用户资料管理
  // ============================================================================

  /**
   * 更新用户资料
   */
  const updateProfile = async (updates: Partial<Employee>) => {
    if (!authUser) {
      return { error: new Error('未登录') };
    }

    try {
      const { profile, error } = await authService.updateEmployeeProfile(
        authUser.id,
        updates
      );

      if (error) {
        return { error };
      }

      if (profile) {
        setCurrentUser(profile);
      }

      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message || '更新资料失败') };
    }
  };

  /**
   * 刷新用户资料
   */
  const refreshProfile = async () => {
    if (authUser) {
      await loadEmployeeProfile(authUser.id);
    }
  };

  /**
   * 绑定邮箱到现有员工（用于用户迁移）
   */
  const bindEmail = async (employeeId: string, email: string) => {
    if (!authUser) {
      return { error: new Error('未登录') };
    }

    try {
      const { success, error } = await authService.bindEmailToEmployee(
        employeeId,
        email,
        authUser.id
      );

      if (error) {
        return { error };
      }

      if (success) {
        // 绑定成功，重新加载资料
        await loadEmployeeProfile(authUser.id);
        
        // 清除迁移标记
        localStorage.removeItem('pendingMigrationEmployeeId');
      }

      return { error: null };
    } catch (error: any) {
      return { error: new Error(error.message || '绑定邮箱失败') };
    }
  };

  // ============================================================================
  // 权限检查
  // ============================================================================

  const isSitePS = currentUser?.role === 'SITE_PS' || currentUser?.role === 'ADMIN';
  const isAdmin = currentUser?.role === 'ADMIN';
  // 已认证 = 有会话（即使没有员工资料）
  const isAuthenticated = !!session && !!authUser;

  const canEditEmployee = (employeeId: string): boolean => {
    if (!currentUser) return false;
    
    // Admin 和 Site PS 可以编辑所有人
    if (isSitePS) return true;
    
    // 普通用户只能编辑自己
    return currentUser.employee_id === employeeId;
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: AuthContextType = {
    // 用户状态
    currentUser,
    authUser,
    session,
    isLoading,
    isAuthenticated,
    
    // 权限
    isSitePS,
    isAdmin,
    canEditEmployee,
    
    // 认证方法
    signupWithEmail,
    loginWithEmail,
    verifyOTP,
    logout,
    
    // 用户资料管理
    updateProfile,
    refreshProfile,
    
    // 邮箱绑定
    bindEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 使用认证上下文
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * 权限钩子
 */
export function usePermissions() {
  const { isSitePS, isAdmin, canEditEmployee } = useAuth();
  
  return {
    isSitePS,
    isAdmin,
    canEditEmployee,
    canEditAllSchedules: isSitePS,
    canManageEmployees: isAdmin,
    canViewAllData: true, // 所有人都可以查看数据
  };
}

/**
 * 检查是否需要邮箱绑定（用于用户迁移）
 */
export function useNeedEmailBinding(): { needBinding: boolean; oldEmployeeId: string | null } {
  const { isAuthenticated, currentUser } = useAuth();
  const [needBinding, setNeedBinding] = useState(false);
  const [oldEmployeeId, setOldEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    const pendingId = localStorage.getItem('pendingMigrationEmployeeId');
    
    if (pendingId && !isAuthenticated) {
      setNeedBinding(true);
      setOldEmployeeId(pendingId);
    } else if (isAuthenticated && currentUser) {
      setNeedBinding(false);
      setOldEmployeeId(null);
    }
  }, [isAuthenticated, currentUser]);

  return { needBinding, oldEmployeeId };
}
