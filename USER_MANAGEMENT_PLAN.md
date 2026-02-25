# 用户管理系统完整规划

## 📋 目标功能清单

### 核心功能
- ✅ 邮箱 + 密码注册（已实现）
- ✅ 邮箱 + 密码登录（已实现）
- ✅ 30天免登录（JWT Token 已配置）
- ⏳ 用户个人资料管理
- ⏳ 头像上传和管理
- ⏳ 修改密码
- ⏳ 忘记密码（邮箱重置）
- ⏳ 用户设置中心

---

## 🏗️ 系统架构设计

### 1. 认证流程（Authentication）

```
┌─────────────────────────────────────────────────────────────┐
│                     用户认证流程                              │
└─────────────────────────────────────────────────────────────┘

【注册流程】
用户填写表单 → 前端验证 → 后端验证邮箱格式
                                  ↓
                        检查邮箱是否已注册
                                  ↓
                        密码加密（bcrypt）
                                  ↓
                        保存到 users 表
                                  ↓
                        生成 JWT Token（30天）
                                  ↓
                        返回 Token + 用户信息
                                  ↓
                        前端保存到 localStorage
                                  ↓
                        自动跳转主界面 ✅


【登录流程】
用户输入邮箱+密码 → 前端验证 → 后端查询 users 表
                                    ↓
                            验证密码（bcrypt.verify）
                                    ↓
                            密码正确？
                         ├─ 是 → 生成 JWT Token
                         │       ↓
                         │    返回 Token + 用户信息
                         │       ↓
                         │    前端保存 localStorage
                         │       ↓
                         │    跳转主界面 ✅
                         │
                         └─ 否 → 返回 401 错误 ❌


【30天免登录机制】
用户访问页面 → 前端读取 localStorage 中的 Token
                      ↓
              检查 Token 是否存在
                      ↓
          存在 → 发送 API 请求时自动添加 Authorization Header
                      ↓
          后端验证 Token（检查签名 + 过期时间）
                      ↓
          Token 有效？
       ├─ 是 → 正常访问 ✅
       └─ 否 → 返回 401 → 前端清除 Token → 跳转登录 ❌
```

### 2. 数据库设计

#### 🗄️ **users 表结构**（已存在，需增强）

```sql
-- 当前表结构（SQLSERVER_SCHEMA.sql Line 32-48）
CREATE TABLE dbo.users (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email NVARCHAR(255) NOT NULL UNIQUE,
  name NVARCHAR(255) NOT NULL,
  email_confirmed BIT DEFAULT 0,
  email_confirmed_at DATETIME2,
  is_active BIT DEFAULT 1,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE()
);

-- 需要新增字段（用户管理功能）
ALTER TABLE dbo.users ADD password_hash NVARCHAR(255);  -- 密码哈希
ALTER TABLE dbo.users ADD avatar_url NVARCHAR(500);     -- 头像URL
ALTER TABLE dbo.users ADD phone NVARCHAR(50);           -- 电话号码
ALTER TABLE dbo.users ADD department NVARCHAR(100);     -- 部门
ALTER TABLE dbo.users ADD position NVARCHAR(100);       -- 职位
ALTER TABLE dbo.users ADD bio NVARCHAR(MAX);            -- 个人简介
ALTER TABLE dbo.users ADD last_login_at DATETIME2;      -- 最后登录时间
ALTER TABLE dbo.users ADD password_changed_at DATETIME2; -- 密码最后修改时间
```

#### 📊 **用户会话表**（可选，用于多设备管理）

```sql
CREATE TABLE dbo.user_sessions (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  token_hash NVARCHAR(255) NOT NULL,  -- Token 哈希值（安全存储）
  device_info NVARCHAR(500),           -- 设备信息
  ip_address NVARCHAR(50),             -- IP 地址
  last_active_at DATETIME2,            -- 最后活跃时间
  expires_at DATETIME2 NOT NULL,       -- 过期时间
  created_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON dbo.user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON dbo.user_sessions(expires_at);
```

#### 🔒 **密码重置表**

