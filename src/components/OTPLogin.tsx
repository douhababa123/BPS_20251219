/**
 * OTP 登录组件
 * 基于新的 FastAPI 后端认证
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNewAuth } from '@/contexts/NewAuthContext';

export const OTPLogin: React.FC = () => {
  const { requestOTP, verifyOTP, isLoading } = useNewAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 请求 OTP
   */
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await requestOTP(email);
      setMessage(`验证码已发送到 ${email}，请查收邮件`);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || '发送验证码失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 验证 OTP 并登录
   */
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await verifyOTP(email, otp);
      setMessage('登录成功！');
      // 登录成功后跳转到首页
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '验证码错误或已过期，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 重新发送 OTP
   */
  const handleResendOTP = async () => {
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await requestOTP(email);
      setMessage('验证码已重新发送');
    } catch (err: any) {
      setError('发送验证码失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">加载中...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            登录 BPS 系统
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'email' ? '输入您的邮箱地址' : '输入邮箱中的验证码'}
          </p>
        </div>

        {/* 显示消息 */}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {message}
          </div>
        )}

        {/* 显示错误 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* 步骤 1: 输入邮箱 */}
        {step === 'email' && (
          <form className="mt-8 space-y-6" onSubmit={handleRequestOTP}>
            <div>
              <label htmlFor="email" className="sr-only">
                邮箱地址
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '发送中...' : '获取验证码'}
            </button>
          </form>
        )}

        {/* 步骤 2: 输入 OTP */}
        {step === 'otp' && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOTP}>
            <div>
              <label htmlFor="otp" className="sr-only">
                验证码
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                required
                maxLength={6}
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm text-center tracking-widest text-xl"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setStep('email')}
                disabled={isSubmitting}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="flex-1 py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '验证中...' : '登录'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isSubmitting}
                className="text-sm text-indigo-600 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                重新发送验证码
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default OTPLogin;
