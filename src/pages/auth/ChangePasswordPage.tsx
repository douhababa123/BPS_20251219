import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useNewAuth } from '@/contexts/NewAuthContext';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { markPasswordChanged, logout } = useNewAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (newPassword.length < 8) {
      setError('新密码至少 8 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setIsLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      markPasswordChanged();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || '修改密码失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">修改密码</h1>
            <p className="text-sm text-slate-500">首次登录或重置密码后需要设置新密码</p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="当前/临时密码"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="新密码（至少 8 位）"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="再次输入新密码"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            保存新密码
          </button>
          <button
            onClick={logout}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 font-medium hover:bg-slate-50"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
