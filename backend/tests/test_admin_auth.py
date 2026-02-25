"""
测试管理员权限验证
TDD - 测试驱动开发
"""

import pytest
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import pyodbc
from fastapi import HTTPException
from auth import verify_admin, get_current_user
from database import db

# 测试数据
TEST_ADMIN_USER = {
    "user_id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "admin@bosch.com",
    "name": "Admin User",
    "role": "admin"
}

TEST_NORMAL_USER = {
    "user_id": "123e4567-e89b-12d3-a456-426614174002",
    "email": "user@bosch.com",
    "name": "Normal User",
    "role": "user"
}


class TestAdminAuth:
    """管理员权限验证测试"""
    
    def test_verify_admin_with_admin_user(self):
        """测试：管理员用户应该通过验证"""
        # Arrange
        current_user = TEST_ADMIN_USER
        
        # Act
        result = verify_admin(current_user)
        
        # Assert
        assert result == TEST_ADMIN_USER
        assert result["role"] == "admin"
    
    def test_verify_admin_with_normal_user(self):
        """测试：普通用户应该被拒绝"""
        # Arrange
        current_user = TEST_NORMAL_USER
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            verify_admin(current_user)
        
        assert exc_info.value.status_code == 403
        assert "需要管理员权限" in exc_info.value.detail
    
    def test_verify_admin_with_no_role(self):
        """测试：没有 role 字段的用户应该被拒绝"""
        # Arrange
        current_user = {
            "user_id": "123e4567-e89b-12d3-a456-426614174003",
            "email": "old@bosch.com",
            "name": "Old User"
            # 没有 role 字段（旧用户数据）
        }
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            verify_admin(current_user)
        
        assert exc_info.value.status_code == 403


class TestUsersTableRole:
    """测试 users 表的 role 字段"""
    
    def test_users_table_has_role_column(self):
        """测试：users 表应该有 role 字段"""
        # Arrange & Act
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
            """)
            role_column = cursor.fetchone()
        
        # Assert
        assert role_column is not None, "users 表应该有 role 字段"
        assert role_column[1] == "nvarchar", "role 字段类型应该是 nvarchar"
        # role 字段是 NOT NULL 但有默认值 'user'，因此 IS_NULLABLE 为 'NO'
        assert role_column[2] == "NO", "role 字段不允许 NULL（有默认值）"
        assert "user" in str(role_column[3]).lower(), "role 字段默认值应该是 'user'"
    
    def test_default_role_is_user(self):
        """测试：新用户的默认 role 应该是 'user'"""
        # Arrange
        test_email = f"test_{pytest.timestamp}@bosch.com"
        
        # Act
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.users (email, name)
                VALUES (?, ?)
            """, (test_email, "Test User"))
            
            cursor.execute("""
                SELECT role FROM dbo.users WHERE email = ?
            """, (test_email,))
            result = cursor.fetchone()
        
        # Assert
        assert result is not None
        assert result[0] == "user", "默认 role 应该是 'user'"
        
        # Cleanup
        with db.get_cursor() as cursor:
            cursor.execute("DELETE FROM dbo.users WHERE email = ?", (test_email,))
    
    def test_can_set_admin_role(self):
        """测试：可以手动设置用户为 admin"""
        # Arrange
        test_email = f"admin_test_{pytest.timestamp}@bosch.com"
        
        # Act
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.users (email, name, role)
                VALUES (?, ?, ?)
            """, (test_email, "Admin Test", "admin"))
            
            cursor.execute("""
                SELECT role FROM dbo.users WHERE email = ?
            """, (test_email,))
            result = cursor.fetchone()
        
        # Assert
        assert result is not None
        assert result[0] == "admin", "应该可以设置 role 为 'admin'"
        
        # Cleanup
        with db.get_cursor() as cursor:
            cursor.execute("DELETE FROM dbo.users WHERE email = ?", (test_email,))


class TestUserModelWithRole:
    """测试 User 模型包含 role 字段"""
    
    def test_user_response_model_has_role(self):
        """测试：UserResponse 模型应该包含 role 字段"""
        from models import UserResponse
        from uuid import uuid4
        from datetime import datetime
        
        # Arrange & Act
        user = UserResponse(
            id=uuid4(),
            email="test@bosch.com",
            name="Test User",
            role="admin",  # 应该接受 role 字段
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Assert
        assert user.role == "admin"
        assert user.role in ["admin", "user"]


# pytest 配置
@pytest.fixture(scope="session", autouse=True)
def setup_test_timestamp():
    """为每个测试会话生成唯一时间戳"""
    import time
    pytest.timestamp = int(time.time())


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
