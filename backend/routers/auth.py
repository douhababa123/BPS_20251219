"""
认证路由
处理登录、OTP 验证等
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging
import sys
import os

# 添加父目录到路径以导入 auth 模块
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# 导入模型
from models import (
    OTPRequest, OTPVerifyRequest, TokenResponse, MessageResponse,
    PasswordLoginRequest, RegisterRequest
)

# 导入父目录的 auth 模块（使用 importlib 避免命名冲突）
import importlib.util
auth_spec = importlib.util.spec_from_file_location("auth_module", os.path.join(parent_dir, "auth.py"))
auth = importlib.util.module_from_spec(auth_spec)
auth_spec.loader.exec_module(auth)

from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()


# ============================================================================
# OTP 相关路由
# ============================================================================

@router.post("/signup-otp", response_model=MessageResponse)
async def signup_with_otp(request: OTPRequest):
    """
    注册/登录第一步：发送 OTP 到邮箱
    """
    # 检查邮箱域名
    if not auth.is_email_allowed(request.email):
        raise HTTPException(
            status_code=400,
            detail=f"邮箱域名不被允许，请使用 @bosch.com 或 @bshg.com 邮箱"
        )
    
    # 生成并存储 OTP
    otp = auth.generate_otp()
    auth.store_otp(request.email, otp)
    
    # 发送 OTP 邮件
    success = await auth.send_otp_email(request.email, otp)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="发送 OTP 失败，请稍后重试"
        )
    
    return MessageResponse(
        message="OTP 已发送到您的邮箱",
        detail=f"验证码已发送到 {request.email}，请查收邮件"
    )


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp_and_login(request: OTPVerifyRequest, cursor=Depends(get_db)):
    """
    注册/登录第二步：验证 OTP 并返回 token
    """
    # 验证 OTP
    if not auth.verify_otp(request.email, request.otp):
        raise HTTPException(
            status_code=400,
            detail="OTP 验证失败，请检查验证码是否正确或已过期"
        )
    
    # 查询或创建用户
    cursor.execute(
        "SELECT id, email, name, role FROM dbo.users WHERE email = ?",
        request.email
    )
    user = cursor.fetchone()
    
    if user:
        user_id = str(user[0])
        email = user[1]
        name = user[2] or "User"
        role = user[3] or "user"
        logger.info(f"✅ 用户登录: {email} (role={role})")
    else:
        # 用户不存在，返回错误或自动创建
        raise HTTPException(
            status_code=404,
            detail="用户不存在，请联系管理员添加账号"
        )
    
    # 生成 JWT token
    token = auth.create_access_token({
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": role
    })
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user_id,
        email=email,
        role=role
    )


# ============================================================================
# ============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    依赖注入：获取当前登录用户
    """
    token = credentials.credentials
    payload = auth.verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Token 无效或已过期"
        )
    
    return payload


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    获取当前用户信息
    """
    return {
        "user_id": current_user.get("user_id"),
        "email": current_user.get("email"),
        "name": current_user.get("name")
    }


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: dict = Depends(get_current_user)):
    """
    登出（客户端需要删除本地 token）
    """
    logger.info(f"用户登出: {current_user.get('email')}")
    return MessageResponse(
        message="登出成功",
        detail="请删除本地存储的 token"
    )


# ============================================================================
# 密码认证（邮箱+密码）
# ============================================================================

@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, cursor=Depends(get_db)):
    """
    注册新用户：邮箱+密码
    自动登录并返回token（30天有效）
    """
    # 检查邮箱域名
    if not auth.is_email_allowed(request.email):
        raise HTTPException(
            status_code=400,
            detail=f"邮箱域名不被允许，请使用 @bosch.com 或 @bshg.com 邮箱"
        )
    
    # 验证密码长度（bcrypt 限制 72 字节）
    if len(request.password.encode('utf-8')) > 72:
        raise HTTPException(
            status_code=400,
            detail="密码过长，最多支持 72 字节（约 72 个英文字符或 24 个中文字符）"
        )
    
    # 检查邮箱是否已注册
    cursor.execute(
        "SELECT id FROM dbo.users WHERE email = ?",
        request.email
    )
    existing_user = cursor.fetchone()
    
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="该邮箱已注册，请直接登录"
        )
    
    # 加密密码
    hashed_password = auth.hash_password(request.password)
    
    # 创建用户
    try:
        name = request.name or request.email.split('@')[0]
        
        cursor.execute(
            """
            INSERT INTO dbo.users (email, name, password_hash)
            VALUES (?, ?, ?)
            """,
            request.email, name, hashed_password
        )
        cursor.commit()
        
        # 获取新用户ID
        cursor.execute(
            "SELECT id, email, name, role FROM dbo.users WHERE email = ?",
            request.email
        )
        user = cursor.fetchone()
        user_id = str(user[0])
        email = user[1]
        name = user[2]
        role = user[3] or "user"
        
        logger.info(f"✅ 新用户注册: {email} (role={role})")
    except Exception as e:
        logger.error(f"❌ 注册失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"注册失败: {str(e)}"
        )
    
    # 生成 JWT token（30天有效）
    token = auth.create_access_token({
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": role
    })
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user_id,
        email=email,
        role=role
    )


@router.post("/login", response_model=TokenResponse)
def login(request: PasswordLoginRequest, cursor=Depends(get_db)):
    """
    密码登录：邮箱+密码
    返回token（30天有效）
    """
    # 检查邮箱域名
    if not auth.is_email_allowed(request.email):
        raise HTTPException(
            status_code=400,
            detail=f"邮箱域名不被允许，请使用 @bosch.com 或 @bshg.com 邮箱"
        )
    
    # 查询用户
    cursor.execute(
        "SELECT id, email, name, password_hash, role FROM dbo.users WHERE email = ?",
        request.email
    )
    user = cursor.fetchone()
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="邮箱或密码错误"
        )
    
    user_id = str(user[0])
    email = user[1]
    name = user[2]
    password_hash = user[3]
    role = user[4] or "user"
    
    # 检查密码是否存在
    if not password_hash:
        raise HTTPException(
            status_code=401,
            detail="该账号未设置密码，请使用OTP登录或联系管理员"
        )
    
    # 验证密码
    if not auth.verify_password(request.password, password_hash):
        raise HTTPException(
            status_code=401,
            detail="邮箱或密码错误"
        )
    
    logger.info(f"✅ 用户登录: {email} (role={role})")
    
    # 生成 JWT token（30天有效）
    token = auth.create_access_token({
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": role
    })
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user_id,
        email=email,
        role=role
    )



# ============================================================================
# 简化端点：兼容前端simple-login调用
# ============================================================================

@router.post("/simple-login", response_model=TokenResponse)
def simple_login_compat(request: PasswordLoginRequest, cursor=Depends(get_db)):
    """
    简化登录端点（兼容性）：自动注册或登录
    - 新用户：自动注册
    - 老用户：验证密码登录
    """
    # 检查邮箱域名
    if not auth.is_email_allowed(request.email):
        raise HTTPException(
            status_code=400,
            detail=f"邮箱域名不被允许，请使用 @bosch.com 或 @bshg.com 邮箱"
        )
    
    # 查询用户
    cursor.execute(
        "SELECT id, email, name, password_hash, role FROM dbo.users WHERE email = ?",
        request.email
    )
    user = cursor.fetchone()
    
    if user:
        # 用户已存在
        user_id = str(user[0])
        email = user[1]
        name = user[2] or "User"
        stored_password_hash = user[3]
        role = user[4] or "user"
        
        if stored_password_hash:
            # 已有密码，验证密码
            if not auth.verify_password(request.password, stored_password_hash):
                raise HTTPException(
                    status_code=401,
                    detail="密码错误"
                )
            logger.info(f"✅ 用户登录成功: {email}")
        else:
            # 首次设置密码
            password_hash = auth.hash_password(request.password)
            cursor.execute(
                "UPDATE dbo.users SET password_hash = ? WHERE id = ?",
                password_hash, user_id
            )
            cursor.commit()
            logger.info(f"✅ 用户首次设置密码: {email}")
    else:
        # 用户不存在，自动注册
        try:
            name = request.email.split('@')[0]
            password_hash = auth.hash_password(request.password)
            
            cursor.execute(
                """
                INSERT INTO dbo.users (email, name, password_hash)
                VALUES (?, ?, ?)
                """,
                request.email, name, password_hash
            )
            cursor.commit()
            
            # 获取新创建的用户ID
            cursor.execute(
                "SELECT id, email, name, role FROM dbo.users WHERE email = ?",
                request.email
            )
            user = cursor.fetchone()
            user_id = str(user[0])
            email = user[1]
            name = user[2]
            role = user[3] or "user"
            
            logger.info(f"✅ 新用户注册成功: {email}")
        except Exception as e:
            logger.error(f"❌ 创建用户失败: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"创建用户失败: {str(e)}"
            )
    
    # 更新最后登录时间
    from datetime import datetime, timedelta
    cursor.execute(
        "UPDATE dbo.users SET last_login_at = ? WHERE id = ?",
        datetime.now(), user_id
    )
    cursor.commit()
    
    # 生成 JWT token（30天有效 if remember_me）
    token_expires_minutes = 43200 if request.remember_me else 1440  # 30天 or 1天（分钟）
    token = auth.create_access_token(
        data={
            "user_id": user_id,
            "email": email,
            "name": name,
            "role": role
        },
        expires_delta=timedelta(minutes=token_expires_minutes)
    )
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user_id,
        email=email,
        role=role
    )
