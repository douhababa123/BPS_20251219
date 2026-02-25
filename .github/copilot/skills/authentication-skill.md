# Authentication Flow Skill

**Description**: Implement and understand JWT + OTP authentication flow for the BPS platform.

**Usage**: Use this skill when implementing auth features, debugging login issues, or securing API endpoints.

## Capabilities

### 1. Authentication Architecture

**Flow Overview**:
```
User Registration/Login
    ↓
Generate OTP (6-digit code)
    ↓
Send OTP via Email (SMTP)
    ↓
User Enters OTP
    ↓
Verify OTP
    ↓
Generate JWT Token
    ↓
Return Token to Client
    ↓
Client Stores Token (localStorage)
    ↓
Subsequent Requests Include Token (Authorization header)
```

### 2. OTP Generation & Verification

**Generate OTP** (`backend/auth.py`):
```python
import random
import string
from datetime import datetime, timedelta
from typing import Dict

# In-memory storage (use Redis in production)
otp_storage: Dict[str, Dict] = {}

def generate_otp() -> str:
    """生成6位数字验证码"""
    return ''.join(random.choices(string.digits, k=6))

def store_otp(email: str, otp: str, expires_minutes: int = 10):
    """存储OTP到内存/数据库"""
    otp_storage[email] = {
        'code': otp,
        'expires_at': datetime.utcnow() + timedelta(minutes=expires_minutes),
        'attempts': 0
    }

def verify_otp(email: str, code: str) -> bool:
    """验证OTP"""
    stored = otp_storage.get(email)
    
    if not stored:
        return False
    
    # 检查过期
    if datetime.utcnow() > stored['expires_at']:
        del otp_storage[email]
        return False
    
    # 检查尝试次数
    if stored['attempts'] >= 3:
        del otp_storage[email]
        return False
    
    # 验证代码
    if stored['code'] != code:
        stored['attempts'] += 1
        return False
    
    # 验证成功，删除OTP
    del otp_storage[email]
    return True
```

**Database Storage** (alternative to memory):
```sql
-- OTP tokens table
CREATE TABLE otp_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) NOT NULL,
    code NVARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    INDEX idx_email_expires (email, expires_at)
);

-- Clean expired tokens periodically
DELETE FROM otp_tokens WHERE expires_at < GETDATE();
```

### 3. JWT Token Management

**Create JWT Token** (`backend/auth.py`):
```python
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, Dict
from config import settings

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    创建JWT access token
    
    Args:
        data: {"user_id": "123", "email": "user@bosch.com", "role": "admin"}
        expires_delta: 过期时间（默认30分钟）
    
    Returns:
        JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),  # Issued at
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm  # HS256
    )
    
    return encoded_jwt
```

**Verify JWT Token**:
```python
def verify_token(token: str) -> Optional[Dict]:
    """
    验证JWT token
    
    Returns:
        Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        
        # 检查token类型
        if payload.get("type") != "access":
            return None
        
        return payload
        
    except JWTError as e:
        logger.error(f"Token验证失败: {e}")
        return None
```

**Refresh Token** (optional):
```python
def create_refresh_token(user_id: str) -> str:
    """创建refresh token（有效期7天）"""
    return create_access_token(
        data={"user_id": user_id, "type": "refresh"},
        expires_delta=timedelta(days=7)
    )

def refresh_access_token(refresh_token: str) -> Optional[str]:
    """使用refresh token获取新的access token"""
    payload = verify_token(refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        return None
    
    return create_access_token({"user_id": payload["user_id"]})
```

### 4. Email OTP Sending

**SMTP Configuration** (`backend/config.py`):
```python
class Settings(BaseSettings):
    # SMTP settings
    smtp_server: str = "smtp.bosch.com"
    smtp_port: int = 587
    smtp_use_tls: bool = True
    smtp_username: str = "bps-system@bosch.com"
    smtp_password: str = ""  # From environment
    smtp_from_email: str = "noreply@bosch.com"
    smtp_from_name: str = "BPS System"
```

