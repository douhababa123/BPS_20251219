"""
认证模块
实现 JWT token 生成/验证、OTP 生成/发送/验证
"""

import random
import string
from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
import bcrypt  # 直接使用 bcrypt 替代 passlib
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings

logger = logging.getLogger(__name__)


# ============================================================================
# JWT Token 相关
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建 JWT access token
    
    Args:
        data: 要编码的数据（通常包含 user_id, email 等）
        expires_delta: 过期时间增量
    
    Returns:
        JWT token 字符串
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict]:
    """
    验证 JWT token
    
    Args:
        token: JWT token 字符串
    
    Returns:
        解码后的 payload，验证失败返回 None
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError as e:
        logger.error(f"Token 验证失败: {e}")
        return None


def hash_password(password: str) -> str:
    """
    对密码进行哈希加密（使用 bcrypt）
    
    bcrypt 限制：密码最多 72 字节
    如果密码超过 72 字节，自动截断
    """
    # bcrypt 只能处理 72 字节，必须在传入前截断
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        # 截断到 72 字节
        password_bytes = password_bytes[:72]
    
    # 使用 bcrypt 直接生成哈希
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码（使用 bcrypt）
    
    bcrypt 限制：密码最多 72 字节
    如果密码超过 72 字节，自动截断（与 hash_password 保持一致）
    """
    # bcrypt 只能处理 72 字节，必须在传入前截断
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
        # 截断到 72 字节
        password_bytes = password_bytes[:72]
    
    # 使用 bcrypt 直接验证
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# ============================================================================
# OTP 相关
# ============================================================================

# 内存存储 OTP（生产环境应使用 Redis 或数据库）
otp_storage: Dict[str, Dict] = {}


def generate_otp() -> str:
    """
    生成随机 OTP 验证码
    
    Returns:
        6 位数字验证码
    """
    return ''.join(random.choices(string.digits, k=settings.otp_length))


def store_otp(email: str, otp: str) -> None:
    """
    存储 OTP 验证码
    
    Args:
        email: 用户邮箱
        otp: OTP 验证码
    """
    expire_time = datetime.utcnow() + timedelta(minutes=settings.otp_expire_minutes)
    otp_storage[email] = {
        'otp': otp,
        'expire_time': expire_time,
        'created_at': datetime.utcnow()
    }
    logger.info(f"OTP 已存储: {email} -> {otp} (有效期 {settings.otp_expire_minutes} 分钟)")
    
    # 在控制台显著输出 OTP（开发环境）
    if settings.debug:
        try:
            print("\n" + "="*60)
            print("[OTP] 验证码")
            print("="*60)
            print(f"邮箱: {email}")
            print(f"验证码: {otp}")
            print(f"有效期: {settings.otp_expire_minutes} 分钟")
            print("="*60 + "\n")
        except UnicodeEncodeError:
            # 如果编码失败，使用基本 ASCII
            print("\n" + "="*60)
            print("[OTP] Verification Code")
            print("="*60)
            print(f"Email: {email}")
            print(f"Code: {otp}")
            print(f"Expires in: {settings.otp_expire_minutes} minutes")
            print("="*60 + "\n")
        
        # 同时写入文件，方便用户查看
        import os
        otp_file = os.path.join(os.path.dirname(__file__), "CURRENT_OTP.txt")
        try:
            with open(otp_file, 'w', encoding='utf-8') as f:
                f.write("="*60 + "\n")
                f.write("[OTP] 当前验证码\n")
                f.write("="*60 + "\n")
                f.write(f"邮箱: {email}\n")
                f.write(f"验证码: {otp}\n")
                f.write(f"有效期: {settings.otp_expire_minutes} 分钟\n")
                f.write(f"生成时间: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n")
                f.write("="*60 + "\n")
        except Exception as e:
            logger.error(f"写入 OTP 文件失败: {e}")
            # 如果编码失败，使用基本 ASCII
            print("\n" + "="*60)
            print("[OTP] Verification Code")
            print("="*60)
            print(f"Email: {email}")
            print(f"Code: {otp}")
            print(f"Expires in: {settings.otp_expire_minutes} minutes")
            print("="*60 + "\n")


def verify_otp(email: str, otp: str) -> bool:
    """
    验证 OTP 验证码
    
    Args:
        email: 用户邮箱
        otp: 用户输入的 OTP
    
    Returns:
        验证是否成功
    """
    if email not in otp_storage:
        logger.warning(f"OTP 验证失败: {email} - 未找到 OTP")
        return False
    
    stored_data = otp_storage[email]
    
    # 检查是否过期
    if datetime.utcnow() > stored_data['expire_time']:
        logger.warning(f"OTP 验证失败: {email} - OTP 已过期")
        del otp_storage[email]
        return False
    
    # 验证 OTP
    if stored_data['otp'] != otp:
        logger.warning(f"OTP 验证失败: {email} - OTP 不匹配")
        return False
    
    # 验证成功，删除 OTP
    del otp_storage[email]
    logger.info(f"✅ OTP 验证成功: {email}")
    return True


def is_email_allowed(email: str) -> bool:
    """
    检查邮箱域名是否被允许
    
    Args:
        email: 邮箱地址
    
    Returns:
        是否允许
    """
    domain = email.split('@')[-1].lower()
    allowed = domain in settings.allowed_email_domains
    
    if not allowed:
        logger.warning(f"邮箱域名不允许: {email} (允许的域名: {settings.allowed_email_domains})")
    
    return allowed


