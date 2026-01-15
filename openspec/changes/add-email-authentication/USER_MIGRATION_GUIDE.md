# 用户迁移指南

## 📋 概述

本指南说明如何将现有用户从旧的认证系统（简单的员工ID登录）迁移到新的邮箱认证系统。

---

## 🎯 迁移目标

- ✅ 现有用户可以继续使用系统
- ✅ 首次登录时绑定邮箱
- ✅ 绑定后使用邮箱 + 验证码登录
- ✅ 数据不丢失，权限保持不变

---

## 🔄 迁移流程

### 用户视角

```
旧系统登录（员工ID）
    ↓
首次登录检测到未绑定邮箱
    ↓
显示邮箱绑定页面
    ↓
输入邮箱（@bosch.com 或 @bshg.com）
    ↓
接收验证码邮件
    ↓
输入验证码完成绑定
    ↓
自动登录到主应用
    ↓
下次使用邮箱 + 验证码登录
```

### 技术实现

```typescript
// 1. 用户打开应用
// 2. AuthContext 检查登录状态

useEffect(() => {
  const checkAuthStatus = async () => {
    // 检查 Supabase session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // 已登录，加载用户信息
      loadUserFromSession(session);
    } else {
      // 未登录，检查是否有旧的 localStorage 数据
      const oldUserId = localStorage.getItem('currentUserId');
      
      if (oldUserId) {
        // 有旧数据，触发邮箱绑定流程
        setNeedEmailBinding(true);
        setOldEmployeeId(oldUserId);
      } else {
        // 新用户，显示登录页面
        setShowLogin(true);
      }
    }
  };
  
  checkAuthStatus();
}, []);
```

---

## 📱 邮箱绑定页面

### UI 设计

```
┌─────────────────────────────────────┐
│  🔗 绑定邮箱                        │
│                                     │
│  您好，[员工姓名]！                 │
│                                     │
│  为了提升系统安全性，请绑定您的     │
│  Bosch 邮箱。                       │
│                                     │
│  员工ID: [SWa-BPS_Zhang_San]        │
│  部门: [Software]                   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📧 邮箱地址                 │   │
│  │ zhang.san@bosch.com         │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ 发送验证码 ]                     │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔢 验证码                   │   │
│  │ [_][_][_][_][_][_]          │   │
│  └─────────────────────────────┘   │
│                                     │
│  验证码已发送到您的邮箱             │
│  有效期：09:45                      │
│                                     │
│  [ 重新发送 ]  [ 完成绑定 ]         │
│                                     │
│  ⚠️ 如有问题，请联系管理员          │
└─────────────────────────────────────┘
```

### 代码示例

```typescript
// src/components/BindEmailScreen.tsx

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { EmailInput } from './EmailInput';
import { OTPInput } from './OTPInput';

interface BindEmailScreenProps {
  employeeId: string;
  employeeName: string;
  onSuccess: () => void;
}

export function BindEmailScreen({ 
  employeeId, 
  employeeName, 
  onSuccess 
}: BindEmailScreenProps) {
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. 发送验证码
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          data: {
            employee_id: employeeId,
            name: employeeName,
          },
        },
      });

      if (otpError) throw otpError;

      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      setLoading(true);
      setError('');

      // 2. 验证 OTP
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      // 3. 绑定邮箱到现有员工记录
      const { error: bindError } = await supabase.rpc('bind_email_to_employee', {
        p_employee_id: employeeId,
        p_email: email,
        p_auth_user_id: data.user!.id,
      });

      if (bindError) throw bindError;

      // 4. 清除旧的 localStorage
      localStorage.removeItem('currentUserId');

      // 5. 绑定成功
      onSuccess();
    } catch (err: any) {
      setError(err.message || '验证失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          🔗 绑定邮箱
        </h2>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            您好，<strong>{employeeName}</strong>！
          </p>
          <p className="text-gray-600 text-sm mb-4">
            为了提升系统安全性，请绑定您的 Bosch 邮箱。
          </p>
          <div className="bg-blue-50 p-3 rounded-md text-sm">
            <p><strong>员工ID:</strong> {employeeId}</p>
          </div>
        </div>

        {!otpSent ? (
          <>
            <EmailInput
              value={email}
              onChange={setEmail}
              placeholder="请输入您的 Bosch 邮箱"
              disabled={loading}
            />
            
            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}

            <button
              onClick={handleSendOTP}
              disabled={!email || loading}
              className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              验证码已发送到 <strong>{email}</strong>
            </p>

            <OTPInput
              value={otp}
              onChange={setOtp}
              length={6}
              disabled={loading}
            />

            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSendOTP}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                重新发送
              </button>
              <button
                onClick={handleVerifyOTP}
                disabled={otp.length !== 6 || loading}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '验证中...' : '完成绑定'}
              </button>
            </div>
          </>
        )}

        <p className="text-xs text-gray-500 text-center mt-6">
          ⚠️ 如有问题，请联系系统管理员
        </p>
      </div>
    </div>
  );
}
```

---

## 🔧 管理员协助

### 场景 1：员工忘记邮箱

**问题**：员工不记得自己的 Bosch 邮箱地址。

