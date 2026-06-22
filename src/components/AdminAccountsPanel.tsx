import { useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAccountStatuses,
  resetAccountPassword,
  syncAccounts,
  type GeneratedAccountPassword,
} from '@/services/adminService';

export function AdminAccountsPanel() {
  const queryClient = useQueryClient();
  const [generatedPasswords, setGeneratedPasswords] = useState<GeneratedAccountPassword[]>([]);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: getAccountStatuses,
  });

  const syncMutation = useMutation({
    mutationFn: syncAccounts,
    onSuccess: (result) => {
      setGeneratedPasswords(result.passwords || []);
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetAccountPassword,
    onSuccess: (result) => {
      setGeneratedPasswords([result]);
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
    },
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">账号状态 / Account Status</h3>
          <p className="text-sm text-gray-500">从 employees 同步 users，并管理初始密码和角色</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          同步账号 / Sync
        </button>
      </div>

      {generatedPasswords.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-semibold text-amber-900 mb-2">临时密码仅显示一次</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-amber-900">
                  <th className="py-1 pr-4">员工</th>
                  <th className="py-1 pr-4">邮箱</th>
                  <th className="py-1 pr-4">角色</th>
                  <th className="py-1 pr-4">临时密码</th>
                </tr>
              </thead>
              <tbody>
                {generatedPasswords.map((item) => (
                  <tr key={`${item.user_id}-${item.temporary_password}`} className="border-t border-amber-200">
                    <td className="py-1 pr-4">{item.employee_name || item.employee_id}</td>
                    <td className="py-1 pr-4">{item.email}</td>
                    <td className="py-1 pr-4">{item.role}</td>
                    <td className="py-1 pr-4 font-mono font-semibold">{item.temporary_password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">员工</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">邮箱</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">员工角色</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">账号角色</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">状态</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">登录</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr key={account.employee_uuid} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{account.employee_name}</div>
                    <div className="text-xs text-gray-500">{account.employee_id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{account.employee_email || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{account.employee_role || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {account.user_role || account.mapped_user_role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${account.user_id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {account.user_id ? '已开通' : '未开通'}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${account.is_bound ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {account.is_bound ? '已绑定' : '未绑定'}
                      </span>
                      {account.must_change_password && (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          需改密
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{account.last_login_at ? new Date(account.last_login_at).toLocaleString() : '-'}</div>
                    <div className="text-xs text-gray-400">{account.login_count ?? 0} 次</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => account.user_id && resetMutation.mutate(account.user_id)}
                      disabled={!account.user_id || resetMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4" />
                      重置密码
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="w-4 h-4 text-green-600" />
        SITE_PS 自动同步为 admin，BPS_ENGINEER 自动同步为 user。
      </div>
    </div>
  );
}
