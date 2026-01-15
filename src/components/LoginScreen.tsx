import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EmailInput } from './EmailInput';
import { OTPInput } from './OTPInput';
import { LogIn, Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

type LoginStep = 'email' | 'otp';

export function LoginScreen() {
  const { loginWithEmail, verifyOTP } = useAuth();
  
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // 发送验证码
  const handleSendOTP = async () => {
    if (!isEmailValid) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: loginError } = await loginWithEmail(email);
      
      if (loginError) {
        setError(loginError.message);
        return;
      }

      // 成功发送验证码
      setStep('otp');
      startResendCountdown();
    } catch (err: any) {
      setError(err.message || '发送验证码失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 验证 OTP
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('请输入完整的 6 位验证码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: verifyError } = await verifyOTP(email, otp, 'email');
      
      if (verifyError) {
        setError(verifyError.message);
        setOtp(''); // 清空验证码
        return;
      }

      // 登录成功，AuthContext 会自动处理后续逻辑
    } catch (err: any) {
      setError(err.message || '验证失败');
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  // 重新发送验证码
  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    
    setOtp('');
    setError('');
    await handleSendOTP();
  };

  // 返回邮箱输入步骤
  const handleBack = () => {
    setStep('email');
    setOtp('');
    setError('');
  };

  // 重新发送倒计时
  const startResendCountdown = () => {
    setResendCountdown(60);
    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Enter 键提交
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      if (step === 'email' && isEmailValid) {
        handleSendOTP();
      } else if (step === 'otp' && otp.length === 6) {
        handleVerifyOTP();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            BPS 能力管理系统
          </h1>
          <p className="text-gray-600">
            {step === 'email' ? '请使用邮箱登录' : '输入验证码'}
          </p>
        </div>

        {/* 步骤 1：输入邮箱 */}
        {step === 'email' && (
          <div className="space-y-6" onKeyPress={handleKeyPress}>
            <EmailInput
              value={email}
              onChange={setEmail}
              onValidationChange={setIsEmailValid}
              placeholder="请输入 Bosch 邮箱"
              autoFocus
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleSendOTP}
              disabled={!isEmailValid || isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium
                       hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  发送验证码
                </>
              )}
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                没有账号？
                <a href="/signup" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                  立即注册
                </a>
              </p>
            </div>
          </div>
        )}

        {/* 步骤 2：输入验证码 */}
        {step === 'otp' && (
          <div className="space-y-6" onKeyPress={handleKeyPress}>
            {/* 返回按钮 */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </button>

            {/* 邮箱提示 */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-medium mb-1">
                    验证码已发送
                  </p>
                  <p className="text-sm text-blue-700">
                    {email}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    有效期：10 分钟
                  </p>
                </div>
              </div>
            </div>

            {/* OTP 输入 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                请输入 6 位验证码
              </label>
              <OTPInput
                value={otp}
                onChange={setOtp}
                length={6}
                autoFocus
                onComplete={handleVerifyOTP}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 验证按钮 */}
            <button
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium
                       hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  验证中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  验证并登录
                </>
              )}
            </button>

            {/* 重新发送 */}
            <div className="text-center">
              {resendCountdown > 0 ? (
                <p className="text-sm text-gray-500">
                  {resendCountdown} 秒后可重新发送
                </p>
              ) : (
                <button
                  onClick={handleResendOTP}
                  disabled={isLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  重新发送验证码
                </button>
              )}
            </div>
          </div>
        )}

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
