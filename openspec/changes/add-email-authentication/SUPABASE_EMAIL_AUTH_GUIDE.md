# Supabase 邮箱认证配置指南

## 📧 Supabase 如何发送邮件？

### 1. 默认邮件服务（开发环境）

Supabase 提供**免费的邮件发送服务**，无需任何配置：

- ✅ **自动配置**：创建项目后即可使用
- ✅ **免费额度**：
  - 每小时最多 **30 封邮件**
  - 每天最多 **300 封邮件**
- ✅ **发件人地址**：`noreply@mail.supabase.io`
- ⚠️ **限制**：
  - 可能被标记为垃圾邮件
  - 发送速率有限制
  - 不适合生产环境

### 2. 自定义 SMTP（生产环境）

对于企业应用，建议配置自己的 SMTP 服务器：

```bash
# Supabase Dashboard > Settings > Auth > SMTP Settings

SMTP Host: smtp.office365.com (Bosch 邮件服务器)
SMTP Port: 587
SMTP User: bps-system@bosch.com
SMTP Password: [从 IT 部门获取]
Sender Email: bps-system@bosch.com
Sender Name: BPS 能力管理系统
```

**优势**：
- ✅ 更高的送达率（不会被标记为垃圾邮件）
- ✅ 无发送限制
- ✅ 使用公司域名（@bosch.com）
- ✅ 符合企业安全规范

---

## 🔧 配置步骤

### 步骤 1：启用邮箱 OTP 认证

1. **登录 Supabase Dashboard**
   - 访问：https://supabase.com/dashboard
   - 选择您的项目：`BPS-Competency-System`

2. **进入 Authentication 设置**
   - 左侧菜单：`Authentication` > `Providers`

3. **启用 Email Provider**
   - 找到 `Email` 提供商
   - 切换开关为 **Enabled**
   - 勾选 `Enable email confirmations`（启用邮箱验证）

4. **配置 OTP 设置**
   ```
   OTP expiry: 600 seconds (10 分钟)
   OTP length: 6 digits
   ```

### 步骤 2：自定义邮件模板（中文）

1. **进入邮件模板设置**
   - `Authentication` > `Email Templates`

2. **编辑"Confirm signup"模板**（注册验证）
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

3. **编辑"Magic Link"模板**（登录验证）
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

### 步骤 3：配置 URL 重定向（可选）

如果使用 Magic Link（邮件中的链接），需要配置重定向 URL：

```
Site URL: http://localhost:5173 (开发环境)
Redirect URLs: 
  - http://localhost:5173/auth/callback
  - https://your-production-domain.com/auth/callback
```

**注意**：本项目使用 **OTP（验证码）** 方式，不需要配置重定向 URL。

### 步骤 4：限制注册域名（可选）

如果只允许 @bosch.com 邮箱注册：

1. **进入 Auth Policies**
   - `Authentication` > `Policies`

2. **添加自定义策略**
   ```sql
   -- 限制只有 @bosch.com 邮箱才能注册
   CREATE POLICY "Only Bosch emails can sign up"
   ON auth.users
   FOR INSERT
   WITH CHECK (
     email LIKE '%@bosch.com'
   );
   ```

**或者在前端验证**（更灵活）：
```typescript
function validateEmail(email: string): boolean {
  return email.endsWith('@bosch.com');
}
```

---

## 💻 前端代码示例

### 1. 注册流程

```typescript
import { supabase } from './lib/supabase';

async function signupWithEmail(email: string, name: string) {
  // 1. 验证邮箱域名
  if (!email.endsWith('@bosch.com')) {
    throw new Error('只允许使用 Bosch 邮箱注册');
  }

  // 2. 发送注册验证码
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      data: {
        name: name, // 用户元数据
      },
    },
  });

  if (error) throw error;

  // 3. 提示用户检查邮箱
  alert(`验证码已发送到 ${email}，请查收邮件。`);
}
```

### 2. 验证 OTP