**Send Email Function** (`backend/auth.py`):
```python
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings

def send_otp_email(email: str, otp: str) -> bool:
    """通过SMTP发送OTP邮件"""
    try:
        # 创建邮件
        message = MIMEMultipart()
        message['From'] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        message['To'] = email
        message['Subject'] = "BPS系统验证码"
        
        # 邮件内容
        body = f"""
        <html>
        <body>
            <h2>BPS 登录验证码</h2>
            <p>您的验证码是: <strong style="font-size: 24px; color: #0066cc;">{otp}</strong></p>
            <p>验证码将在10分钟后过期。</p>
            <p>如果这不是您的操作，请忽略此邮件。</p>
            <br>
            <p style="color: #666;">BPS Capacity & Scheduling Platform</p>
        </body>
        </html>
        """
        
        message.attach(MIMEText(body, 'html'))
        
        # 发送邮件
        with smtplib.SMTP(settings.smtp_server, settings.smtp_port) as server:
            if settings.smtp_use_tls:
                server.starttls()
            
            if settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            
            server.send_message(message)
        
        logger.info(f"✅ OTP邮件已发送到: {email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ 发送OTP邮件失败: {e}")
        return False
```

### 5. API Routes

**Registration/Login Route** (`backend/routers/auth.py`):
```python
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from auth import generate_otp, store_otp, send_otp_email

router = APIRouter()

class SendOTPRequest(BaseModel):
    email: EmailStr

@router.post("/send-otp")
async def send_otp(request: SendOTPRequest):
    """
    发送OTP到邮箱
    
    场景：用户注册或登录时请求验证码
    """
    email = request.email
    
    # 验证邮箱域名（仅允许 @bosch.com）
    if not email.endswith("@bosch.com"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅支持Bosch邮箱注册"
        )
    
    # 生成OTP
    otp = generate_otp()
    store_otp(email, otp, expires_minutes=10)
    
    # 发送邮件
    if not send_otp_email(email, otp):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="发送验证码失败，请稍后重试"
        )
    
    return {
        "message": "验证码已发送到您的邮箱",
        "email": email,
        "expires_in_minutes": 10
    }
```

**Verify OTP and Login**:
```python
class VerifyOTPRequest(BaseModel):
    email: EmailStr
    code: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user_id: str
    email: str

@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp_and_login(
    request: VerifyOTPRequest,
    db_cursor = Depends(get_db_cursor)
):
    """
    验证OTP并登录
    
    返回JWT token供后续请求使用
    """
    email = request.email
    code = request.code
    
    # 验证OTP
    if not verify_otp(email, code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="验证码无效或已过期"
        )
    
    # 查找或创建用户
    db_cursor.execute(
        "SELECT id, email, role FROM users WHERE email = ?",
        (email,)
    )
    user = db_cursor.fetchone()
    
    if not user:
        # 首次登录，创建用户
        db_cursor.execute("""
            INSERT INTO users (email, role, is_active)
            VALUES (?, 'user', 1)
        """, (email,))
        db_cursor.connection.commit()
        
        db_cursor.execute(
            "SELECT id, email, role FROM users WHERE email = ?",
            (email,)
        )
        user = db_cursor.fetchone()
    
    user_id = str(user[0])
    user_email = user[1]
    user_role = user[2]
    
    # 生成JWT token
    access_token = create_access_token(
        data={
            "user_id": user_id,
            "email": user_email,
            "role": user_role
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        user_id=user_id,
        email=user_email
    )
```

### 6. Protected Routes

**Dependency for Auth**:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import verify_token

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    从JWT token获取当前用户
    
    使用方法：
    @router.get("/protected")
    async def protected_route(user: dict = Depends(get_current_user)):
        return {"user_id": user["user_id"]}
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token无效或已过期",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return payload

