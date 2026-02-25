# 🔐 BPS登录认证系统说明

## 📧 用户管理

### ✅ 已添加用户
- **chao.dong@bshg.com** (Chao Dong) - 刚刚添加

### 添加新用户
如需添加更多用户，运行：
```bash
cd backend
python add_user.py
```

---

## 🔑 OTP验证码登录流程详解

### 工作原理

```
用户输入邮箱 → 系统生成6位数字验证码 → 存储5分钟 → 用户输入验证码 → 验证成功登录
```

### 当前实现（开发模式）

**问题：为什么没有实际发送邮件？**

目前系统运行在**开发模式**下，邮件功能**未配置**。验证码不会发送到你的邮箱，而是：

1. **控制台显示** - 后端terminal会显示验证码
2. **文件输出** - 自动写入 `backend/CURRENT_OTP.txt`
3. **快速获取** - 运行 `python backend/get_otp.py`

**开发模式的原因：**
```python
# config.py
debug: bool = True  # 开发模式

# auth.py
if settings.debug:
    logger.info("⚠️  开发模式：邮件未实际发送")
    return True  # 不实际发送，直接返回成功
```

---

## 📮 配置真实邮件发送

### 需要的信息

要实际发送验证码邮件到 `chao.dong@bshg.com`，需要配置**博世邮件服务器**：

```python
# 在 config.py 或创建 .env 文件配置：

# SMTP 配置
SMTP_HOST=smtp.bosch.com          # 博世邮件服务器
SMTP_PORT=587                     # 端口（或25）
SMTP_USE_TLS=True                 # 是否使用TLS加密
SMTP_USERNAME=your.email@bosch.com  # 发件邮箱（需要真实博世邮箱）
SMTP_PASSWORD=your_password        # 邮箱密码或应用专用密码

DEBUG=False  # 关闭开发模式，启用真实发送
```

### 实现步骤

我可以帮你完成以下配置：

**1. 修改 `auth.py` 中的邮件发送函数**
```python
async def send_otp_email(email: str, otp: str) -> bool:
    """真实发送邮件"""
    import aiosmtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    message = MIMEMultipart()
    message['From'] = settings.smtp_username
    message['To'] = email
    message['Subject'] = f"{settings.app_name} - 登录验证码"
    
    html = f"""
    <html>
      <body>
        <h2>您的登录验证码</h2>
        <p>验证码: <strong style="font-size: 24px; color: #0066cc;">{otp}</strong></p>
        <p>有效期: {settings.otp_expire_minutes} 分钟</p>
        <p>如非本人操作，请忽略此邮件。</p>
      </body>
    </html>
    """
    
    message.attach(MIMEText(html, 'html'))
    
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            use_tls=settings.smtp_use_tls,
            username=settings.smtp_username,
            password=settings.smtp_password,
        )
        logger.info(f"✅ 邮件发送成功: {email}")
        return True
    except Exception as e:
        logger.error(f"❌ 邮件发送失败: {e}")
        return False
```

**2. 需要提供的信息**
- 你用于发送验证码的博世邮箱地址（如 `noreply@bosch.com`）
- 该邮箱的密码或应用专用密码
- 博世SMTP服务器地址（通常是 `smtp.bosch.com`）

---

## 🎫 长期登录（JWT Token）

### 当前问题
现在每次登录都需要输入验证码，确实很麻烦。

### 解决方案：JWT Token会话保持

系统已经实现了JWT token机制，可以保持登录状态：

```python
# config.py
jwt_access_token_expire_minutes: int = 30  # Token有效期30分钟
```

**如何实现"一个月内免登录"：**

**方案1：延长Token有效期**
```python
# 修改 config.py
jwt_access_token_expire_minutes: int = 43200  # 30天 = 43200分钟
```

**方案2：添加Refresh Token（推荐）**
- Access Token: 30分钟（用于API访问）
- Refresh Token: 30天（用于自动刷新）
- 前端自动使用Refresh Token换取新的Access Token

**方案3：使用Cookie + Remember Me**
```python
# 登录时设置Cookie
response.set_cookie(
    key="auth_token",
    value=token,
    max_age=2592000,  # 30天（秒）
    httponly=True,
    secure=True,
    samesite="lax"
)
```

### 前端需要做的

**1. 存储Token**
```typescript
// 登录成功后
localStorage.setItem('auth_token', token);
// 或使用 sessionStorage（浏览器关闭后失效）
```

**2. 自动带上Token**
```typescript
// 在API请求中自动添加
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

**3. Token过期处理**
```typescript
// 检测401错误，自动刷新或跳转登录
if (error.response.status === 401) {
  // 清除过期token
  localStorage.removeItem('auth_token');
  // 跳转到登录页
  router.push('/login');
}
```

---

## 🚀 立即改进建议

### 建议1：延长Token有效期到7天
```python
# backend/config.py
jwt_access_token_expire_minutes: int = 10080  # 7天
```

### 建议2：前端记住登录状态
```typescript
// 修改前端登录逻辑，保存token
// src/hooks/useAuth.ts 或类似文件
const handleLogin = async (email: string, otp: string) => {
  const response = await verifyOTP(email, otp);
  
  // 保存到localStorage，浏览器关闭后仍然有效
  localStorage.setItem('auth_token', response.access_token);
  localStorage.setItem('user_email', email);
  
  // 设置axios默认header
  api.defaults.headers.common['Authorization'] = 
    `Bearer ${response.access_token}`;
};

// 应用启动时自动恢复登录
const token = localStorage.getItem('auth_token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  // 验证token是否还有效
  try {
    await api.get('/api/auth/me');
    // token有效，用户已登录
  } catch {
    // token无效，清除并跳转登录
    localStorage.removeItem('auth_token');
  }
}
```

---

## 📝 总结

### 问题1：添加 chao.dong@bshg.com
**✅ 已解决** - 用户已添加到数据库

### 问题2：实际发送验证码
**⚠️ 需要配置** - 需要提供博世邮箱SMTP信息才能真实发送

### 问题3：如何实现的
**原理**：
1. 后端生成随机6位验证码
2. 存储在内存中（5分钟有效）
3. （应该）通过SMTP发送到用户邮箱
4. 用户输入验证码验证成功
5. 返回JWT token

### 问题4：保持登录避免频繁输入验证码
**✅ 可实现** - 有3种方案：
1. 延长JWT token有效期（最简单）
2. 实现Refresh Token机制（最佳）
3. 使用Cookie存储（适合浏览器）

---

## ⚡ 快速操作

### 获取当前验证码（开发模式）
```bash
# 方法1：查看后端terminal输出
# 方法2：
cat backend/CURRENT_OTP.txt
# 方法3：
python backend/get_otp.py
```

### 测试登录流程
1. 打开前端 http://localhost:5174
2. 输入邮箱 `chao.dong@bshg.com`
3. 点击"发送验证码"
4. 查看后端terminal或运行 `python backend/get_otp.py` 获取验证码
5. 输入验证码登录

### 修改Token有效期为7天
编辑 `backend/config.py`:
```python
jwt_access_token_expire_minutes: int = 10080  # 改为10080
```

---

## 🔧 需要我帮你做什么？

1. **配置真实邮件发送** - 需要你提供SMTP邮箱信息
2. **延长Token有效期** - 我可以立即修改为7天或30天
3. **实现Refresh Token** - 更完善的会话管理
4. **修改前端自动登录** - 保存token，下次访问自动恢复

请告诉我你想先实现哪个功能！
