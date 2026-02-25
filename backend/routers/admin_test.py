"""
管理员权限测试路由
"""

from fastapi import APIRouter, Depends
from typing import Dict
from auth import get_current_user, verify_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/test")
def test_admin_access(current_user: Dict = Depends(verify_admin)):
    """
    测试管理员权限
    只有 admin 角色可以访问此端点
    """
    return {
        "message": "✅ 管理员权限验证成功",
        "user_info": {
            "user_id": current_user.get("user_id"),
            "email": current_user.get("email"),
            "name": current_user.get("name"),
            "role": current_user.get("role")
        },
        "access_level": "admin",
        "description": "您拥有管理员权限，可以访问所有管理功能"
    }


@router.get("/user-info")
def get_user_info(current_user: Dict = Depends(get_current_user)):
    """
    获取当前用户信息
    任何登录用户都可以访问
    """
    return {
        "message": "✅ 用户身份验证成功",
        "user_info": current_user,
        "description": "您已登录，但这个端点不需要管理员权限"
    }
