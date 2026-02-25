"""检查 tasks 表结构"""
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
        WHERE c.object_id = OBJECT_ID('dbo.tasks')
        ORDER BY c.column_id
    """)
    
    print("📋 tasks 表结构:")
    print("-" * 80)
    for row in cursor.fetchall():
        nullable = "NULL" if row[3] else "NOT NULL"
        identity = "(IDENTITY)" if row[4] else ""
        print(f"{row[0]:<25} {row[1]:<15} {nullable:<10} {identity}")
    
    # 查看外键
    print("\n🔗 外键关系:")
    cursor.execute("""
        SELECT 
            fk.name AS constraint_name,
            OBJECT_NAME(fk.parent_object_id) AS table_name,
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
            OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = 'tasks'
    """)
    for row in cursor.fetchall():
        print(f"  {row[2]} -> {row[3]}.{row[4]}")
    
    # 查看现有数据示例
    print("\n📊 现有数据示例:")
    cursor.execute("SELECT TOP 3 id, title, task_type_id, factory_id, is_active FROM dbo.tasks")
    for row in cursor.fetchall():
        print(f"  ID={row[0]}, title={row[1]}, type_id={row[2]}, factory_id={row[3]}, active={row[4]}")