**解决方案**：
1. 管理员在 Bosch 通讯录查找员工邮箱
2. 告知员工正确的邮箱地址
3. 员工重新绑定

### 场景 2：邮箱已被其他账号使用

**问题**：员工尝试绑定邮箱时提示"邮箱已被使用"。

**解决方案**：
```sql
-- 1. 查找冲突的账号
SELECT employee_id, name, email, auth_user_id
FROM public.employees
WHERE email = 'conflict@bosch.com';

-- 2. 如果是重复账号，删除旧的
DELETE FROM public.employees
WHERE employee_id = 'OLD_DUPLICATE_ID';

-- 3. 如果是误绑定，解除绑定
UPDATE public.employees
SET email = NULL, auth_user_id = NULL
WHERE employee_id = 'WRONG_ACCOUNT';
```

### 场景 3：批量导入邮箱

**问题**：有大量员工需要迁移，手动绑定效率低。

**解决方案**：
```sql
-- 准备 CSV 文件（employee_id, email）
-- 示例：
-- SWa-BPS_Zhang_San,zhang.san@bosch.com
-- SWa-BPS_Li_Si,li.si@bosch.com

-- 批量更新邮箱（需要员工首次登录时验证）
UPDATE public.employees e
SET email = mapping.email
FROM (VALUES
  ('SWa-BPS_Zhang_San', 'zhang.san@bosch.com'),
  ('SWa-BPS_Li_Si', 'li.si@bosch.com')
  -- ... 更多数据
) AS mapping(employee_id, email)
WHERE e.employee_id = mapping.employee_id;

-- 注意：auth_user_id 仍需员工首次登录时通过 OTP 验证后自动绑定
```

---

## ⚠️ 常见问题

### Q1: 绑定后原来的员工ID还能用吗？

**答**：不能。绑定邮箱后，系统会使用邮箱 + 验证码登录。员工ID仅作为内部标识保留。

### Q2: 如果员工离职了怎么办？

**答**：管理员可以停用账号：
```sql
UPDATE public.employees
SET is_active = false
WHERE employee_id = 'EMPLOYEE_ID';
```

### Q3: 能否跳过邮箱绑定？

**答**：不能。邮箱绑定是强制的，以确保系统安全性。

### Q4: 绑定过程中出错怎么办？

**答**：
1. 检查邮箱格式是否正确（必须是 @bosch.com 或 @bshg.com）
2. 检查验证码是否正确（区分大小写）
3. 检查验证码是否过期（10 分钟有效期）
4. 如果仍然失败，联系管理员

---

## 📊 迁移进度追踪

管理员可以使用以下 SQL 查询迁移进度：

```sql
-- 查看迁移统计
SELECT 
  COUNT(*) as total_employees,
  COUNT(auth_user_id) as migrated_count,
  COUNT(*) - COUNT(auth_user_id) as pending_count,
  ROUND(COUNT(auth_user_id)::NUMERIC / COUNT(*) * 100, 2) as migration_percentage
FROM public.employees
WHERE is_active = true;

-- 查看未迁移的员工列表
SELECT 
  employee_id,
  name,
  department_id,
  role
FROM public.employees
WHERE is_active = true
AND auth_user_id IS NULL
ORDER BY name;

-- 查看最近迁移的员工
SELECT 
  employee_id,
  name,
  email,
  created_at
FROM public.employees
WHERE auth_user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🎯 迁移时间表

| 阶段 | 时间 | 目标 |
|------|------|------|
| **准备阶段** | 第 1 天 | 数据库迁移，Supabase 配置 |
| **测试阶段** | 第 2-3 天 | 小范围测试（5-10 人） |
| **推广阶段** | 第 4-7 天 | 全员通知，逐步迁移 |
| **完成阶段** | 第 8-14 天 | 100% 迁移完成 |

---

## 📧 通知模板

### 给员工的通知邮件

```
主题：【重要】BPS 系统升级 - 需要绑定邮箱

您好，

BPS 能力管理系统已升级，新增邮箱认证功能以提升安全性。

请在下次登录时按照提示绑定您的 Bosch 邮箱。

操作步骤：
1. 打开 BPS 系统
2. 输入您的邮箱地址（@bosch.com 或 @bshg.com）
3. 接收验证码邮件
4. 输入验证码完成绑定

如有问题，请联系：
- 管理员：Wang Ning (wang.ning@bosch.com)
- 技术支持：Liu Kui (liu.kui@bosch.com)

感谢您的配合！

BPS 系统管理团队
```

---

## ✅ 迁移完成检查清单

- [ ] 所有活跃员工已绑定邮箱
- [ ] 邮件发送功能正常
- [ ] 登录流程测试通过
- [ ] 权限检查正常
- [ ] 旧的 localStorage 数据已清理
- [ ] 用户反馈收集完成
- [ ] 文档更新完成

---

## 📚 相关文档

- `proposal.md` - 完整方案说明
- `tasks.md` - 实现任务清单
- `QUICK_START.md` - 快速开始指南
- `SUPABASE_EMAIL_AUTH_GUIDE.md` - Supabase 配置指南

