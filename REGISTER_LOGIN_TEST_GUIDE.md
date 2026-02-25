# 注册和登录功能快速测试指南

## ✅ 已创建的文件

### 前端页面
- ✅ `src/pages/auth/RegisterPage.tsx` - 注册页面
- ✅ `src/pages/auth/PasswordLoginPage.tsx` - 密码登录页面
- ✅ `src/App.tsx` - 路由配置已更新

### 后端 API（已存在）
- ✅ `POST /api/auth/register` - 注册接口
- ✅ `POST /api/auth/login` - 登录接口
- ✅ `backend/models.py` - 数据模型已存在

---

## 🚀 快速开始

### 1. 启动服务

**后端**：
```bash
cd backend
python main.py
```

**前端**：
```bash
npm run dev
```

### 2. 访问页面

- **注册页面**: http://localhost:5173/register
- **登录页面**: http://localhost:5173/password-login
- **OTP登录**: http://localhost:5173/login

---

## 🎨 页面功能特性

### 注册页面功能
- ✅ **邮箱验证** - 仅支持 @bosch.com 和 @bshg.com 域名
- ✅ **姓名输入** - 自动填充到用户资料
- ✅ **密码强度检测** - 实时显示密码强度（弱/中/强）
- ✅ **密码可见切换** - 点击眼睛图标显示/隐藏密码
- ✅ **两次密码验证** - 自动检测密码一致性
- ✅ **错误提示** - 友好的中文错误消息
- ✅ **自动登录** - 注册成功后自动保存 Token 并跳转
- ✅ **30天免登录** - JWT Token 有效期 30 天

### 登录页面功能
- ✅ **邮箱 + 密码登录**
- ✅ **密码可见切换**
- ✅ **记住登录状态** - 30天内无需重复登录
- ✅ **错误提示** - 清晰的错误信息
- ✅ **快速跳转** - 可跳转到注册页或 OTP 登录页

### UI 设计亮点
- ✨ **渐变背景** - 蓝色到紫色的渐变背景
- ✨ **圆角卡片** - 现代化的卡片设计
- ✨ **图标增强** - Lucide React 图标库
- ✨ **Loading 动画** - 提交时显示加载状态
- ✨ **响应式设计** - 移动端友好

---

## 📝 测试步骤

### 场景 1：新用户注册

1. **访问注册页面**
   ```
   http://localhost:5173/register
   ```

2. **填写表单**
   - 邮箱: `test.user@bosch.com` (必须是 @bosch.com 或 @bshg.com)
   - 姓名: `测试用户`
   - 密码: `Test1234` (至少8位，包含字母和数字)
   - 确认密码: `Test1234`

3. **点击"注册并登录"**
   - ✅ 成功：自动跳转到主界面
   - ❌ 失败：显示错误信息（如邮箱已注册）

4. **验证登录状态**
   ```javascript
   // 在浏览器控制台（F12）执行
   console.log('Token:', localStorage.getItem('access_token'));
   console.log('User ID:', localStorage.getItem('user_id'));
   console.log('Email:', localStorage.getItem('user_email'));
   ```

### 场景 2：已有用户登录

1. **访问登录页面**
   ```
   http://localhost:5173/password-login
   ```

2. **输入凭据**
   - 邮箱: `test.user@bosch.com`
   - 密码: `Test1234`

3. **点击"登录"**
   - ✅ 成功：自动跳转到主界面
   - ❌ 失败：显示"邮箱或密码错误"

### 场景 3：密码强度测试

1. 在注册页面的密码输入框输入以下内容，观察强度指示器：
   - `123` → 不满足最低要求（至少8位）
   - `12345678` → 弱（仅数字）
   - `abc12345` → 中（字母+数字，无大写）
   - `Abc12345` → 强（大小写+数字）
   - `Abc@1234` → 强（大小写+数字+特殊字符）

### 场景 4：错误处理测试

1. **邮箱域名错误**
   - 输入: `test@gmail.com`
   - 预期: 显示"邮箱域名不被允许"

2. **密码不一致**
   - 密码: `Test1234`
   - 确认密码: `Test5678`
   - 预期: 显示"两次密码输入不一致"

3. **邮箱已注册**
   - 重复注册相同邮箱
   - 预期: 显示"该邮箱已注册，请直接登录"

4. **登录密码错误**
   - 输入错误密码
   - 预期: 显示"邮箱或密码错误"

