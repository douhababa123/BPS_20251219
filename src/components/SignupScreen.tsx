import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { EmailInput } from './EmailInput';
import { OTPInput } from './OTPInput';
import { UserPlus, Mail, Loader2, ArrowLeft, CheckCircle, User, Briefcase } from 'lucide-react';

type SignupStep = 'info' | 'email' | 'otp';

interface SignupFormData {
  name: string;
  employeeId: string;
  position: string;
  email: string;
}

export function SignupScreen() {
  const { signupWithEmail, verifyOTP } = useAuth();
  
  const [step, setStep] = useState<SignupStep>('info');
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    employeeId: '',
    position: '',
    email: '',
  });
  const [otp, setOtp] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // 验证基本信息
  const isInfoValid = formData.name.trim() && formData.employeeId.trim();

  // 更新表单数据
  const updateFormData = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // 步骤 1: 提交基本信息
  const handleInfoSubmit = () => {
    if (!isInfoValid) {
      setError('请填写姓名和员工编号');
      return;
    }
    setStep('email');
  };

  // 步骤 2: 发送验证码
  const handleSendOTP = async () => {
    if (!isEmailValid) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { error: signupError } = await signupWithEmail(formData.email, formData.name);
      
      if (signupError) {
        setError(signupError.message);
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

  // 步骤 3: 验证 OTP 并完成注册
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('请输入完整的 6 位验证码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 验证 OTP（注意：使用 'email' 类型，因为我们使用的是 signInWithOtp）
      const { error: verifyError } = await verifyOTP(formData.email, otp, 'email');
      
      if (verifyError) {
        setError(verifyError.message);
        setOtp('');
        return;
      }

      // 注册成功，AuthContext 会自动处理后续逻辑
      // 用户需要在首次登录时完善个人信息（姓名、员工编号等）
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

  // 返回上一步
  const handleBack = () => {
    if (step === 'otp') {
      setStep('email');
      setOtp('');
    } else if (step === 'email') {
      setStep('info');
    }
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
      if (step === 'info' && isInfoValid) {
        handleInfoSubmit();
      } else if (step === 'email' && isEmailValid) {
        handleSendOTP();
      } else if (step === 'otp' && otp.length === 6) {
        handleVerifyOTP();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            注册新账号
          </h1>
          <p className="text-gray-600">
            {step === 'info' && '请填写基本信息'}
            {step === 'email' && '请输入 Bosch 邮箱'}
            {step === 'otp' && '输入验证码'}
          </p>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step === 'info' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step === 'info' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}>
              <User className="w-4 h-4" />
            </div>
            <span className="ml-2 text-sm font-medium">基本信息</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-300 mx-2" />
          <div className={`flex items-center ${step === 'email' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step === 'email' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}>
              <Mail className="w-4 h-4" />
            </div>
            <span className="ml-2 text-sm font-medium">邮箱验证</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-300 mx-2" />
          <div className={`flex items-center ${step === 'otp' ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              step === 'otp' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}>
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 步骤 1：基本信息 */}
        {step === 'info' && (
          <div className="space-y-6" onKeyPress={handleKeyPress}>
            {/* 姓名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                姓名 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  placeholder="请输入您的姓名"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* 员工编号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                员工编号 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => updateFormData('employeeId', e.target.value)}
                  placeholder="例如：SWa-BPS_Zhang_San"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 职位（可选） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                职位（可选）
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => updateFormData('position', e.target.value)}
                placeholder="例如：软件工程师"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleInfoSubmit}
              disabled={!isInfoValid}
              className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-medium
                       hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              下一步
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                已有账号？
                <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium ml-1">
                  立即登录
                </a>
              </p>
            </div>
          </div>
        )}

        {/* 步骤 2：邮箱输入 */}
        {step === 'email' && (
          <div className="space-y-6" onKeyPress={handleKeyPress}>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </button>

            <EmailInput
              value={formData.email}
              onChange={(value) => updateFormData('email', value)}
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
              className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-medium
                       hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
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
          </div>
        )}

        {/* 步骤 3：验证码输入 */}
        {step === 'otp' && (
          <div className="space-y-6" onKeyPress={handleKeyPress}>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </button>

            {/* 邮箱提示 */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-green-900 font-medium mb-1">
                    验证码已发送
                  </p>
                  <p className="text-sm text-green-700">
                    {formData.email}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
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
              className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-medium
                       hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
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
                  完成注册
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

