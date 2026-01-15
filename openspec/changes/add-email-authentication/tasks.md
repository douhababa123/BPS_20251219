# Tasks: 添加邮箱认证系统

**Change ID**: `add-email-authentication`  
**Status**: In Progress  
**Last Updated**: 2026-01-14

---

## 📋 任务清单

### 阶段 1：Supabase 配置（30 分钟）

- [ ] **1.1 启用邮箱 OTP 认证**
  - 登录 Supabase Dashboard
  - `Authentication` > `Providers` > 启用 `Email`
  - 勾选 `Enable email confirmations`
  - 配置 OTP 有效期：600 秒（10 分钟）
  - **验证**：在 Dashboard 看到 Email Provider 为 Enabled

- [ ] **1.2 自定义邮件模板（中文）**
  - `Authentication` > `Email Templates`
  - 编辑 `Confirm signup` 模板（注册验证）
  - 编辑 `Magic Link` 模板（登录验证）
  - **验证**：预览邮件模板显示中文内容

- [ ] **1.3 配置会话设置**
  - `Settings` > `Auth` > `JWT Settings`
  - JWT expiry: 3600 秒（1 小时）
  - Refresh token expiry: 2592000 秒（30 天，支持"记住我"）
  - **验证**：设置已保存

---

### 阶段 2：数据库迁移（1 小时）

- [ ] **2.1 创建迁移脚本**
  - 创建 `migrations/002_add_email_authentication.sql`
  - 添加 `auth_user_id`, `email`, `phone` 字段到 `employees` 表
  - 创建索引优化查询性能
  - **验证**：SQL 语法正确，无错误

- [ ] **2.2 创建自动同步触发器**
  - 创建 `handle_new_user()` 函数
  - 创建 `on_auth_user_created` 触发器
  - 当 `auth.users` 创建新用户时，自动在 `employees` 表创建记录
  - **验证**：触发器创建成功

- [ ] **2.3 执行迁移脚本**
  - 在 Supabase SQL Editor 执行迁移脚本
  - 检查表结构变更
  - 验证触发器是否正常工作
  - **验证**：`employees` 表有新字段，触发器存在

- [ ] **2.4 配置 RLS 策略**
  - 启用 `employees` 表的 Row Level Security
  - 创建策略：用户只能查看/修改自己的数据
  - 创建策略：管理员可以查看/修改所有数据
  - **验证**：RLS 策略生效

---

### 阶段 3：前端基础设施（2 小时）

- [ ] **3.1 更新 Supabase 客户端配置**
  - 修改 `src/lib/supabase.ts`
  - 启用 `persistSession: true`（支持"记住我"）
  - 启用 `autoRefreshToken: true`
  - **验证**：配置更新成功，无类型错误

- [ ] **3.2 创建认证服务层**
  - 创建 `src/lib/authService.ts`
  - 实现 `signupWithEmail(email, name)` - 注册
  - 实现 `loginWithEmail(email)` - 发送登录验证码
  - 实现 `verifyOTP(email, token)` - 验证 OTP
  - 实现 `logout()` - 登出
  - 实现 `getCurrentSession()` - 获取当前会话
  - 实现 `refreshSession()` - 刷新会话
  - **验证**：所有函数有完整的类型定义和错误处理

- [ ] **3.3 重构 AuthContext**
  - 更新 `src/contexts/AuthContext.tsx`
  - 集成 Supabase Auth Session
  - 添加 `session` 状态
  - 添加 `signupWithEmail`, `loginWithEmail`, `verifyOTP` 方法
  - 监听 `onAuthStateChange` 事件
  - 同步 `auth.users` 和 `employees` 表数据
  - **验证**：AuthContext 提供完整的认证 API

- [ ] **3.4 更新类型定义**
  - 更新 `src/lib/database.types.ts`
  - 添加 `auth_user_id`, `email`, `phone` 字段到 `Employee` 类型
  - 创建 `AuthUser` 类型
  - 创建 `AuthSession` 类型
  - **验证**：TypeScript 编译无错误

---

### 阶段 4：UI 组件实现（3 小时）

- [ ] **4.1 创建邮箱验证组件**
  - 创建 `src/components/EmailInput.tsx`
  - 验证邮箱格式
  - 限制域名：`@bosch.com` 或 `@bshg.com`
  - 显示实时验证错误
  - **验证**：组件可复用，验证逻辑正确

