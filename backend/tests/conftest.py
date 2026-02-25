"""
pytest配置文件
"""
import pytest
import pyodbc
from typing import Generator
import sys
import os

# 添加backend目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import settings


@pytest.fixture(scope="session")
def db_connection() -> Generator:
    """创建数据库连接的fixture（会话级别）"""
    connection_string = (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_database};"
        f"UID={settings.db_username};"
        f"PWD={settings.db_password};"
        f"TrustServerCertificate=yes;"
    )
    
    conn = pyodbc.connect(connection_string)
    yield conn
    conn.close()


@pytest.fixture(scope="function")
def db_cursor(db_connection):
    """创建数据库游标的fixture（函数级别，每个测试函数都有新游标）"""
    cursor = db_connection.cursor()
    yield cursor
    # 测试后回滚任何更改
    db_connection.rollback()
    cursor.close()


@pytest.fixture(scope="session")
def api_base_url():
    """API基础URL"""
    return "http://localhost:8000/api"


@pytest.fixture(scope="session")
def test_user_credentials():
    """测试用户凭证"""
    return {
        "email": "liu.kui@bosch.com",
        "password": "test_password"  # 根据实际情况调整
    }
