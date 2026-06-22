/**
 * 简化登录界面
 * 仅需输入邮箱，无需OTP验证
 * 自动注册或登录
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Zap, LogIn } from 'lucide-react';
import { EmailInput } from './EmailInput';
import { simpleLogin } from '../lib/authService';
import { useNewAuth } from '../contexts/NewAuthContext';

export function SimpleLoginScreen() {
  const navigate = useNavigate();
  const { loginWithPassword } = useNewAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 简化登录处理
  const handleLogin = async () => {
    if (!isEmailValid) {
      setError('请输入有效的邮箱地址');
      return;
    }

    if (!password || password.length < 6) {
      setError('密码至少6位');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data, error: loginError } = await simpleLogin(email, password);

      if (loginError) {
        setError(loginError.message || '登录失败，请重试');
        setIsLoading(false);
        return;
      }

      if (data) {
        console.log('✅ 登录成功:', data.email);
        // 登录成功，跳转到主页
        loginWithPassword({
          user_id: data.user_id,
          email: data.email,
          role: data.role,
        });
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('❌ 登录失败:', err);
      setError(err.message || '登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 回车键登录
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isEmailValid && password.length >= 6 && !isLoading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            BPS 能力管理系统
          </h1>
          <p className="text-gray-600 text-sm">
            Bosch Production System
          </p>
          <div className="mt-4 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="font-medium">快速登录</span> - 输入邮箱即可
            </p>
          </div>
        </div>

        {/* 登录表单 */}
        <div className="space-y-6" onKeyPress={handleKeyPress}>
          {/* 邮箱输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邮箱地址
            </label>
            <EmailInput
              value={email}
              onChange={setEmail}
              onValidationChange={setIsEmailValid}
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500">
              使用 @bosch.com 或 @bshg.com 邮箱
            </p>
          </div>

          {/* 密码输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置密码（至少6位）"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <p className="mt-2 text-xs text-gray-500">
              新用户自动注册，老用户输入密码登录
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            onClick={handleLogin}
            disabled={!isEmailValid || password.length < 6 || isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium
                     hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                立即登录
              </>
            )}
          </button>

          {/* 说明 */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              🚀 简化登录说明
            </h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• 邮箱 + 密码登录，新用户自动注册</li>
              <li>• 30天免密登录（自动记住）</li>
              <li>• 仅限 Bosch 邮箱使用</li>
            </ul>
          </div>

          {/* 需要OTP登录？ */}
          <div className="text-center">
            <a 
              href="/login-otp" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              使用验证码登录 →
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            © 2026 Bosch BPS 能力管理系统
          </p>
        </div>
      </div>
    </div>
  );
}

export default SimpleLoginScreen;