- [ ] **4.2 创建 OTP 输入组件**
  - 创建 `src/components/OTPInput.tsx`
  - 6 位数字输入框
  - 自动聚焦下一个输入框
  - 支持粘贴完整验证码
  - 倒计时显示（10 分钟）
  - **验证**：用户体验流畅，支持键盘操作

- [ ] **4.3 重构登录页面**
  - 更新 `src/components/LoginScreen.tsx`
  - 步骤 1：输入邮箱（带域名验证）
  - 步骤 2：输入 OTP 验证码
  - 添加"记住我"复选框
  - 添加"重新发送验证码"按钮（60 秒冷却）
  - 显示加载状态和错误提示
  - **验证**：登录流程完整，错误处理友好

- [ ] **4.4 创建注册页面**
  - 创建 `src/components/SignupScreen.tsx`
  - 输入姓名（必填）
  - 输入邮箱（带域名验证）
  - 发送验证码
  - 输入 OTP 完成注册
  - 显示注册协议（可选）
  - **验证**：注册流程完整，自动跳转到主应用

- [ ] **4.5 创建首次绑定邮箱页面**
  - 创建 `src/components/BindEmailScreen.tsx`
  - 显示当前员工信息（从旧系统读取）
  - 输入邮箱并验证
  - 绑定成功后更新 `employees` 表
  - **验证**：现有用户可以平滑迁移

- [ ] **4.6 创建账号管理页面**
  - 创建 `src/pages/AccountManagement.tsx`
  - 显示个人信息（姓名、邮箱、部门、角色）
  - 修改姓名
  - 修改联系方式
  - 查看登录历史（最近 10 次）
  - 注销账号按钮（需二次确认）
  - **验证**：所有功能正常，权限检查正确

---

### 阶段 5：路由和导航（1 小时）

- [ ] **5.1 更新 App.tsx 路由逻辑**
  - 检查用户登录状态
  - 未登录 → 显示 `LoginScreen`
  - 已登录但未绑定邮箱 → 显示 `BindEmailScreen`
  - 已登录且已绑定 → 显示主应用
  - **验证**：路由逻辑正确，无死循环

- [ ] **5.2 添加账号管理入口**
  - 更新 `src/components/Header.tsx`
  - 添加用户头像/名称下拉菜单
  - 菜单项：个人信息、账号设置、登出
  - 点击"账号设置"跳转到 `AccountManagement` 页面
  - **验证**：导航流畅，UI 美观

- [ ] **5.3 添加"记住我"功能**
  - 登录时勾选"记住我" → 设置 30 天会话
  - 未勾选 → 关闭浏览器后自动登出
  - 使用 `localStorage` 存储用户偏好
  - **验证**：功能符合预期

---

### 阶段 6：用户迁移（1 小时）

- [ ] **6.1 创建迁移检测逻辑**
  - 在 `AuthContext` 初始化时检查
  - 如果 `localStorage` 有旧的 `currentUserId`
  - 但 `auth.users` 没有对应记录
  - → 触发邮箱绑定流程
  - **验证**：现有用户首次登录时看到绑定页面

- [ ] **6.2 实现邮箱绑定 API**
  - 创建 `bindEmailToEmployee(employeeId, email, authUserId)`
  - 更新 `employees` 表的 `auth_user_id` 和 `email` 字段
  - 验证邮箱唯一性
  - **验证**：绑定成功后用户可以正常登录

- [ ] **6.3 创建迁移指引文档**
  - 创建 `USER_MIGRATION_GUIDE.md`
  - 说明迁移流程
  - 常见问题解答
  - 管理员协助步骤
  - **验证**：文档清晰易懂

---

### 阶段 7：管理员功能（2 小时）

- [ ] **7.1 创建用户管理页面**
  - 创建 `src/pages/UserManagement.tsx`（仅管理员可访问）
  - 显示所有用户列表
  - 筛选：按部门、角色、状态
  - 搜索：按姓名、邮箱
  - **验证**：列表显示正确，性能良好

- [ ] **7.2 实现用户编辑功能**
  - 点击用户 → 打开编辑弹窗
  - 修改角色（BPS_ENGINEER / SITE_PS / ADMIN）
  - 激活/停用账号
  - 重置用户会话（强制重新登录）
  - **验证**：修改立即生效，有操作日志

- [ ] **7.3 实现批量导入功能**
  - 支持从 Excel 导入员工信息
  - 自动发送邀请邮件（包含注册链接）
  - 显示导入进度和结果
  - **验证**：批量导入成功，邮件发送正常

---

### 阶段 8：测试和优化（2 小时）