```typescript
async function verifyOTP(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email,
    token: token,
    type: 'email', // 或 'signup' / 'magiclink'
  });

  if (error) throw error;

  // 验证成功，用户已登录
  console.log('登录成功:', data.user);
  
  // 获取 session
  const session = data.session;
  console.log('Session:', session);
}
```

### 3. 登录流程

```typescript
async function loginWithEmail(email: string) {
  // 发送登录验证码
  const { error } = await supabase.auth.signInWithOtp({
    email: email,
  });

  if (error) throw error;

  alert(`登录验证码已发送到 ${email}，请查收邮件。`);
}
```

### 4. 获取当前用户

```typescript
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) throw error;
  
  return user;
}
```

### 5. 登出

```typescript
async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

---

## 🔒 安全配置

### 1. 启用 RLS（Row Level Security）

```sql
-- 启用 employees 表的 RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能查看和修改自己的数据
CREATE POLICY "Users can view own data"
ON public.employees
FOR SELECT
USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own data"
ON public.employees
FOR UPDATE
USING (auth.uid() = auth_user_id);

-- 策略：管理员可以查看所有数据
CREATE POLICY "Admins can view all data"
ON public.employees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid()
    AND role = 'ADMIN'
  )
);
```

### 2. 配置会话过期时间

```typescript
// src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // 持久化会话
    autoRefreshToken: true, // 自动刷新 Token
    detectSessionInUrl: false, // 不从 URL 检测会话（使用 OTP）
  },
});
```

---

## 🧪 测试流程

### 1. 测试注册

```bash
# 在浏览器控制台执行
await supabase.auth.signInWithOtp({
  email: 'your-email@bosch.com',
  options: {
    data: { name: 'Test User' }
  }
});

# 检查邮箱，获取验证码（例如：123456）

await supabase.auth.verifyOtp({
  email: 'your-email@bosch.com',
  token: '123456',
  type: 'email'
});
```

### 2. 检查数据库

```sql
-- 查看 auth.users 表
SELECT id, email, created_at FROM auth.users;

-- 查看 employees 表（应该自动创建记录）
SELECT id, auth_user_id, email, name, role FROM public.employees;
```

### 3. 测试登录

```bash
# 登出
await supabase.auth.signOut();

# 重新登录
await supabase.auth.signInWithOtp({
  email: 'your-email@bosch.com'
});

# 输入验证码
await supabase.auth.verifyOtp({
  email: 'your-email@bosch.com',
  token: '654321',
  type: 'email'
});
```

---

## 📊 监控和调试

### 1. 查看邮件发送日志

- `Authentication` > `Logs`
- 筛选 `email` 事件
- 查看发送状态（成功/失败）

### 2. 常见问题

**问题 1：邮件未收到**
- 检查垃圾邮件文件夹
- 确认邮箱地址正确
- 查看 Supabase 日志（是否发送成功）

**问题 2：验证码过期**
- OTP 默认有效期 10 分钟
- 提供"重新发送验证码"功能

**问题 3：`auth.users` 和 `employees` 表不同步**
- 检查触发器是否正确创建
- 手动执行触发器函数测试

---

## 🚀 生产环境配置清单

- [ ] 配置 Bosch SMTP 服务器
- [ ] 限制注册域名为 @bosch.com
- [ ] 启用 RLS 策略
- [ ] 配置会话过期时间
- [ ] 自定义邮件模板（中文）
- [ ] 测试邮件送达率
- [ ] 配置监控和告警
- [ ] 准备用户迁移方案

---

## 📚 参考资料

- [Supabase Auth 官方文档](https://supabase.com/docs/guides/auth)
- [Email OTP 配置指南](https://supabase.com/docs/guides/auth/auth-email)
- [自定义 SMTP 配置](https://supabase.com/docs/guides/auth/auth-smtp)
- [RLS 策略示例](https://supabase.com/docs/guides/auth/row-level-security)

