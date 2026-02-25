"""
数据库连接模块
使用 pyodbc 连接 SQL Server
"""

import pyodbc
from typing import Optional
from contextlib import contextmanager
import logging
from config import settings

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Database:
    """SQL Server 数据库连接管理类"""
    
    def __init__(self):
        self.connection_string = (
            f"DRIVER={{{settings.db_driver}}};"
            f"SERVER={settings.db_server};"
            f"DATABASE={settings.db_database};"
            f"UID={settings.db_username};"
            f"PWD={settings.db_password};"
            f"TrustServerCertificate=yes;"
        )
        self._connection: Optional[pyodbc.Connection] = None
    
    def connect(self) -> pyodbc.Connection:
        """创建数据库连接"""
        try:
            self._connection = pyodbc.connect(
                self.connection_string,
                timeout=30,
                autocommit=False
            )
            logger.info("✅ 数据库连接成功")
            return self._connection
        except Exception as e:
            logger.error(f"❌ 数据库连接失败: {e}")
            raise
    
    def close(self):
        """关闭数据库连接"""
        if self._connection:
            self._connection.close()
            logger.info("数据库连接已关闭")
            self._connection = None
    
    @contextmanager
    def get_cursor(self):
        """获取数据库游标（上下文管理器）
        
        为每个请求创建独立连接，避免 pyodbc 线程安全问题
        """
        connection = None
        cursor = None
        try:
            # 为每个请求创建新的连接（pyodbc 不是线程安全的）
            connection = pyodbc.connect(
                self.connection_string,
                timeout=30,
                autocommit=False
            )
            
            cursor = connection.cursor()
            yield cursor
            connection.commit()
        except Exception as e:
            if connection:
                connection.rollback()
            logger.error(f"数据库操作失败: {e}")
            raise
        finally:
            if cursor:
                try:
                    cursor.close()
                except Exception:
                    pass
            if connection:
                try:
                    connection.close()
                except Exception:
                    pass


# 创建全局数据库实例
db = Database()


def get_db():
    """FastAPI 依赖注入：获取数据库游标"""
    with db.get_cursor() as cursor:
        yield cursor


# 测试连接函数
def test_connection():
    """测试数据库连接"""
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT @@VERSION")
            version = cursor.fetchone()[0]
            logger.info(f"SQL Server 版本: {version[:50]}...")
            
            # 查询所有表
            cursor.execute("""
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE = 'BASE TABLE'
                ORDER BY TABLE_NAME
            """)
            tables = [row[0] for row in cursor.fetchall()]
            logger.info(f"数据库表 ({len(tables)} 个): {', '.join(tables)}")
            
            return True
    except Exception as e:
        logger.error(f"连接测试失败: {e}")
        return False


if __name__ == "__main__":
    # 运行测试
    print("=" * 60)
    print("测试 SQL Server 连接...")
    print("=" * 60)
    test_connection()