# 可选：角色验证
def require_role(required_role: str):
    """角色权限验证装饰器"""
    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="权限不足"
            )
        return user
    return role_checker

# 使用示例
@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: str,
    user: dict = Depends(require_role("admin"))
):
    """仅管理员可删除员工"""
    ...
```

### 7. Frontend Integration

**Login Component** (React):
```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

// Step 1: Request OTP
async function requestOTP(email: string) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
      email
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || '发送验证码失败');
    }
    throw error;
  }
}

// Step 2: Verify OTP and get token
async function verifyOTP(email: string, code: string) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
      email,
      code
    });
    
    const { access_token, user_id, email: userEmail } = response.data;
    
    // Store token in localStorage
    localStorage.setItem('authToken', access_token);
    localStorage.setItem('userId', user_id);
    localStorage.setItem('userEmail', userEmail);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || '验证失败');
    }
    throw error;
  }
}

// Step 3: Make authenticated requests
async function getProtectedData() {
  const token = localStorage.getItem('authToken');
  
  if (!token) {
    throw new Error('未登录');
  }
  
  try {
    const response = await axios.get(`${API_BASE_URL}/employees`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token expired, clear localStorage and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      throw new Error('登录已过期，请重新登录');
    }
    throw error;
  }
}

// Logout
function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('userEmail');
  window.location.href = '/login';
}
```

**Axios Interceptor** (auto-attach token):
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api'
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

## Security Best Practices

### 1. OTP Security
- ✅ **Expire quickly**: 10 minutes max
- ✅ **Limit attempts**: 3 tries then regenerate
- ✅ **Rate limiting**: Max 5 OTPs per hour per email
- ✅ **One-time use**: Delete after verification
- ✅ **Random generation**: Use `secrets` module (more secure than `random`)

### 2. JWT Security
- ✅ **Strong secret key**: At least 32 bytes, random
- ✅ **Short expiration**: 30 minutes for access tokens
- ✅ **HTTPS only**: Never send over HTTP
- ✅ **No sensitive data**: Don't store passwords in JWT
- ✅ **Validate signature**: Always verify before trusting

### 3. Email Security
- ✅ **Verify domain**: Only @bosch.com
- ✅ **Sanitize input**: Prevent email injection
- ✅ **Use TLS**: Encrypt SMTP connection
- ✅ **Log failures**: Monitor for abuse

### 4. Frontend Security
- ✅ **localStorage**: OK for tokens (prefer httpOnly cookies in production)
- ✅ **Clear on logout**: Remove all auth data
- ✅ **Auto-refresh**: Warn before token expires
- ✅ **HTTPS**: Always use in production

## Testing Auth Flow

### Manual Testing
```bash
# 1. Request OTP
curl -X POST http://localhost:8000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@bosch.com"}'

# 2. Check email for code (or check logs)

# 3. Verify OTP
curl -X POST http://localhost:8000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@bosch.com", "code": "123456"}'

# 4. Use token
curl http://localhost:8000/api/employees \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Automated Testing
```python
def test_auth_flow():
    # Step 1: Send OTP
    response = client.post("/api/auth/send-otp", json={
        "email": "test@bosch.com"
    })
    assert response.status_code == 200
    
    # Step 2: Verify OTP (mock OTP storage)
    mock_otp = "123456"
    response = client.post("/api/auth/verify-otp", json={
        "email": "test@bosch.com",
        "code": mock_otp
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Step 3: Access protected route
    response = client.get("/api/employees", headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 200
```

## Troubleshooting

**"验证码无效"**: 
- Check OTP expiration (10 min)
- Verify email match
- Check attempt count

**"Token已过期"**:
- Check JWT expiration time
- Implement refresh token
- Verify system clock sync

**"邮件未收到"**:
- Check SMTP configuration
- Verify email address
- Check spam folder
- Review server logs
