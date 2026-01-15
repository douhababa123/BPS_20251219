# Proposal: 添加邮箱认证系统

**Change ID**: `add-email-authentication`  
**Status**: Draft  
**Created**: 2026-01-14  
**Author**: AI Assistant

## Why

### 当前问题
- 系统使用简单的员工ID登录（`AuthContext`），没有真正的身份验证
- 缺少用户注册流程，新员工需要手动添加到数据库
- 没有密码保护，任何人知道员工ID就能登录
- 不符合企业级应用的安全标准

### 业务价值
- ✅ **安全性**：通过邮箱验证码确保用户身份真实性
- ✅ **自助注册**：新员工可以自行注册，减少管理员工作量
- ✅ **账号管理**：用户可以管理自己的账号信息（邮箱、密码、个人资料）
- ✅ **审计追踪**：通过 Supabase Auth 记录登录历史和操作日志

### 为什么选择邮箱验证码方式？
- 🚀 **无需密码**：用户体验更好，无需记住复杂密码
- 🔒 **更安全**：每次登录使用一次性验证码（OTP）
- 📧 **企业邮箱**：可以限制只有 Bosch 邮箱（@bosch.com）才能注册
- 💰 **Supabase 内置**：Supabase Auth 原生支持邮箱 OTP，无需额外开发

---

## What

### 核心功能

#### 1. 用户注册（Email Signup）
- 用户输入邮箱地址（限制 @bosch.com 域名）
- 系统发送验证码到邮箱
- 用户输入验证码完成注册
- 自动创建 `employees` 表记录（初始角色为 `BPS_ENGINEER`）

#### 2. 用户登录（Email Login）
- 用户输入邮箱地址
- 系统发送一次性登录验证码（Magic Link 或 OTP）
- 用户输入验证码完成登录
- 系统加载用户信息到 `AuthContext`

#### 3. 账号管理（Account Management）
- 查看个人信息（姓名、邮箱、部门、角色）
- 修改个人资料（姓名、联系方式）
- 查看登录历史
- 注销账号（软删除，设置 `is_active = false`）

#### 4. 管理员功能（Admin Only）
- 查看所有用户列表
- 修改用户角色（BPS_ENGINEER / SITE_PS / ADMIN）
- 激活/停用用户账号
- 批量导入员工（从 Excel）

---

## How

### 技术方案

#### 1. Supabase Auth 配置

**启用邮箱 OTP 认证**：
```sql
-- Supabase Dashboard > Authentication > Providers
-- 启用 Email (OTP) 提供商
-- 配置邮件模板（中文）
```

**邮件发送**：
- Supabase 自动处理邮件发送（免费套餐：每小时 30 封邮件）
- 可选：配置自定义 SMTP（使用 Bosch 邮件服务器）

#### 2. 数据库架构变更

**`employees` 表添加字段**：
```sql
ALTER TABLE public.employees 
ADD COLUMN auth_user_id UUID REFERENCES auth.users(id),
ADD COLUMN email TEXT UNIQUE,
ADD COLUMN phone TEXT,
ADD COLUMN created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- 创建索引
CREATE INDEX idx_employees_auth_user_id ON public.employees(auth_user_id);
CREATE INDEX idx_employees_email ON public.employees(email);
```

**触发器：自动同步 Auth 用户**：
```sql
-- 当 auth.users 创建新用户时，自动在 employees 表创建记录
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.employees (
    id,
    auth_user_id,
    employee_id,
    email,
    name,
    role,
    is_active
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    'BPS_' || substring(NEW.email from 1 for 8), -- 临时员工ID
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'BPS_ENGINEER',
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### 3. 前端实现

**新增组件**：
- `SignupScreen.tsx` - 注册页面
- `LoginScreen.tsx` - 登录页面（已存在，需重构）
- `AccountManagement.tsx` - 账号管理页面
- `VerifyOTPModal.tsx` - 验证码输入弹窗

**更新 AuthContext**：
```typescript
interface AuthContextType {
  currentUser: Employee | null;
  session: Session | null; // Supabase session
  isLoading: boolean;
  