async def send_otp_email(email: str, otp: str) -> bool:
    """
    发送 OTP 验证码邮件
    
    Args:
        email: 收件人邮箱
        otp: OTP 验证码
    
    Returns:
        是否发送成功
    """
    # TODO: 实现真实的邮件发送（使用 aiosmtplib）
    # 当前仅打印日志
    
    logger.info(f"📧 发送 OTP 邮件到 {email}")
    logger.info(f"   验证码: {otp}")
    logger.info(f"   有效期: {settings.otp_expire_minutes} 分钟")
    
    # 开发环境：直接返回成功
    if settings.debug:
        logger.info("   ⚠️  开发模式：邮件未实际发送")
        return True
    
    # 生产环境：实现真实邮件发送
    try:
        # import aiosmtplib
        # from email.mime.text import MIMEText
        # from email.mime.multipart import MIMEMultipart
        
        # message = MIMEMultipart()
        # message['From'] = settings.smtp_username
        # message['To'] = email
        # message['Subject'] = f"{settings.app_name} - 登录验证码"
        
        # body = f"""
        # 您好！
        # 
        # 您的登录验证码是：{otp}
        # 
        # 验证码有效期为 {settings.otp_expire_minutes} 分钟，请尽快使用。
        # 
        # 如果这不是您的操作，请忽略此邮件。
        # 
        # ---
        # {settings.app_name}
        # """
        # message.attach(MIMEText(body, 'plain'))
        
        # await aiosmtplib.send(
        #     message,
        #     hostname=settings.smtp_host,
        #     port=settings.smtp_port,
        #     use_tls=settings.smtp_use_tls,
        #     username=settings.smtp_username,
        #     password=settings.smtp_password,
        # )
        
        # logger.info(f"✅ OTP 邮件发送成功: {email}")
        # return True
        
        pass
    except Exception as e:
        logger.error(f"❌ OTP 邮件发送失败: {e}")
        return False


# ============================================================================
# 用于测试的辅助函数
# ============================================================================

def test_auth():
    """测试认证功能"""
    print("=" * 60)
    print("测试认证模块...")
    print("=" * 60)
    
    # 测试 JWT
    print("\n1. 测试 JWT Token:")
    token = create_access_token({"user_id": "123", "email": "test@bosch.com"})
    print(f"   生成的 Token: {token[:50]}...")
    
    payload = verify_token(token)
    print(f"   验证结果: {payload}")
    
    # 测试密码哈希
    print("\n2. 测试密码哈希:")
    password = "test123"
    hashed = hash_password(password)
    print(f"   原始密码: {password}")
    print(f"   哈希结果: {hashed}")
    print(f"   验证结果: {verify_password(password, hashed)}")
    
    # 测试 OTP
    print("\n3. 测试 OTP:")
    email = "test@bosch.com"
    otp = generate_otp()
    print(f"   生成 OTP: {otp}")
    store_otp(email, otp)
    print(f"   验证 OTP (正确): {verify_otp(email, otp)}")
    
    # 重新生成测试错误情况
    otp2 = generate_otp()
    store_otp(email, otp2)
    print(f"   验证 OTP (错误): {verify_otp(email, '000000')}")
    
    # 测试邮箱域名
    print("\n4. 测试邮箱域名验证:")
    print(f"   test@bosch.com: {is_email_allowed('test@bosch.com')}")
    print(f"   test@bshg.com: {is_email_allowed('test@bshg.com')}")
    print(f"   test@gmail.com: {is_email_allowed('test@gmail.com')}")
    
    print("\n✅ 认证模块测试完成")


# ============================================================================
# FastAPI 依赖注入：获取当前用户
# ============================================================================

# HTTP Bearer Token 认证方案
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    获取当前认证用户（FastAPI 依赖注入）
    
    从 Authorization Header 中提取 JWT token 并验证，
    返回用户信息字典（包含 user_id, email, name, role）
    
    Args:
        credentials: HTTP Bearer Token
    
    Returns:
        用户信息字典 {"user_id": str, "email": str, "name": str, "role": str}
    
    Raises:
        HTTPException: 401 - Token 无效或已过期
    """
    token = credentials.credentials
    
    # 验证 token
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 提取用户信息
    user_id = payload.get("user_id")
    email = payload.get("email")
    name = payload.get("name", "")
    role = payload.get("role", "user")  # 默认为普通用户
    
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌缺少必要信息",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": role
    }


def verify_admin(current_user: Dict = Depends(get_current_user)) -> Dict:
    """
    验证当前用户是否为管理员（FastAPI 依赖注入）
    
    用于保护需要管理员权限的 API 端点
    
    Args:
        current_user: 当前用户信息（由 get_current_user 提供）
    
    Returns:
        用户信息字典（如果是管理员）
    
    Raises:
        HTTPException: 403 - 用户不是管理员
    
    Usage:
        @router.get("/admin/users")
        def get_all_users(current_user: Dict = Depends(verify_admin)):
            # 只有管理员能访问
            pass
    """
    role = current_user.get("role", "user")
    
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    
    logger.info(f"✅ 管理员验证通过: {current_user.get('email')}")
    return current_user


if __name__ == "__main__":
    test_auth()
