"""
数据库迁移执行脚本
执行 SQL 迁移文件
"""

import pyodbc
import sys
from pathlib import Path

# 添加项目根目录到路径
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config import settings

def run_migration(sql_file_path):
    """执行 SQL 迁移文件"""
    print(f"🔧 准备执行迁移: {sql_file_path}")
    
    # 读取 SQL 文件
    sql_content = Path(sql_file_path).read_text(encoding='utf-8')
    
    # 连接数据库
    connection_string = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_database};"
        f"UID={settings.db_username};"
        f"PWD={settings.db_password};"
        f"TrustServerCertificate=yes;"
    )
    
    try:
        conn = pyodbc.connect(connection_string, autocommit=True)
        cursor = conn.cursor()
        
        # 分割 SQL 语句（按 GO 分割）
        statements = [s.strip() for s in sql_content.split('GO') if s.strip()]
        
        print(f"📝 共 {len(statements)} 个 SQL 语句块")
        print("=" * 60)
        
        for i, statement in enumerate(statements, 1):
            if not statement:
                continue
                
            try:
                cursor.execute(statement)
                
                # 获取 PRINT 输出
                while cursor.nextset():
                    pass
                
                # 如果有消息，打印出来
                for message in cursor.messages:
                    print(message[1])
                    
            except Exception as e:
                print(f"❌ 语句块 {i} 执行失败: {e}")
                print(f"语句内容: {statement[:200]}...")
                raise
        
        print("=" * 60)
        print("✅ 迁移执行完成！")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 迁移执行失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python run_migration.py <migration.sql>")
        sys.exit(2)

    migration_file = Path(sys.argv[1])
    if not migration_file.is_absolute():
        migration_file = Path(__file__).parent / migration_file
    run_migration(migration_file)
