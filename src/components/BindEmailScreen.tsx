import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabaseService } from '../lib/supabaseService';
import { EmailInput } from './EmailInput';
import { OTPInput } from './OTPInput';
import { Link2, Mail, Loader2, ArrowLeft, CheckCircle, User, Search } from 'lucide-react';
import type { Employee } from '../lib/database.types';

type BindStep = 'select' | 'email' | 'otp';

export function BindEmailScreen() {
  const { loginWithEmail, verifyOTP, bindEmail } = useAuth();
  
  const [step, setStep] = useState<BindStep>('select');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // 获取所有员工（未绑定邮箱的）
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees-unbind'],
    queryFn: async () => {
      const allEmployees = await supabaseService.getAllEmployees();
      // 过滤出未绑定邮箱的员工
      return allEmployees.filter(emp => !emp.auth_user_id && !emp.email);
    },
  });

  // 过滤员工列表
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 步骤 1: 选择员工
  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
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

  // 步骤 3: 验证 OTP 并绑定邮箱
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('请输入完整的 6 位验证码');
      return;
    }

    if (!selectedEmployee) {
      setError('未选择员工');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 验证 OTP
      const { error: verifyError } = await verifyOTP(email, otp, 'email');
      
      if (verifyError) {
        setError(verifyError.message);
        setOtp('');
        return;
      }

      // 绑定邮箱到员工
      const { error: bindError } = await bindEmail(
        selectedEmployee.id,
        email
      );

      if (bindError) {
        setError(bindError.message);
        return;
      }

      // 绑定成功，AuthContext 会自动刷新用户信息
    } catch (err: any) {
      setError(err.message || '绑定失败');
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
      setStep('select');
      setSelectedEmployee(null);
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
      if (step === 'email' && isEmailValid) {
        handleSendOTP();
      } else if (step === 'otp' && otp.length === 6) {
        handleVerifyOTP();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Link2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            绑定邮箱账号
          </h1>
          <p className="text-gray-600">
            {step === 'select' && '请选择您的员工信息'}
            {step === 'email' && '请输入您的 Bosch 邮箱'}
            {step === 'otp' && '输入验证码完成绑定'}
          </p>
        </div>

        {/* 步骤 1：选择员工 */}
        {step === 'select' && (
          <div className="space-y-6">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索姓名或员工编号..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
            </div>

            {/* 员工列表 */}
            {isLoadingEmployees ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">加载员工列表...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm ? '未找到匹配的员工' : '暂无未绑定邮箱的员工'}
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-3">
                {filteredEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => handleSelectEmployee(employee)}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 
                             transition-all duration-200 text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full 
                                    flex items-center justify-center group-hover:from-purple-200 group-hover:to-pink-200">
                        <User className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 group-hover:text-purple-700">
                          {employee.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {employee.employee_id}
                        </p>
                        {employee.position && (
                          <p className="text-xs text-gray-500 mt-1">
                            {employee.position}
                          </p>
                        )}
                      </div>
                      <ArrowLeft className="w-5 h-5 text-gray-400 rotate-180 group-hover:text-purple-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="text-center pt-4">
              <p className="text-sm text-gray-500">
                找不到您的信息？
                <a href="/contact" className="text-purple-600 hover:text-purple-700 font-medium ml-1">
                  联系管理员
                </a>
              </p>
            </div>
          </div>
        )}

        {/* 步骤 2：邮箱输入 */}
        {step === 'email' && selectedEmployee && (
          <div className="space-y-6" onKeyPress={handleKeyPress}>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </button>

            {/* 选中的员工信息 */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full 
                              flex items-center justify-center">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedEmployee.name}</h3>
                  <p className="text-sm text-gray-600">{selectedEmployee.employee_id}</p>
                </div>
              </div>
            </div>

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
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium
                       hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed
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
        {step === 'otp' && selectedEmployee && (
          <div className="space-y-6" onKeyPress={handleKeyPress}>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">返回</span>
            </button>

            {/* 绑定信息提示 */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-purple-900 font-medium mb-2">
                    验证码已发送到
                  </p>
                  <p className="text-sm text-purple-700 mb-2">
                    {email}
                  </p>
                  <p className="text-xs text-purple-600">
                    验证后将绑定到：{selectedEmployee.name} ({selectedEmployee.employee_id})
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
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium
                       hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  绑定中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  完成绑定
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
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
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

