# Supabase 邮件认证配置清单

## 🎯 开始测试前的准备工作

按照以下步骤配置 Supabase Dashboard，然后使用 `supabase-email-test.html` 测试。

---

## ✅ 配置步骤

### 步骤 1：登录 Supabase Dashboard

1. 打开浏览器，访问：https://supabase.com/dashboard
2. 登录您的 Supabase 账户
3. 选择项目：**BPS-Competency-System**

---

### 步骤 2：启用 Email Provider

1. **左侧菜单** → 点击 `Authentication`
2. **子菜单** → 点击 `Providers`
3. 找到 **Email** 提供商
4. 切换开关为 **Enabled**（绿色）
5. 勾选 **✅ Enable email confirmations**
6. 点击 **Save** 保存

**截图示意**：
```
┌─────────────────────────────────────┐
│ Providers                           │
├─────────────────────────────────────┤
│                                     │
│ Email                    [● ON]     │
│ ✅ Enable email confirmations       │
│                                     │
│ [ Save ]                            │
└─────────────────────────────────────┘
```

---

### 步骤 3：配置邮件模板（可选，但推荐）

#### 3.1 进入邮件模板设置

1. **左侧菜单** → `Authentication` → `Email Templates`

#### 3.2 编辑 "Magic Link" 模板

1. 选择 **Magic Link** 模板
2. 将以下内容复制到 **Email body** 框中：

```html
<h2>BPS 系统登录验证</h2>
<p>您好，</p>
<p>您正在尝试登录 BPS 能力管理系统。请使用以下验证码完成登录：</p>

<div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
  <h1 style="color: #007BC0; font-size: 36px; margin: 0;">{{ .Token }}</h1>
</div>

<p>验证码有效期为 <strong>10 分钟</strong>。</p>
<p>如果这不是您本人的操作，请立即联系系统管理员。</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
<p style="color: #666; font-size: 12px;">
  此邮件由 BPS 能力管理系统自动发送，请勿回复。<br>
  如有问题，请联系系统管理员。
</p>
```

3. 修改 **Subject**：
```
BPS 系统登录验证码
```

4. 点击 **Save** 保存

#### 3.3 编辑 "Confirm signup" 模板（注册验证）

1. 选择 **Confirm signup** 模板
2. 将以下内容复制到 **Email body** 框中：

```html
<h2>欢迎加入 BPS 能力管理系统</h2>
<p>您好，</p>
<p>感谢您注册 BPS 能力管理系统。请使用以下验证码完成注册：</p>

<div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
  <h1 style="color: #007BC0; font-size: 36px; margin: 0;">{{ .Token }}</h1>
</div>

<p>验证码有效期为 <strong>10 分钟</strong>。</p>
<p>如果您没有请求此验证码，请忽略此邮件。</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
<p style="color: #666; font-size: 12px;">
  此邮件由 BPS 能力管理系统自动发送，请勿回复。<br>
  如有问题，请联系系统管理员。
</p>
```

3. 修改 **Subject**：
```
欢迎注册 BPS 系统
```

4. 点击 **Save** 保存

---

### 步骤 4：检查配置

#### 4.1 验证 Email Provider 已启用

1. **左侧菜单** → `Authentication` → `Providers`
2. 确认 **Email** 显示为 **Enabled**（绿色）

#### 4.2 检查邮件发送日志

1. **左侧菜单** → `Authentication` → `Logs`
2. 这里会显示所有认证相关的操作日志
3. 测试后可以在这里查看邮件是否成功发送

---

## 🧪 开始测试

### 方法 1：使用测试页面（推荐）

1. 打开项目根目录的 `supabase-email-test.html` 文件
2. 在浏览器中打开（双击文件或拖入浏览器）
3. 按照页面提示操作：
   - 输入您的邮箱（@bosch.com 或 @bshg.com）
   - 点击"发送验证码"
   - 检查邮箱，获取验证码
   - 输入验证码完成验证

### 方法 2：使用浏览器控制台

1. 打开浏览器控制台（F12 → Console）
2. 复制以下代码并执行：

