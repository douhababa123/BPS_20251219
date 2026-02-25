"""检查数据库中的 OTP 记录"""
import pyodbc
from config import settings
from datetime import datetime

def check_otp_records():
    connection_string = (
        f"DRIVER={{{settings.db_driver}}};"
        f"SERVER={settings.db_server};"
        f"DATABASE={settings.db_database};"
        f"UID={settings.db_username};"
        f"PWD={settings.db_password};"
        f"TrustServerCertificate=yes;"
    )
    conn = pyodbc.connect(connection_string)
    cursor = conn.cursor()
    
    # 查询最近的 OTP 记录
    cursor.execute("""
        SELECT TOP 5 
            email, 
            otp, 
            created_at, 
            expires_at,
            CASE WHEN expires_at > GETDATE() THEN '有效' ELSE '已过期' END as status
        FROM otp_tokens 
        ORDER BY created_at DESC
    """)
    
    rows = cursor.fetchall()
    
    print("\n" + "="*80)
    print("📋 最近生成的 OTP 记录")
    print("="*80 + "\n")
    
    for i, row in enumerate(rows, 1):
        email, otp, created_at, expires_at, status = row
        print(f"记录 {i}:")
        print(f"  📧 邮箱: {email}")
        print(f"  🔢 OTP: {otp}")
        print(f"  🕐 创建时间: {created_at}")
        print(f"  ⏰ 过期时间: {expires_at}")
        print(f"  ✅ 状态: {status}")
        print("-" * 80)
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_otp_records()
