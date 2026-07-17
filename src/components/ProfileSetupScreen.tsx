import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabaseService } from '../lib/supabaseService';
import { getEmployeeProfile } from '../lib/authService';
import { BRAND } from '../lib/branding';
import { User, Briefcase, Building2, Loader2, CheckCircle } from 'lucide-react';
import type { Department } from '../lib/database.types';

export function ProfileSetupScreen() {
  const { authUser, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    employeeId: '',
    position: '',
    departmentId: null as number | null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 获取部门列表
  const { data: departments = [], isLoading: isLoadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => supabaseService.getAllDepartments(),
  });

  // 验证表单
  const isFormValid = formData.name.trim() && formData.employeeId.trim();

  // 更新表单数据
  const updateFormData = (field: keyof typeof formData, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!isFormValid) {
      setError('请填写必填项');
      return;
    }

    if (!authUser) {
      setError('用户信息丢失，请重新登录');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 检查是否已存在该 auth_user_id 的员工记录
      console.log('🔍 检查员工记录，auth_user_id:', authUser.id);
      const { profile: existingEmployee, error: checkError } = await getEmployeeProfile(authUser.id);
      
      console.log('📊 检查结果:', {
        existingEmployee,
        error: checkError
      });
      
      if (checkError) {
        console.error('❌ 检查员工记录失败:', checkError);
      }

      const employeeData = {
        employee_id: formData.employeeId,
        name: formData.name,
        position: formData.position || null,
        department_id: formData.departmentId,
        email: authUser.email!,
        auth_user_id: authUser.id,
        role: 'BPS_ENGINEER', // 新注册用户默认为 BPS 工程师
        is_active: true,
      };

      console.log('📝 准备操作的数据:', employeeData);

      // 如果已存在员工记录，使用 updateProfile 更新
      if (existingEmployee) {
        console.log('✅ 员工记录已存在，执行更新');
        const { error: updateError } = await updateProfile(employeeData);
        
        if (updateError) {
          console.error('❌ 更新失败:', updateError);
          setError(updateError.message || '更新员工记录失败');
          return;
        }
        console.log('✅ 更新成功');
      } else {
        // 不存在则创建新记录
        console.log('➕ 员工记录不存在，执行创建');
        const { error: insertError } = await supabaseService.createEmployee(employeeData);

        if (insertError) {
          console.error('❌ 创建失败:', insertError);
          // 如果是唯一键冲突错误，说明记录已存在，尝试更新
          if (insertError.message.includes('unique constraint')) {
            console.log('🔄 检测到唯一键冲突，尝试更新');
            const { error: updateError } = await updateProfile(employeeData);
            
            if (updateError) {
              console.error('❌ 更新也失败:', updateError);
              setError(updateError.message || '更新员工记录失败');
              return;
            }
            console.log('✅ 更新成功');
          } else {
            setError(insertError.message || '创建员工记录失败');
            return;
          }
        } else {
          console.log('✅ 创建成功');
        }
      }

      // 成功后会自动跳转到主界面（由 AuthContext 处理）
    } catch (err: any) {
      console.error('❌ 提交失败:', err);
      setError(err.message || '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enter 键提交
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isFormValid && !isSubmitting) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            完善个人资料
          </h1>
          <p className="text-gray-700 font-medium">{BRAND.name}</p>
          <p className="text-gray-500 text-sm mt-1">{BRAND.slogan}</p>
          {authUser?.email && (
            <p className="text-sm text-indigo-600 mt-2">
              {authUser.email}
            </p>
          )}
        </div>

        {/* Form */}
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              格式：SWa-BPS_姓_名（拼音）
            </p>
          </div>

          {/* 部门 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              部门（可选）
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={formData.departmentId || ''}
                onChange={(e) => updateFormData('departmentId', e.target.value ? Number(e.target.value) : null)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                disabled={isLoadingDepts}
              >
                <option value="">请选择部门</option>
                {departments.map((dept: Department) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} {dept.code && `(${dept.code})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 职位 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              职位（可选）
            </label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => updateFormData('position', e.target.value)}
              placeholder="例如：软件工程师"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium
                     hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                完成设置
              </>
            )}
          </button>

          {/* 提示信息 */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              提交后您将进入 {BRAND.name} 主界面
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-center text-gray-500">
            {BRAND.footer}
          </p>
        </div>
      </div>
    </div>
  );
}

