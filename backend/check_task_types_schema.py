"""检查 task_types 表结构"""
from database import db

with db.get_cursor() as cursor:
    # 查看表结构
    cursor.execute("""
        SELECT 
            c.name AS column_name,
            t.name AS data_type,
            c.max_length,
            c.is_nullable,
            c.is_identity
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        WHERE c.object_id = OBJECT_ID('dbo.task_types')
        ORDER BY c.column_id
    """)
    
    print("📋 task_types 表结构:")
    print("-" * 80)
    for row in cursor.fetchall():
        nullable = "NULL" if row[3] else "NOT NULL"
        identity = "(IDENTITY)" if row[4] else ""
        print(f"{row[0]:<20} {row[1]:<15} {nullable:<10} {identity}")
    
    # 查看现有数据
    print("\n📊 现有数据示例:")
    print("-" * 80)
    cursor.execute("SELECT TOP 3 id, code, name, color_hex, is_active FROM dbo.task_types")
    for row in cursor.fetchall():
        print(f"ID={row[0]}, code={row[1]}, name={row[2]}, color={row[3]}, active={row[4]}")