  // 新增方法
  signupWithEmail: (email: string, name: string) => Promise<void>;
  loginWithEmail: (email: string) => Promise<void>;
  verifyOTP: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<Employee>) => Promise<void>;
  
  // 权限检查（保持不变）
  isSitePS: boolean;
  isAdmin: boolean;
  canEditEmployee: (employeeId: string) => boolean;
}
```

**路由保护**：
```typescript
// App.tsx
function App() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!currentUser) return <LoginScreen />;

  return <MainApp />;
}
```

#### 4. 邮件模板（中文）

**注册验证码邮件**：
```html
<h2>欢迎加入 BPS 能力管理系统</h2>
<p>您的验证码是：</p>
<h1 style="color: #007BC0;">{{ .Token }}</h1>
<p>验证码有效期为 10 分钟。</p>
<p>如果您没有请求此验证码，请忽略此邮件。</p>
```

**登录验证码邮件**：
```html
<h2>BPS 系统登录验证</h2>
<p>您的登录验证码是：</p>
<h1 style="color: #007BC0;">{{ .Token }}</h1>
<p>验证码有效期为 10 分钟。</p>
```

---

## Impact

### 用户影响
- **现有用户**：需要首次绑定邮箱（迁移流程）
- **新用户**：通过邮箱注册，体验更流畅
- **管理员**：减少手动添加员工的工作量

### 系统影响
- **数据库**：`employees` 表添加字段，需要迁移脚本
- **认证流程**：从简单的员工ID登录改为邮箱OTP登录
- **会话管理**：使用 Supabase Session 管理登录状态

### 性能影响
- **邮件发送**：Supabase 免费套餐限制（每小时 30 封），生产环境需配置自定义 SMTP
- **数据库查询**：增加 `auth_user_id` 关联查询，需添加索引优化

---

## Migration

### 阶段 1：数据库准备（1 天）
1. 执行 SQL 迁移脚本
2. 为现有员工生成临时邮箱（测试用）
3. 配置 Supabase Auth 邮件模板

### 阶段 2：前端实现（2-3 天）
1. 实现注册/登录页面
2. 重构 `AuthContext` 集成 Supabase Auth
3. 实现账号管理页面
4. 添加路由保护

### 阶段 3：测试与迁移（1 天）
1. 测试注册/登录流程
2. 测试邮件发送（使用真实邮箱）
3. 现有用户迁移（首次登录绑定邮箱）

### 阶段 4：生产部署（可选）
1. 配置 Bosch SMTP 服务器
2. 限制注册域名为 @bosch.com
3. 启用 RLS 策略

---

## Risks

### 技术风险
- ⚠️ **邮件送达率**：Supabase 默认邮件可能被标记为垃圾邮件
  - **缓解**：配置自定义 SMTP（Bosch 邮件服务器）
  
- ⚠️ **验证码过期**：用户可能在 10 分钟内未输入验证码
  - **缓解**：提供"重新发送验证码"功能

- ⚠️ **会话管理**：Supabase Session 可能过期
  - **缓解**：自动刷新 Token，提供"保持登录"选项

### 业务风险
- ⚠️ **用户迁移**：现有用户需要首次绑定邮箱
  - **缓解**：提供清晰的迁移指引，管理员协助绑定

- ⚠️ **邮箱限制**：限制 @bosch.com 可能阻止外部协作者
  - **缓解**：管理员可手动添加白名单邮箱

---

## Open Questions

1. **是否限制只有 @bosch.com 邮箱才能注册？**
   - 建议：是，符合企业内部系统的安全要求

2. **是否需要支持密码登录（作为备选）？**
   - 建议：暂不支持，邮箱 OTP 更安全且用户体验更好

3. **现有用户如何迁移？**
   - 方案 A：首次登录时要求输入邮箱并验证
   - 方案 B：管理员批量导入邮箱映射表

4. **是否需要"记住我"功能？**
   - 建议：是，使用 Supabase 的 `persistSession: true`

5. **邮件发送配置？**
   - 开发环境：使用 Supabase 默认邮件服务
   - 生产环境：配置 Bosch SMTP 服务器（需要 IT 部门协助）

---

## Next Steps

1. **用户确认需求**：
   - 是否只允许 @bosch.com 邮箱注册？
   - 现有用户迁移方案选择（方案 A 或 B）？
   - 是否需要配置 Bosch SMTP？

2. **创建 tasks.md**：详细的实现任务清单

3. **创建 design.md**：技术设计文档（API、组件、状态管理）

4. **创建 spec deltas**：
   - `authentication/spec.md` - 认证流程规范
   - `account-management/spec.md` - 账号管理规范