```sql
CREATE TABLE dbo.password_reset_tokens (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  token NVARCHAR(255) NOT NULL UNIQUE,  -- 重置令牌
  expires_at DATETIME2 NOT NULL,        -- 过期时间（30分钟）
  used BIT DEFAULT 0,                   -- 是否已使用
  used_at DATETIME2,
  created_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_reset_token ON dbo.password_reset_tokens(token, expires_at);
```

---

## 🎨 前端界面设计

### 页面结构

```
/src/pages/
├── auth/
│   ├── LoginPage.tsx           # 登录页（已有 LoginScreen.tsx）
│   ├── RegisterPage.tsx        # 注册页（新增）
│   └── ForgotPasswordPage.tsx  # 忘记密码（新增）
│
└── user/
    ├── ProfilePage.tsx         # 用户资料页（新增）
    ├── SettingsPage.tsx        # 用户设置页（新增）
    └── AvatarUpload.tsx        # 头像上传组件（新增）
```

### 组件设计

#### 1. **注册页面** (RegisterPage.tsx)

```tsx
界面布局：
┌──────────────────────────────────────┐
│  🎨 BPS 管理系统                      │
│  ═══════════════════════════════     │
│                                       │
│  📧 邮箱                               │
│  ┌───────────────────────────────┐   │
│  │ your.name@bosch.com          │   │
│  └───────────────────────────────┘   │
│                                       │
│  👤 姓名                               │
│  ┌───────────────────────────────┐   │
│  │ 张三                          │   │
│  └───────────────────────────────┘   │
│                                       │
│  🔒 密码                               │
│  ┌───────────────────────────────┐   │
│  │ ●●●●●●●●                      │   │
│  └───────────────────────────────┘   │
│  💡 至少8位，包含字母和数字             │
│                                       │
│  🔒 确认密码                           │
│  ┌───────────────────────────────┐   │
│  │ ●●●●●●●●                      │   │
│  └───────────────────────────────┘   │
│                                       │
│  ┌───────────────────────────────┐   │
│  │      ✅ 注册                   │   │
│  └───────────────────────────────┘   │
│                                       │
│  已有账号？ [立即登录]                 │
└──────────────────────────────────────┘
```

#### 2. **用户资料页** (ProfilePage.tsx)

```tsx
界面布局：
┌──────────────────────────────────────────────┐
│  👤 个人资料                                  │
│  ══════════════════════════════════════      │
│                                               │
│  ┌─────────────┐                             │
│  │             │  📸 点击更换头像              │
│  │   头像      │  💡 支持 JPG、PNG，不超过2MB  │
│  │             │                              │
│  └─────────────┘                             │
│                                               │
│  基本信息                                     │
│  ┌───────────────────────────────────────┐   │
│  │ 📧 邮箱: zhang.san@bosch.com         │   │
│  │ 👤 姓名: 张三                         │   │
│  │ 📞 电话: +86 138 1234 5678           │   │
│  │ 🏢 部门: BPS                         │   │
│  │ 💼 职位: 工程师                       │   │
│  └───────────────────────────────────────┘   │
│                                               │
│  个人简介                                     │
│  ┌───────────────────────────────────────┐   │
│  │ 5年制造工程经验，专注BPS流程优化...    │   │
│  └───────────────────────────────────────┘   │
│                                               │
│  账号安全                                     │
│  ┌───────────────────────────────────────┐   │
│  │ 🔒 密码: ●●●●●●●●  [修改密码]        │   │
│  │ 🕒 最后登录: 2026-02-13 14:30         │   │
│  │ 🕒 注册时间: 2025-12-01 10:20         │   │
│  └───────────────────────────────────────┘   │
│                                               │
│  ┌──────────────┐  ┌──────────────┐          │
│  │ 💾 保存更改   │  │ ❌ 取消      │          │
│  └──────────────┘  └──────────────┘          │
└──────────────────────────────────────────────┘
```

#### 3. **修改密码弹窗** (ChangePasswordModal.tsx)

