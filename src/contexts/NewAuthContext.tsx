/**
 * 新的认证 Context（基于 FastAPI 后端）
 * 管理用户认证状态和提供认证相关方法
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/auth.service';
import type { CurrentUser, TokenResponse } from '@/types/api';

interface NewAuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  requestOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  loginWithPassword: (userData: { user_id: string; email: string; name?: string; role?: string }) => void;
  logout: () => Promise<void>;
}

const NewAuthContext = createContext<NewAuthContextType | undefined>(undefined);

interface NewAuthProviderProps {
  children: ReactNode;
}

export const NewAuthProvider: React.FC<NewAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化时检查认证状态
  useEffect(() => {
    const initAuth = () => {
      // 检查简化登录的 token
      const token = localStorage.getItem('access_token');
      const userId = localStorage.getItem('user_id');
      const userEmail = localStorage.getItem('user_email');
      
      if (token && userId && userEmail) {
        // 优先从 localStorage 读 role，否则从 JWT payload 解码
        let userRole = localStorage.getItem('user_role');
        if (!userRole) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            userRole = payload.role || 'user';
            localStorage.setItem('user_role', userRole); // 补存，下次直接读
          } catch {
            userRole = 'user';
          }
        }
        setUser({ id: userId, email: userEmail, role: userRole });
        setIsLoading(false);
        return;
      }
      
      // 检查 FastAPI 认证状态
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  /**
   * 密码登录后同步用户状态（写 localStorage + 更新内存 state）
   */
  const loginWithPassword = (userData: { user_id: string; email: string; name?: string; role?: string }): void => {
    const role = userData.role || 'user';
    localStorage.setItem('user_id', userData.user_id);
    localStorage.setItem('user_email', userData.email);
    localStorage.setItem('user_role', role);
    setUser({ id: userData.user_id, email: userData.email, role });
  };

  /**
   * 请求 OTP
   */
  const requestOTP = async (email: string): Promise<void> => {
    await authService.requestOTP({ email });
  };

  /**
   * 验证 OTP 并登录
   */
  const verifyOTP = async (email: string, otp: string): Promise<void> => {
    const tokenData: TokenResponse = await authService.verifyOTP({ email, otp });
    const role = tokenData.role || 'user';
    localStorage.setItem('user_role', role);
    setUser({ id: tokenData.user_id, email: tokenData.email, role });
  };

  /**
   * 登出
   */
  const logout = async (): Promise<void> => {
    await authService.logout();
    
    // 清除简化登录的 token
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_role');
    
    setUser(null);
  };

  const value: NewAuthContextType = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isLoading,
    requestOTP,
    verifyOTP,
    loginWithPassword,
    logout,
  };

  return <NewAuthContext.Provider value={value}>{children}</NewAuthContext.Provider>;
};

/**
 * 使用新认证 Context 的 Hook
 */
export const useNewAuth = (): NewAuthContextType => {
  const context = useContext(NewAuthContext);
  if (!context) {
    throw new Error('useNewAuth must be used within NewAuthProvider');
  }
  return context;
};

export default NewAuthContext;
