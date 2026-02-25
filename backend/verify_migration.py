"""验证 role 字段是否添加成功"""
import sys
from pathlib import Path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database import db

print("🔍 验证 users 表的 role 字段...")
print("=" * 60)

with db.get_cursor() as cursor:
    # 查询字段信息
    cursor.execute("""
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, 
               IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'role'
    """)
    
    result = cursor.fetchone()
    
    if result:
        print(f"✅ role 字段已存在")
        print(f"   字段名: {result[0]}")
        print(f"   类型: {result[1]}")
        print(f"   最大长度: {result[2]}")
        print(f"   允许NULL: {result[3]}")
        print(f"   默认值: {result[4]}")
        
        # 查询当前用户的 role 分布
        cursor.execute("""
            SELECT role, COUNT(*) as count
            FROM dbo.users
            GROUP BY role
        """)
        
        print("\n📊 当前用户 role 分布:")
        for row in cursor.fetchall():
            print(f"   {row[0]}: {row[1]} 人")
            
        print("\n✅ 数据库迁移验证通过！")
    else:
        print("❌ role 字段不存在，迁移失败")
        sys.exit(1)