```tsx
┌────────────────────────────────────┐
│  🔒 修改密码                        │
│  ══════════════════════════════    │
│                                     │
│  旧密码                              │
│  ┌─────────────────────────────┐   │
│  │ ●●●●●●●●                    │   │
│  └─────────────────────────────┘   │
│                                     │
│  新密码                              │
│  ┌─────────────────────────────┐   │
│  │ ●●●●●●●●                    │   │
│  └─────────────────────────────┘   │
│  💡 至少8位，包含字母和数字          │
│                                     │
│  确认新密码                          │
│  ┌─────────────────────────────┐   │
│  │ ●●●●●●●●                    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ 💾 确认   │  │ ❌ 取消  │        │
│  └──────────┘  └──────────┘        │
└────────────────────────────────────┘
```

---

## 🔧 后端 API 设计

### 认证相关 API（已实现）

| 端点 | 方法 | 功能 | 状态 |
|------|------|------|------|
| `/api/auth/register` | POST | 注册新用户 | ✅ 已实现 |
| `/api/auth/login` | POST | 密码登录 | ✅ 已实现 |
| `/api/auth/logout` | POST | 登出 | ✅ 已实现 |
| `/api/auth/me` | GET | 获取当前用户信息 | ✅ 已实现 |

### 用户管理 API（需新增）

| 端点 | 方法 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| `/api/users/profile` | GET | 获取用户资料 | - | UserProfile |
| `/api/users/profile` | PUT | 更新用户资料 | UpdateProfileRequest | UserProfile |
| `/api/users/avatar` | POST | 上传头像 | FormData (file) | { avatar_url } |
| `/api/users/change-password` | POST | 修改密码 | ChangePasswordRequest | Message |
| `/api/users/request-password-reset` | POST | 请求重置密码 | { email } | Message |
| `/api/users/reset-password` | POST | 重置密码 | ResetPasswordRequest | Message |

---

## 📦 数据模型定义

### 后端模型 (backend/models.py)

```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

# ============== 注册和登录 ==============
class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(..., min_length=8)

class PasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str

# ============== 用户资料 ==============
class UserProfile(BaseModel):
    id: UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    bio: Optional[str] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    bio: Optional[str] = None

# ============== 密码管理 ==============
class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)

class RequestPasswordResetRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
```

### 前端类型 (src/types/api.ts)

```typescript
// ============== 用户认证 ==============
export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

// ============== 用户资料 ==============
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
  department?: string;
  position?: string;
  bio?: string;
  last_login_at?: string;
  created_at: string;
}

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  department?: string;
  position?: string;
  bio?: string;
}

// ============== 密码管理 ==============
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}
```

---

## 🎯 实现步骤（分阶段）

### 阶段 1：数据库增强（30分钟）

**任务清单**：
- [ ] 修改 `SQLSERVER_SCHEMA.sql`，为 users 表添加新字段
- [ ] 创建 `password_reset_tokens` 表（可选）
- [ ] 创建 `user_sessions` 表（可选）
- [ ] 执行 SQL 脚本更新数据库

**SQL 脚本**：
```sql
-- 文件：SQLSERVER_USER_ENHANCEMENT.sql
USE DCCT_BPS_Debug;
GO

-- 1. 添加用户管理字段
ALTER TABLE dbo.users ADD password_hash NVARCHAR(255);
ALTER TABLE dbo.users ADD avatar_url NVARCHAR(500);
ALTER TABLE dbo.users ADD phone NVARCHAR(50);
ALTER TABLE dbo.users ADD department NVARCHAR(100);
ALTER TABLE dbo.users ADD position NVARCHAR(100);
ALTER TABLE dbo.users ADD bio NVARCHAR(MAX);
ALTER TABLE dbo.users ADD last_login_at DATETIME2;
ALTER TABLE dbo.users ADD password_changed_at DATETIME2;
GO

PRINT '✅ users 表字段已添加';

-- 2. 创建密码重置表
CREATE TABLE dbo.password_reset_tokens (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  token NVARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME2 NOT NULL,
  used BIT DEFAULT 0,
  used_at DATETIME2,
  created_at DATETIME2 DEFAULT GETDATE(),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_reset_token ON dbo.password_reset_tokens(token, expires_at);
GO

PRINT '✅ password_reset_tokens 表已创建';
```

### 阶段 2：后端 API 实现（2小时）

