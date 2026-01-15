# 🚀 快速开始：5 分钟实现邮箱认证

## 📋 前置条件

- ✅ Supabase 项目已创建
- ✅ 项目可以正常连接 Supabase

---

## 🎯 核心概念

### Supabase 如何发送邮件？

**简单回答**：Supabase 自动帮你发送邮件，无需任何配置！

```
用户输入邮箱 → Supabase 发送验证码 → 用户输入验证码 → 登录成功
```

**技术细节**：
1. Supabase 内置邮件服务（免费）
2. 每小时最多发送 30 封邮件（开发环境足够）
3. 生产环境可以配置自己的 SMTP 服务器

---

## ⚡ 3 步启用邮箱认证

### 步骤 1：Supabase Dashboard 配置（2 分钟）

1. 打开 Supabase Dashboard：https://supabase.com/dashboard
2. 选择您的项目
3. 左侧菜单：`Authentication` > `Providers`
4. 找到 `Email`，切换开关为 **Enabled**
5. 勾选 `Enable email confirmations`

**完成！** Supabase 现在可以发送邮件了。

### 步骤 2：修改 Supabase 客户端配置（1 分钟）

打开 `src/lib/supabase.ts`，修改配置：

```typescript
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // 改为 true（持久化会话）
    autoRefreshToken: true, // 自动刷新 Token
  },
});
```

### 步骤 3：测试邮件发送（2 分钟）

在浏览器控制台执行：

```javascript
// 1. 发送验证码
await supabase.auth.signInWithOtp({
  email: 'your-email@bosch.com' // 替换为你的邮箱
});

// 2. 检查邮箱，获取验证码（例如：123456）

// 3. 验证 OTP
await supabase.auth.verifyOtp({
  email: 'your-email@bosch.com',
  token: '123456', // 替换为你收到的验证码
  type: 'email'
});

// 4. 检查是否登录成功
const { data: { user } } = await supabase.auth.getUser();
console.log('当前用户:', user);
```

**如果收到邮件，说明配置成功！** ✅

---

## 📧 邮件模板自定义（可选）

如果想要中文邮件模板：

1. `Authentication` > `Email Templates`
2. 选择 `Magic Link` 模板
3. 修改内容：

```html
<h2>BPS 系统登录验证</h2>
<p>您的验证码是：</p>
<h1 style="color: #007BC0;">{{ .Token }}</h1>
<p>验证码有效期为 10 分钟。</p>
```

4. 点击 `Save`

---

## 🔧 常见问题

### Q1: 邮件没收到？
- 检查垃圾邮件文件夹
- 确认邮箱地址正确
- 查看 Supabase Dashboard > Authentication > Logs

### Q2: 验证码过期？
- 默认有效期 10 分钟
- 重新发送验证码即可

### Q3: 如何限制只有 @bosch.com 邮箱才能注册？
在前端验证：

```typescript
function validateEmail(email: string): boolean {
  if (!email.endsWith('@bosch.com')) {
    throw new Error('只允许使用 Bosch 邮箱注册');
  }
  return true;
}
```

### Q4: 生产环境如何配置？
- 配置自己的 SMTP 服务器（Bosch 邮件服务器）
- `Settings` > `Auth` > `SMTP Settings`
- 填写 SMTP 信息（需要 IT 部门提供）

---

## 📝 下一步

现在您已经了解了 Supabase 邮箱认证的基本原理，可以开始实现：

1. **注册页面**：用户输入邮箱 → 发送验证码 → 验证 OTP
2. **登录页面**：用户输入邮箱 → 发送验证码 → 验证 OTP
3. **账号管理**：查看/修改个人信息

详细实现步骤请参考：
- `proposal.md` - 完整方案
- `SUPABASE_EMAIL_AUTH_GUIDE.md` - 技术指南
- `tasks.md` - 实现任务清单（即将创建）

---

## 🎉 总结

**Supabase 邮箱认证非常简单**：

1. ✅ Supabase 自动发送邮件（无需配置）
2. ✅ 免费额度足够开发使用
3. ✅ 生产环境可配置自己的 SMTP
4. ✅ 安全可靠（一次性验证码）

**您不需要担心邮件发送的技术细节，Supabase 已经帮您处理好了！**

