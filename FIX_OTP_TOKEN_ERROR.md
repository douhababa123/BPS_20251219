# 🔧 修复 "Token has expired or is invalid" 错误

## 🔍 问题诊断

您遇到的错误 "Token has expired or is invalid" 通常由以下原因引起：

1. **验证码类型不匹配** ✅ 已修复
2. **Supabase Email OTP 配置问题** ⚠️ 需要检查
3. **验证码已过期** ⚠️ 需要快速输入
4. **Supabase 用户创建设置** ⚠️ 需要检查

---

## ✅ 已修复的代码问题

### 修复 1: 添加 `shouldCreateUser: true`
在 `authService.ts` 的 `signupWithEmail` 函数中，我已经添加了 `shouldCreateUser: true`：

```typescript
// 发送 OTP（注册时允许创建新用户）
const { data: authData, error } = await supabase.auth.signInWithOtp({
  email: data.email,
  options: {
    shouldCreateUser: true, // ✅ 允许创建新用户
    data: {
      name: data.name,
      ...data.metadata,
    },
  },
});
```

---

## 🔧 需要检查的 Supabase 配置

### 步骤 1: 检查 Email Provider 设置

1. 打开 Supabase Dashboard
2. 进入您的项目
3. 点击左侧菜单 **Authentication** → **Providers**
4. 找到 **Email** 提供商

**必须确保以下设置**:
```
✅ Enable Email provider: ON
✅ Confirm email: OFF（开发阶段）
✅ Secure email change: OFF（开发阶段）
✅ Enable Email OTP: ON
```

### 步骤 2: 检查 Email Templates

1. 在 Authentication 菜单中，点击 **Email Templates**
2. 选择 **Magic Link** 模板
3. 确保邮件内容包含 `{{ .Token }}` 而不是 `{{ .ConfirmationURL }}`

**正确的模板示例**:
```html
<h2>您的验证码</h2>
<p>您的 6 位验证码是：</p>
<h1>{{ .Token }}</h1>
<p>验证码有效期为 10 分钟。</p>
```

### 步骤 3: 检查 OTP 设置

1. 在 Authentication → Providers → Email 中
2. 找到 **Email OTP** 部分
3. 确保设置如下：

```
OTP expiry duration: 600 秒（10 分钟）
OTP length: 6 位
```

### 步骤 4: 检查用户创建设置

1. 在 Authentication 菜单中，点击 **Settings**
2. 找到 **User Signups** 部分
3. 确保设置如下：

```
✅ Enable email signups: ON
✅ Enable phone signups: OFF
```

---

## 🧪 测试步骤

### 方法 1: 使用测试页面（推荐）

1. 打开 `supabase-email-test.html`
2. 输入您的邮箱
3. 点击"发送验证码"
4. 检查邮件
5. 输入验证码
6. 查看结果

**如果测试页面成功**，说明 Supabase 配置正确，问题在应用代码中。  
**如果测试页面也失败**，说明 Supabase 配置有问题。

### 方法 2: 检查浏览器控制台

1. 打开浏览器开发者工具（F12）
2. 切换到 **Console** 标签
3. 尝试注册
4. 查看详细的错误信息

**常见错误信息**:
```javascript
// 错误 1: Token 过期
{
  "error": "Token has expired or is invalid",
  "code": "otp_expired"
}

// 错误 2: Token 不匹配
{
  "error": "Token has expired or is invalid", 
  "code": "otp_invalid"
}

// 错误 3: 用户已存在
{
  "error": "User already registered",
  "code": "user_already_exists"
}
```

---

## 🔍 详细诊断

### 检查 1: 验证码是否正确

1. 确保您输入的是 **6 位数字**
2. 确保没有多余的空格
3. 确保验证码没有过期（10 分钟内）

### 检查 2: 邮箱地址是否一致

确保：
- 发送验证码时使用的邮箱
- 验证时使用的邮箱
- **完全一致**（包括大小写）

### 检查 3: Supabase 项目 URL 和 Key

检查 `src/lib/supabase.ts` 中的配置：

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

确保 `.env` 文件中的值正确：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🚀 快速修复方案

### 方案 1: 使用 Magic Link 代替 OTP（临时）

如果 OTP 一直有问题，可以临时使用 Magic Link：

1. 在 Supabase Dashboard 中
2. Authentication → Email Templates → Magic Link
3. 将模板改回使用 `{{ .ConfirmationURL }}`
4. 用户点击链接即可登录（无需输入验证码）

### 方案 2: 增加验证码有效期

1. 在 Supabase Dashboard 中
2. Authentication → Providers → Email
3. 将 **OTP expiry duration** 改为 **3600 秒**（1 小时）
4. 这样有更多时间输入验证码

### 方案 3: 添加详细日志

在 `src/lib/authService.ts` 的 `verifyOTP` 函数中添加日志：

```typescript
export async function verifyOTP(data: VerifyOTPData): Promise<AuthResponse> {
  try {
    console.log('🔍 验证 OTP:', {
      email: data.email,
      token: data.token,
      type: data.type,
      tokenLength: data.token.length,
    });

    const { data: authData, error } = await supabase.auth.verifyOtp({
      email: data.email,
      token: data.token,
      type: data.type,
    });

    if (error) {
      console.error('❌ OTP 验证失败:', error);
      return { user: null, session: null, error };
    }

    console.log('✅ OTP 验证成功:', authData);
    
    // ... 其余代码
  }
}
```

---

## 📋 检查清单

在继续之前，请确认：

- [ ] Supabase Email Provider 已启用
- [ ] Email OTP 已启用
- [ ] OTP 长度设置为 6 位
- [ ] Email Templates 使用 `{{ .Token }}`
- [ ] User Signups 已启用
- [ ] 邮箱域名是 @bosch.com 或 @bshg.com
- [ ] 验证码在 10 分钟内输入
- [ ] 邮箱地址完全一致
- [ ] 验证码是 6 位数字

---

## 🎯 下一步

### 如果问题仍然存在

1. **查看 Supabase Logs**
   - Supabase Dashboard → Logs → Auth Logs
   - 查看详细的错误信息

2. **尝试测试页面**
   - 使用 `supabase-email-test.html`
   - 确认 Supabase 配置正确

3. **联系我**
   - 提供浏览器控制台的错误信息
   - 提供 Supabase Auth Logs 的截图
   - 我会帮您进一步诊断

---

## 💡 常见解决方案

### 问题: "Token has expired"
**原因**: 验证码已过期  
**解决**: 点击"重新发送验证码"，快速输入新验证码

### 问题: "Token is invalid"
**原因**: 验证码不正确或类型不匹配  
**解决**: 
1. 检查验证码是否正确
2. 确保使用 `type: 'email'` 而不是 `type: 'signup'`

### 问题: "User already registered"
**原因**: 邮箱已被注册  
**解决**: 使用登录功能而不是注册

---

**生成时间**: 2026-01-15  
**状态**: 🔧 等待测试  
**下一步**: 检查 Supabase 配置并重新测试

