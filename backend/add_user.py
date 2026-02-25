"""查询用户表并添加新用户"""
import pyodbc
from config import settings
from uuid import uuid4

# 连接数据库
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

print("\n" + "="*70)
print("📊 users 表结构")
print("="*70)

cursor.execute("""
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users'
    ORDER BY ORDINAL_POSITION
""")

for row in cursor.fetchall():
    nullable = "可空" if row[2] == 'YES' else "必填"
    max_len = f"({row[3]})" if row[3] else ""
    print(f"  {row[0]:<30} {row[1]:<20} {max_len:<10} {nullable}")

print("\n" + "="*70)
print("👥 现有用户")
print("="*70)

cursor.execute("SELECT id, email, created_at FROM users ORDER BY created_at DESC")
users = cursor.fetchall()

if users:
    for row in users:
        print(f"  ID: {row[0]}")
        print(f"  邮箱: {row[1]}")
        print(f"  创建时间: {row[2]}")
        print()
else:
    print("  暂无用户")

print("="*70)
print("➕ 添加新用户: liu.kui@bosch.com")
print("="*70)

# 检查用户是否已存在
cursor.execute("SELECT id FROM users WHERE email = ?", "liu.kui@bosch.com")
existing = cursor.fetchone()

if existing:
    print(f"⚠️  用户已存在: liu.kui@bosch.com (ID: {existing[0]})")
else:
    # 添加新用户
    new_id = str(uuid4())
    cursor.execute("""
        INSERT INTO users (id, email, name, email_confirmed, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 1, 1, GETDATE(), GETDATE())
    """, new_id, "liu.kui@bosch.com", "Liu Kui")
    
    conn.commit()
    print(f"✅ 成功添加用户: liu.kui@bosch.com")
    print(f"   用户ID: {new_id}")
    print(f"   姓名: Liu Kui")

print("\n" + "="*70)
print("📋 更新后的用户列表")
print("="*70)

cursor.execute("SELECT email FROM users ORDER BY created_at DESC")
for row in cursor.fetchall():
    print(f"  ✓ {row[0]}")

conn.close()
print("\n✅ 完成！\n")