- [ ] **8.1 功能测试**
  - 测试注册流程（新用户）
  - 测试登录流程（已注册用户）
  - 测试邮箱绑定流程（现有用户）
  - 测试"记住我"功能
  - 测试账号管理功能
  - 测试管理员功能
  - **验证**：所有功能正常，无 bug

- [ ] **8.2 邮件测试**
  - 使用真实邮箱测试（@bosch.com 或 @bshg.com）
  - 检查邮件送达率
  - 检查邮件格式（中文显示正确）
  - 检查验证码有效性
  - **验证**：邮件正常接收，验证码可用

- [ ] **8.3 安全测试**
  - 测试域名限制（非 Bosch 邮箱无法注册）
  - 测试 RLS 策略（用户只能访问自己的数据）
  - 测试会话过期处理
  - 测试并发登录（多设备）
  - **验证**：安全策略生效，无漏洞

- [ ] **8.4 性能优化**
  - 优化数据库查询（添加必要索引）
  - 优化前端加载速度（代码分割）
  - 添加加载骨架屏
  - 添加错误边界（Error Boundary）
  - **验证**：页面加载快速，用户体验流畅

- [ ] **8.5 错误处理**
  - 网络错误 → 显示友好提示，支持重试
  - 验证码错误 → 提示重新输入，限制尝试次数
  - 邮箱已存在 → 提示使用登录功能
  - 会话过期 → 自动跳转到登录页
  - **验证**：所有错误场景有友好提示

---

### 阶段 9：文档和部署（1 小时）

- [ ] **9.1 更新用户文档**
  - 更新 `README.md`
  - 添加认证系统说明
  - 添加注册/登录指引
  - **验证**：文档完整准确

- [ ] **9.2 创建管理员手册**
  - 创建 `ADMIN_GUIDE.md`
  - 用户管理操作指南
  - 常见问题处理
  - 故障排查步骤
  - **验证**：管理员可以独立操作

- [ ] **9.3 准备生产环境配置**
  - 创建 `PRODUCTION_DEPLOYMENT.md`
  - Bosch SMTP 配置步骤
  - 环境变量配置清单
  - 安全检查清单
  - **验证**：部署文档清晰完整

- [ ] **9.4 代码审查和清理**
  - 移除调试代码和 console.log
  - 统一代码风格
  - 添加必要的注释
  - 运行 linter 和 type check
  - **验证**：代码质量高，无警告

---

## 📊 进度追踪

- **总任务数**: 39
- **已完成**: 0
- **进行中**: 0
- **待开始**: 39
- **预计时间**: 13.5 小时

---

## 🎯 里程碑

1. **M1: Supabase 配置完成**（阶段 1-2）
   - 邮件可以正常发送
   - 数据库结构已更新

2. **M2: 基础认证功能完成**（阶段 3-4）
   - 用户可以注册和登录
   - AuthContext 集成 Supabase Auth

3. **M3: 完整功能实现**（阶段 5-7）
   - 路由保护生效
   - 现有用户可以迁移
   - 管理员功能可用

4. **M4: 测试和上线**（阶段 8-9）
   - 所有功能测试通过
   - 文档完整
   - 准备生产部署

---

## 🔗 相关文档

- `proposal.md` - 完整方案说明
- `SUPABASE_EMAIL_AUTH_GUIDE.md` - Supabase 配置指南
- `QUICK_START.md` - 5 分钟快速开始
- `migrations/002_add_email_authentication.sql` - 数据库迁移脚本（待创建）
- `USER_MIGRATION_GUIDE.md` - 用户迁移指南（待创建）
- `ADMIN_GUIDE.md` - 管理员手册（待创建）

---

## ⚠️ 注意事项

1. **邮箱域名限制**：只允许 `@bosch.com` 和 `@bshg.com`
2. **现有用户迁移**：首次登录时要求绑定邮箱
3. **记住我功能**：使用 30 天 Refresh Token
4. **邮件服务**：
   - 开发环境：Supabase 默认（免费）
   - 生产环境：Bosch SMTP（需 IT 部门配置）
5. **安全性**：启用 RLS，用户只能访问自己的数据

---

## 🚀 开始实现

准备好开始了吗？请确认：

- [ ] 我已阅读 `proposal.md` 和 `QUICK_START.md`
- [ ] 我已了解 Supabase 邮件认证的工作原理
- [ ] 我已准备好开始配置 Supabase Dashboard
- [ ] 我已了解任务清单和预计时间

**下一步**：开始阶段 1 - Supabase 配置 🎯

