"""
执行数据库迁移：添加password_hash字段
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import Database

def migrate():
    """执行迁移"""
    db = Database()
    conn = db.connect()
    cursor = conn.cursor()
    
    try:
        # 检查并添加password_hash字段
        cursor.execute("""
            IF NOT EXISTS (
                SELECT 1 
                FROM sys.columns 
                WHERE object_id = OBJECT_ID('dbo.users') 
                AND name = 'password_hash'
            )
            BEGIN
                ALTER TABLE dbo.users
                ADD password_hash NVARCHAR(255) NULL;
                PRINT '✅ password_hash字段已添加';
            END
            ELSE
            BEGIN
                PRINT '⚠️ password_hash字段已存在';
            END
        """)
        conn.commit()
        print("✅ password_hash字段迁移完成")
        
        # 检查并添加last_login_at字段
        cursor.execute("""
            IF NOT EXISTS (
                SELECT 1 
                FROM sys.columns 
                WHERE object_id = OBJECT_ID('dbo.users') 
                AND name = 'last_login_at'
            )
            BEGIN
                ALTER TABLE dbo.users
                ADD last_login_at DATETIME NULL;
                PRINT '✅ last_login_at字段已添加';
            END
            ELSE
            BEGIN
                PRINT '⚠️ last_login_at字段已存在';
            END
        """)
        conn.commit()
        print("✅ last_login_at字段迁移完成")
        
        # 验证
        cursor.execute("""
            SELECT TOP 5 
                id, email, name, password_hash, last_login_at, created_at
            FROM dbo.users
        """)
        rows = cursor.fetchall()
        print(f"\n📋 用户表结构验证（前5条）：")
        for row in rows:
            print(f"  ID: {row[0]}, Email: {row[1]}, Name: {row[2]}, HasPassword: {row[3] is not None}")
        
        print("\n✅ 数据库迁移全部完成！")
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()