**文件清单**：
- `backend/routers/users.py` - 新建用户管理路由
- `backend/models.py` - 添加用户模型
- `backend/main.py` - 注册路由
- `backend/utils/file_upload.py` - 文件上传工具（头像）

**示例代码**：
```python
# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from backend.auth import get_current_user, hash_password, verify_password
import uuid
import os

router = APIRouter()

@router.get("/profile", response_model=UserProfile)
def get_profile(current_user: dict = Depends(get_current_user), cursor=Depends(get_db)):
    """获取当前用户资料"""
    user_id = current_user.get("user_id")
    
    cursor.execute("""
        SELECT id, email, name, avatar_url, phone, department, position, bio,
               last_login_at, created_at
        FROM dbo.users
        WHERE id = ?
    """, user_id)
    
    user = cursor.fetchone()
    if not user:
        raise HTTPException(404, "用户不存在")
    
    return UserProfile(
        id=user[0],
        email=user[1],
        name=user[2],
        # ... 其他字段
    )

@router.put("/profile", response_model=UserProfile)
def update_profile(
    request: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """更新用户资料"""
    user_id = current_user.get("user_id")
    
    update_fields = []
    params = []
    
    if request.name:
        update_fields.append("name = ?")
        params.append(request.name)
    
    # ... 其他字段
    
    if update_fields:
        sql = f"UPDATE dbo.users SET {', '.join(update_fields)}, updated_at = GETDATE() WHERE id = ?"
        params.append(user_id)
        cursor.execute(sql, params)
        cursor.commit()
    
    return get_profile(current_user, cursor)

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """上传用户头像"""
    # 验证文件类型
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(400, "仅支持 JPG、PNG 格式")
    
    # 验证文件大小（2MB）
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(400, "文件大小不能超过 2MB")
    
    # 保存文件
    user_id = current_user.get("user_id")
    filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{file.filename.split('.')[-1]}"
    filepath = os.path.join("uploads", "avatars", filename)
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # 更新数据库
    avatar_url = f"/uploads/avatars/{filename}"
    cursor.execute("""
        UPDATE dbo.users
        SET avatar_url = ?, updated_at = GETDATE()
        WHERE id = ?
    """, avatar_url, user_id)
    cursor.commit()
    
    return {"avatar_url": avatar_url}

@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """修改密码"""
    user_id = current_user.get("user_id")
    
    # 查询当前密码哈希
    cursor.execute("SELECT password_hash FROM dbo.users WHERE id = ?", user_id)
    user = cursor.fetchone()
    
    if not user or not user[0]:
        raise HTTPException(400, "账号未设置密码")
    
    # 验证旧密码
    if not verify_password(request.old_password, user[0]):
        raise HTTPException(401, "旧密码错误")
    
    # 更新密码
    new_hash = hash_password(request.new_password)
    cursor.execute("""
        UPDATE dbo.users
        SET password_hash = ?, password_changed_at = GETDATE(), updated_at = GETDATE()
        WHERE id = ?
    """, new_hash, user_id)
    cursor.commit()
    
    return {"message": "密码修改成功"}
```

### 阶段 3：前端页面实现（3小时）

**文件清单**：
- `src/pages/auth/RegisterPage.tsx` - 注册页
- `src/pages/user/ProfilePage.tsx` - 用户资料页
- `src/components/user/AvatarUpload.tsx` - 头像上传组件
- `src/components/user/ChangePasswordModal.tsx` - 修改密码弹窗
- `src/services/users.service.ts` - 用户服务

### 阶段 4：集成和测试（1小时）

**测试清单**：
- [ ] 注册新用户
- [ ] 登录验证
- [ ] Token 30天有效期验证
- [ ] 修改用户资料
- [ ] 上传头像
- [ ] 修改密码
- [ ] 忘记密码流程

---

## 🔒 安全最佳实践

### 1. 密码安全
- ✅ 使用 bcrypt 加密存储（backend/auth.py 已实现）
- ✅ 密码长度至少 8 位
- ✅ 强制包含字母和数字
- ⚠️ 建议：90天强制修改密码（可选）

### 2. Token 安全
- ✅ JWT Token 存储在 localStorage
- ✅ Token 包含过期时间（30天）
- ✅ HTTPS 传输（生产环境）
- ⚠️ 建议：实现 Refresh Token 机制