---

## 🔧 后端 API 测试

### 使用 PowerShell 测试

#### 1. 测试注册 API
```powershell
$body = @{
    email = "test.user@bosch.com"
    name = "测试用户"
    password = "Test1234"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register/" `
    -Method POST `
    -Headers $headers `
    -Body $body

# 查看返回的 Token
Write-Output "Access Token: $($response.access_token)"
Write-Output "User ID: $($response.user_id)"
Write-Output "Email: $($response.email)"
```

#### 2. 测试登录 API
```powershell
$body = @{
    email = "test.user@bosch.com"
    password = "Test1234"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login/" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body

Write-Output "Login Success!"
Write-Output "Token: $($response.access_token)"
```

#### 3. 验证 Token
```powershell
$token = "你的_access_token"

$headers = @{
    Authorization = "Bearer $token"
}

$userInfo = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/me/" `
    -Method GET `
    -Headers $headers

Write-Output $userInfo
```

---

## 🐛 常见问题排查

### 问题 1：注册后跳转登录页

**原因**：Token 未正确保存到 localStorage

**解决方案**：
1. 检查浏览器控制台的错误信息
2. 验证后端返回的数据格式
3. 确认 `apiClient` 正确添加了 `/` 后缀

### 问题 2：邮箱验证失败

**错误信息**：`邮箱域名不被允许`

**解决方案**：
- 后端配置在 `backend/config.py` Line 47
- 默认允许：`@bosch.com` 和 `@bshg.com`
- 如需添加其他域名，修改 `allowed_email_domains`

### 问题 3：密码强度要求

**最低要求**：
- ✅ 至少 8 位
- ✅ 至少包含 1 个字母
- ✅ 至少包含 1 个数字

**推荐密码格式**：
- `Test1234` ✅
- `MyPassword123` ✅
- `BPS2024!` ✅

### 问题 4：CORS 错误

**错误信息**：`Access to XMLHttpRequest has been blocked by CORS policy`

**解决方案**：
1. 确认后端 CORS 配置（`backend/config.py` Line 41-45）
2. 确认前端运行在 `localhost:5173`
3. 如需添加其他端口，修改 `allowed_origins`

---

## 📊 数据库验证

### 检查注册用户

```sql
-- 连接到 SQL Server
USE DCCT_BPS_Debug;

-- 查看所有用户
SELECT id, email, name, created_at
FROM dbo.users
ORDER BY created_at DESC;

-- 检查密码哈希
SELECT email, 
       SUBSTRING(password_hash, 1, 20) + '...' as password_hash_preview,
       created_at
FROM dbo.users;
```

### 验证 Token 有效期

```javascript
// 在浏览器控制台执行
const token = localStorage.getItem('access_token');
if (token) {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Token 信息:');
    console.log('  - 用户ID:', payload.user_id);
    console.log('  - 邮箱:', payload.email);
    console.log('  - 姓名:', payload.name);
    console.log('  - 过期时间:', new Date(payload.exp * 1000).toLocaleString());
    console.log('  - 是否过期:', new Date(payload.exp * 1000) < new Date());
}
```

---

## 🎯 下一步开发建议

### 短期（本周）
1. ✅ 测试注册和登录功能
2. ⏳ 添加"忘记密码"功能
3. ⏳ 实现邮箱验证（可选）

### 中期（下周）
1. ⏳ 用户资料管理页面
2. ⏳ 头像上传功能
3. ⏳ 修改密码功能

### 长期（未来）
1. ⏳ 多设备登录管理
2. ⏳ 登录日志和安全审计
3. ⏳ 第三方登录集成（Microsoft/Google）

---

## 📞 技术支持

### 文档参考
- [USER_MANAGEMENT_PLAN.md](USER_MANAGEMENT_PLAN.md) - 完整用户管理系统规划
- [SCHEDULE_LOGIN_REDIRECT_FIX.md](SCHEDULE_LOGIN_REDIRECT_FIX.md) - 认证问题排查指南

### 关键文件位置
- **前端**: `src/pages/auth/`
- **后端**: `backend/routers/auth.py`
- **配置**: `backend/config.py`
- **数据库**: `SQLSERVER_SCHEMA.sql`

---

**祝测试顺利！** 🎉
如有任何问题，请查看文档或检查浏览器/后端控制台的错误信息。
