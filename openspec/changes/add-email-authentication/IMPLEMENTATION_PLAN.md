# 用户认证和管理系统 - 实现计划

## 📋 已完成

- ✅ Supabase Email OTP 配置
- ✅ 数据库迁移（添加认证字段）
- ✅ 邮件发送测试
- ✅ 创建 `authService.ts`（认证服务层）

---

## 🚀 正在实现

### 阶段 1：核心认证功能

#### 1.1 重构 Supabase 客户端
- 文件：`src/lib/supabase.ts`
- 修改：启用 `persistSession: true`（支持"记住我"）

#### 1.2 重构 AuthContext
- 文件：`src/contexts/AuthContext.tsx`
- 功能：
  - 集成 Supabase Auth Session
  - 监听认证状态变化
  - 提供登录/登出/注册方法
  - 管理用户资料状态

#### 1.3 创建 UI 组件
- `src/components/EmailInput.tsx` - 邮箱输入（带域名验证）
- `src/components/OTPInput.tsx` - 6 位验证码输入
- `src/components/LoadingScreen.tsx` - 加载状态

#### 1.4 认证页面
- `src/components/LoginScreen.tsx` - 登录页面（重构）
- `src/components/SignupScreen.tsx` - 注册页面
- `src/components/BindEmailScreen.tsx` - 邮箱绑定页面

---

### 阶段 2：用户资料管理

#### 2.1 头像上传功能
- 配置 Supabase Storage
- 创建 `avatars` bucket
- 实现头像上传/删除 API
- 文件：`src/lib/storageService.ts`

#### 2.2 用户资料组件
- `src/components/UserProfile.tsx` - 用户资料卡片
- `src/components/EditProfileModal.tsx` - 编辑资料弹窗
- `src/components/AvatarUpload.tsx` - 头像上传组件

#### 2.3 用户设置页面
- `src/pages/UserSettings.tsx` - 设置主页面
- 包含：
  - 个人信息（姓名、邮箱、电话）
  - 头像上传
  - 密码管理（未来）
  - 通知偏好
  - 语言/主题设置

---

### 阶段 3：全局集成

#### 3.1 更新 Header 组件
- 显示用户头像
- 用户菜单下拉
- 快速访问设置

#### 3.2 更新 App.tsx
- 路由保护
- 认证状态检查
- 首次登录引导

#### 3.3 权限系统
- 基于角色的访问控制（RBAC）
- 前端权限检查
- 后端 RLS 策略

---

## 📁 文件结构

```
src/
├── lib/
│   ├── supabase.ts           # ✅ 已更新
│   ├── authService.ts        # ✅ 已创建
│   ├── storageService.ts     # ⏳ 待创建（头像上传）
│   └── database.types.ts     # ⏳ 需更新类型
├── contexts/
│   └── AuthContext.tsx       # ⏳ 待重构
├── components/
│   ├── EmailInput.tsx        # ⏳ 待创建
│   ├── OTPInput.tsx          # ⏳ 待创建
│   ├── LoginScreen.tsx       # ⏳ 待重构
│   ├── SignupScreen.tsx      # ⏳ 待创建
│   ├── BindEmailScreen.tsx   # ⏳ 待创建
│   ├── UserProfile.tsx       # ⏳ 待创建
│   ├── EditProfileModal.tsx  # ⏳ 待创建
│   ├── AvatarUpload.tsx      # ⏳ 待创建
│   └── Header.tsx            # ⏳ 待更新
├── pages/
│   ├── UserSettings.tsx      # ⏳ 待创建
│   └── AccountManagement.tsx # ⏳ 待创建
└── App.tsx                   # ⏳ 待更新
```

---

## 🎯 用户管理功能清单

### 基础功能
- [x] 邮箱注册/登录
- [x] OTP 验证
- [ ] 邮箱绑定（现有用户迁移）
- [ ] 自动登录（记住我）
- [ ] 登出

### 资料管理
- [ ] 查看个人资料
- [ ] 修改姓名
- [ ] 修改联系方式
- [ ] 上传头像
- [ ] 删除头像
- [ ] 查看登录历史

### 设置功能
- [ ] 通知偏好
  - 邮件通知开关
  - 系统通知开关
- [ ] 隐私设置
  - 资料可见性
- [ ] 账号安全
  - 查看活跃会话
  - 强制登出所有设备
  - 注销账号

### 管理员功能
- [ ] 用户列表
- [ ] 修改用户角色
- [ ] 激活/停用账号
- [ ] 批量导入用户
- [ ] 查看用户活动日志

---

## 🗄️ 数据库扩展

### 需要添加的表

#### 1. user_preferences（用户偏好）
```sql
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- 通知设置
  email_notifications BOOLEAN DEFAULT true,
  system_notifications BOOLEAN DEFAULT true,
  
  -- 隐私设置
  profile_visibility TEXT DEFAULT 'team' CHECK (profile_visibility IN ('public', 'team', 'private')),
  
  -- 界面设置
  language TEXT DEFAULT 'zh-CN',
  theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2. user_sessions（用户会话，可选）
```sql
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🔐 Supabase Storage 配置

### 创建 avatars bucket

```sql
-- 在 Supabase Dashboard > Storage 中创建
-- 或使用 SQL
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- 设置存储策略
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');
```

---

## 📝 下一步操作

1. **验证数据库迁移**
   - 执行 `verify-migration.sql`
   - 确认所有字段和触发器正确

2. **更新 Supabase 客户端配置**
   - 启用 `persistSession`

3. **重构 AuthContext**
   - 集成 Supabase Auth

4. **创建 UI 组件**
   - EmailInput
   - OTPInput
   - 认证页面

5. **实现用户管理功能**
   - 头像上传
   - 资料编辑
   - 设置页面

---

## 🎨 UI/UX 设计原则

- **简洁明了**：减少用户操作步骤
- **即时反馈**：操作后立即显示结果
- **错误友好**：清晰的错误提示和解决方案
- **响应式**：适配不同屏幕尺寸
- **无障碍**：支持键盘操作和屏幕阅读器

---

## 📊 预计时间

- 核心认证功能：4-6 小时
- 用户资料管理：3-4 小时
- 全局集成：2-3 小时
- 测试和优化：2-3 小时

**总计**：11-16 小时