```javascript
// 1. 创建 Supabase 客户端
const { createClient } = supabase;
const supabaseClient = createClient(
  'https://wpbgzcmpwsktoaowwkpj.supabase.co',
  'sb_publishable_ytPCyU2oEoHxYQYBPdC-8A_QskBu-l4'
);

// 2. 发送验证码（替换为您的邮箱）
await supabaseClient.auth.signInWithOtp({
  email: 'your-email@bosch.com'
});

// 3. 检查邮箱，获取验证码（例如：123456）

// 4. 验证 OTP（替换为您收到的验证码）
await supabaseClient.auth.verifyOtp({
  email: 'your-email@bosch.com',
  token: '123456',
  type: 'email'
});

// 5. 检查登录状态
const { data: { user } } = await supabaseClient.auth.getUser();
console.log('当前用户:', user);
```

---

## ✅ 成功标志

如果配置正确，您应该看到：

1. ✅ **邮件已发送**
   - 邮箱收到验证码邮件（检查垃圾邮件文件夹）
   - Supabase Logs 显示 `email` 事件成功

2. ✅ **验证成功**
   - 控制台显示用户信息
   - 测试页面显示成功消息

3. ✅ **会话创建**
   - `session.access_token` 不为空
   - `user.id` 不为空

---

## ❌ 常见问题排查

### 问题 1：没有收到邮件

**可能原因**：
- Email Provider 未启用
- 邮箱地址错误
- 邮件在垃圾邮件文件夹

**解决方案**：
1. 检查 Supabase Dashboard → Authentication → Providers → Email 是否已启用
2. 检查垃圾邮件文件夹
3. 查看 Supabase Dashboard → Authentication → Logs，确认邮件是否发送成功

### 问题 2：验证码错误

**可能原因**：
- 验证码输入错误（区分大小写）
- 验证码已过期（10 分钟有效期）
- 邮箱地址不匹配

**解决方案**：
1. 确认验证码完全正确
2. 重新发送验证码
3. 确保邮箱地址与发送时一致

### 问题 3：报错 "Invalid login credentials"

**可能原因**：
- Email confirmations 未启用

**解决方案**：
1. 进入 Supabase Dashboard → Authentication → Providers → Email
2. 勾选 **✅ Enable email confirmations**
3. 点击 **Save**

### 问题 4：测试页面报错

**可能原因**：
- Supabase URL 或 ANON KEY 不正确
- 浏览器控制台有 CORS 错误

**解决方案**：
1. 检查 `supabase-email-test.html` 中的 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY`
2. 确保使用的是项目的正确配置（位于 `.env` 文件）

---

## 📊 测试检查清单

测试完成后，请确认以下所有项：

- [ ] Email Provider 已启用
- [ ] Enable email confirmations 已勾选
- [ ] 邮件模板已自定义（可选）
- [ ] 测试邮件已发送
- [ ] 测试邮件已接收（检查了垃圾邮件）
- [ ] 验证码可以正确验证
- [ ] 控制台显示用户信息
- [ ] Supabase Logs 显示成功日志

---

## 🎯 测试成功后的下一步

1. ✅ 执行数据库迁移脚本：
   ```
   openspec/changes/add-email-authentication/migrations/002_add_email_authentication.sql
   ```

2. ✅ 开始实现前端功能：
   - 创建 `authService.ts`
   - 重构 `AuthContext`
   - 实现登录/注册页面

3. ✅ 参考任务清单：
   ```
   openspec/changes/add-email-authentication/tasks.md
   ```

---

## 📚 相关文档

- `QUICK_START.md` - 5 分钟快速开始
- `SUPABASE_EMAIL_AUTH_GUIDE.md` - 详细配置指南
- `tasks.md` - 完整实现任务清单
- `proposal.md` - 方案说明

---

## 📞 需要帮助？

如果遇到问题：
1. 检查 Supabase Dashboard → Authentication → Logs
2. 查看浏览器控制台错误信息
3. 参考 `SUPABASE_EMAIL_AUTH_GUIDE.md` 的故障排查部分

---

**祝测试顺利！** 🎉

