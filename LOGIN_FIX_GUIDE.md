# 登录验证码问题修复指南

## 🔍 问题诊断

**现象**：输入 `chao.dong@bshg.com` 后点击"获取验证码"，提示"发送验证码失败，请重试"

**根本原因**：前端代码仍在使用 **Supabase** 认证 API，但实际后端已切换到 **FastAPI + SQL Server**。两个系统不兼容导致调用失败。

## ✅ 已完成的修复

### 1. 创建新的认证服务
- 文件：`src/lib/fastapi-auth.ts`
- 功能：封装 FastAPI 后端的认证 API
- 包含方法：
  - `sendOTP(email)` - 发送验证码
  - `verifyOTP(email, otp)` - 验证 OTP
  - `getCurrentSession()` - 获取当前会话
  - `logout()` - 登出
  - `getCurrentUser()` - 获取用户信息

### 2. 修改 AuthContext
- 文件：`src/contexts/AuthContext.tsx`
- 修改点：
  ```typescript
  // 旧的 Supabase 认证
  // import * as authService from '../lib/authService';
  
  // 新的 FastAPI 认证
  import * as authService from '../lib/fastapi-auth';
  ```
- 更新方法：
  - `loginWithEmail()` - 调用 FastAPI `/api/auth/signup-otp`
  - `verifyOTP()` - 调用 FastAPI `/api/auth/verify-otp`
  - `signupWithEmail()` - 同样使用 FastAPI OTP 端点

### 3. 添加 API 配置
- 文件：`.env`
- 新增配置：
  ```bash
  VITE_API_URL=http://localhost:8000
  ```

## 🚀 下一步操作

### 必须操作：重启前端服务

因为修改了 `.env` 文件和核心认证代码，**必须重启前端**才能生效：

```powershell
# 1. 停止当前前端服务（在运行前端的终端按 Ctrl+C）

# 2. 重新启动前端
npm run dev
```

### 测试登录流程

1. **打开浏览器**：http://localhost:5174
2. **输入邮箱**：chao.dong@bshg.com
3. **点击"发送验证码"**
4. **获取验证码**（3种方式任选）：
   - 方式1：查看后端终端输出
   - 方式2：运行 `python backend/get_otp.py`
   - 方式3：查看 `backend/CURRENT_OTP.txt` 文件
5. **输入验证码**：6位数字
6. **点击"验证并登录"**

## 📋 验证后端 API 正常

```powershell
# 测试发送验证码接口
Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/signup-otp' `
  -Method POST `
  -ContentType 'application/json' `
  -Body '{"email":"chao.dong@bshg.com"}' | ConvertTo-Json
```

预期输出：
```json
{
    "message": "OTP 已发送到您的邮箱",
    "detail": "验证码已发送到 chao.dong@bshg.com，请查收邮件"
}
```

✅ 如果看到这个输出，说明后端 API 工作正常。

## 🔧 技术细节

### FastAPI 认证流程

```
用户输入邮箱
    ↓
前端调用: POST /api/auth/signup-otp
    ↓
后端生成6位OTP，存入内存
    ↓
开发模式：打印到终端 + 写入 CURRENT_OTP.txt
生产模式：发送邮件（需配置SMTP）
    ↓
用户输入验证码
    ↓
前端调用: POST /api/auth/verify-otp
    ↓
后端验证OTP，生成JWT token（有效期7天）
    ↓
前端保存 token 到 localStorage
    ↓
登录成功！
```

### Token 持久化

- **存储位置**：`localStorage`
- **键名**：
  - `auth_token` - JWT访问令牌
  - `user_data` - 用户信息（JSON格式）
- **有效期**：7天（10080分钟）
- **自动恢复**：页面刷新后自动从 localStorage 恢复登录状态

### API 端点列表

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/auth/signup-otp` | POST | 发送验证码 |
| `/api/auth/verify-otp` | POST | 验证OTP并登录 |
| `/api/auth/me` | GET | 获取当前用户信息 |
| `/api/auth/logout` | POST | 登出 |

## 🐛 问题排查

### 如果前端仍然报错

1. **确认前端已重启**（必须！）
   ```powershell
   # 停止前端：Ctrl+C
   # 重新启动
   npm run dev
   ```

2. **检查后端是否运行**
   ```powershell
   curl http://localhost:8000/api/health
   ```

3. **查看浏览器控制台**
   - 按 F12 打开开发者工具
   - 切换到 Console 标签页
   - 查看是否有红色错误信息

4. **检查网络请求**
   - F12 → Network 标签页
   - 点击"发送验证码"
   - 查看 `signup-otp` 请求的状态码和响应

### 常见错误及解决

| 错误 | 原因 | 解决方法 |
|------|------|---------|
| 404 Not Found | 后端未运行 | 启动后端服务 |
| CORS 错误 | 跨域配置问题 | 检查后端 CORS 配置 |
| Network Error | 前端配置错误 | 检查 .env 中的 VITE_API_URL |
| 用户不存在 | 数据库中无此用户 | 运行 `python backend/add_user.py` |

## 📝 相关文件

- `src/lib/fastapi-auth.ts` - 新的认证服务
- `src/contexts/AuthContext.tsx` - 认证上下文（已更新）
- `src/components/LoginScreen.tsx` - 登录界面
- `.env` - 环境变量配置
- `backend/routers/auth.py` - 后端认证路由
- `backend/auth.py` - 后端认证逻辑

## 🎯 总结

修复完成后，**记得重启前端服务**！这样就能正常使用新的 FastAPI 认证系统了。

如有问题，请检查：
1. ✅ 前端已重启
2. ✅ 后端正在运行（http://localhost:8000）
3. ✅ 用户已添加到数据库（chao.dong@bshg.com）
4. ✅ 浏览器控制台无错误

---

**最后更新**：2026-01-30