### 3. 文件上传安全
- ✅ 验证文件类型（MIME type）
- ✅ 限制文件大小（2MB）
- ✅ 文件名随机化（防止路径遍历）
- ⚠️ 建议：使用云存储（OSS、S3）

### 4. API 安全
- ✅ 所有用户 API 需要 JWT 认证
- ✅ SQL 参数化查询（防注入）
- ✅ CORS 配置（仅允许特定域名）
- ⚠️ 建议：限流（rate limiting）

---

## 📱 用户体验优化

### 1. 自动登录
```typescript
// src/App.tsx
useEffect(() => {
  const token = localStorage.getItem('access_token');
  if (token) {
    // 验证 token 是否有效
    authService.verifyToken().catch(() => {
      // Token 无效，清除并跳转登录
      localStorage.clear();
      navigate('/login');
    });
  }
}, []);
```

### 2. Loading 状态
- 登录/注册时显示加载动画
- 头像上传显示进度条
- 数据保存时禁用按钮

### 3. 错误提示
- 友好的错误消息（中文）
- Toast 通知（成功/失败）
- 表单字段验证提示

### 4. 移动端适配
- 响应式布局（Tailwind CSS）
- 触摸友好的按钮大小
- 移动端头像裁剪

---

## 📊 数据统计（可选扩展）

### 用户活跃度
- 最后登录时间
- 登录次数统计
- 在线时长统计

### 安全审计
- 登录日志（IP、设备）
- 密码修改记录
- 异常登录警告

---

## 🚀 快速开始实现

### 立即可用的功能（已实现 ✅）

**你现在可以直接使用邮箱+密码注册和登录！**

#### 1. 创建注册页面

创建文件 `src/pages/auth/RegisterPage.tsx`：

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:8000/api/auth/register/', {
        email: formData.email,
        name: formData.name,
        password: formData.password
      });

      // 保存 token
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user_id', response.data.user_id);
      localStorage.setItem('user_email', response.data.email);

      // 跳转主页
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">注册 BPS 账号</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="your.name@bosch.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">姓名</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="张三"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="至少8位"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">确认密码</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="再次输入密码"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          已有账号？
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 hover:underline ml-1"
          >
            立即登录
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 2. 创建简化的登录页面

创建文件 `src/pages/auth/PasswordLoginPage.tsx`：

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export function PasswordLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:8000/api/auth/login/', {
        email,
        password
      });

      // 保存 token
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user_id', response.data.user_id);
      localStorage.setItem('user_email', response.data.email);

      // 跳转主页
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">登录 BPS 系统</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="your.name@bosch.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="输入密码"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          还没有账号？
          <button
            onClick={() => navigate('/register')}
            className="text-blue-600 hover:underline ml-1"
          >
            立即注册
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 3. 更新路由配置

在 `src/App.tsx` 中添加路由：

```typescript
import { RegisterPage } from './pages/auth/RegisterPage';
import { PasswordLoginPage } from './pages/auth/PasswordLoginPage';

// 在路由配置中添加
<Route path="/register" element={<RegisterPage />} />
<Route path="/password-login" element={<PasswordLoginPage />} />
```

---

## 🎉 总结

### 已实现功能 ✅
1. ✅ 邮箱 + 密码注册（backend/routers/auth.py Line 166-233）
2. ✅ 邮箱 + 密码登录（backend/routers/auth.py Line 236-298）
3. ✅ JWT Token 30天有效期（backend/config.py Line 23）
4. ✅ Token 自动认证（src/lib/api-client.ts）

### 待实现功能 ⏳
1. ⏳ 用户资料管理页面
2. ⏳ 头像上传功能
3. ⏳ 修改密码功能
4. ⏳ 忘记密码（邮箱重置）

### 下一步行动

**你现在可以选择：**

1. **快速体验**：我帮你创建注册和登录页面（15分钟）
2. **完整实现**：按照上面的计划逐步实现所有功能（6-8小时）
3. **分阶段实现**：先实现注册/登录，后续再添加用户管理

**告诉我你想要什么？我可以立即帮你实现！** 🚀
