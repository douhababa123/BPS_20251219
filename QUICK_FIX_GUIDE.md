# ⚡ 快速修复指南 - OTP Token 错误

## ✅ 已修复的问题

我已经修复了代码中的两个关键问题：

### 修复 1: SignupScreen 使用错误的验证类型
**问题**: 使用了 `'signup'` 类型  
**修复**: 改为 `'email'` 类型

```typescript
// ❌ 修复前
await verifyOTP(formData.email, otp, 'signup');

// ✅ 修复后
await verifyOTP(formData.email, otp, 'email');
```

### 修复 2: signupWithEmail 缺少 shouldCreateUser
**问题**: 没有明确允许创建新用户  
**修复**: 添加 `shouldCreateUser: true`

```typescript
// ✅ 修复后
const { data: authData, error } = await supabase.auth.signInWithOtp({
  email: data.email,
  options: {
    shouldCreateUser: true, // 允许创建新用户
    data: {
      name: data.name,
      ...data.metadata,
    },
  },
});
```

---

## 🚀 立即测试

### 步骤 1: 重启开发服务器
```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npm run dev
```

### 步骤 2: 测试注册流程
1. 打开浏览器访问注册页面
2. 填写基本信息（姓名、员工编号）
3. 输入邮箱（@bosch.com 或 @bshg.com）
4. 点击"发送验证码"
5. 检查邮箱，复制 6 位验证码
6. **快速输入验证码**（10 分钟内）
7. 点击"完成注册"

### 步骤 3: 如果仍然失败
查看浏览器控制台（F12），并告诉我错误信息。

---

## 🔍 为什么会出现这个错误？

### Supabase OTP 验证类型说明

Supabase 的 `verifyOtp` 函数需要指定验证类型（`type`），不同的发送方式对应不同的类型：

| 发送方式 | 验证类型 | 说明 |
|---------|---------|------|
| `signInWithOtp()` | `'email'` | 邮箱登录/注册 OTP |
| `signUp()` | `'signup'` | 传统注册确认 |
| Magic Link | `'magiclink'` | 魔法链接 |
| 密码重置 | `'recovery'` | 密码恢复 |
| 邀请 | `'invite'` | 用户邀请 |

**我们使用的是 `signInWithOtp()`，所以必须使用 `'email'` 类型！**

---

## 📋 完整的注册流程

### 后端流程（Supabase）
```
1. signInWithOtp({ email, options: { shouldCreateUser: true } })
   ↓
2. Supabase 发送邮件（包含 6 位 OTP）
   ↓
3. verifyOtp({ email, token, type: 'email' })
   ↓
4. Supabase 验证 OTP
   ↓
5. 创建新用户（如果不存在）
   ↓
6. 返回 session 和 user
```

### 前端流程（我们的应用）
```
1. 用户填写基本信息
   ↓
2. 用户输入邮箱
   ↓
3. 调用 signupWithEmail(email, name)
   ↓
4. 显示 OTP 输入界面
   ↓
5. 用户输入 6 位验证码
   ↓
6. 调用 verifyOTP(email, otp, 'email')
   ↓
7. AuthContext 自动更新用户状态
   ↓
8. 跳转到主界面
```

---

## 🎯 测试检查清单

测试前请确认：

- [x] ✅ 代码已修复（SignupScreen 使用 'email' 类型）
- [x] ✅ 代码已修复（signupWithEmail 添加 shouldCreateUser）
- [ ] 🔄 开发服务器已重启
- [ ] 📧 邮箱可以收到验证码
- [ ] ⏱️ 验证码在 10 分钟内输入
- [ ] 🔢 验证码是 6 位数字
- [ ] 📧 邮箱地址完全一致

---

## 💡 提示

### 如果验证码过期
- 点击"重新发送验证码"
- 等待 60 秒倒计时结束
- 获取新的验证码
- **快速输入**新验证码

### 如果邮件延迟
- 检查垃圾邮件文件夹
- 等待 1-2 分钟
- 如果仍未收到，点击"重新发送"

### 如果提示"用户已存在"
- 说明该邮箱已注册
- 请使用登录功能
- 或使用其他邮箱注册

---

## 🐛 调试技巧

### 查看详细错误
打开浏览器控制台（F12），查看：
```javascript
// 成功的响应
{
  user: { id: "...", email: "..." },
  session: { access_token: "...", ... },
  error: null
}

// 失败的响应
{
  user: null,
  session: null,
  error: {
    message: "Token has expired or is invalid",
    status: 400
  }
}
```

### 测试 Supabase 配置
使用 `supabase-email-test.html` 测试页面：
```bash
# 直接在浏览器中打开
open supabase-email-test.html
```

---

## ✅ 预期结果

### 成功注册后
1. ✅ 验证码验证成功
2. ✅ 自动登录
3. ✅ 跳转到主界面
4. ✅ 显示用户信息

### 如果失败
1. ❌ 显示错误消息
2. 🔄 可以重新发送验证码
3. 🔄 可以返回修改邮箱

---

**现在请重启开发服务器并测试！** 🚀

如果仍然有问题，请提供：
1. 浏览器控制台的错误信息
2. 验证码是否在 10 分钟内输入
3. 邮箱地址是否完全一致

我会继续帮您诊断！

