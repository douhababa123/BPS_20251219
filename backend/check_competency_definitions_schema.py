"""检查 competency_definitions 表结构"""
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
        WHERE c.object_id = OBJECT_ID('dbo.competency_definitions')
        ORDER BY c.column_id
    """)
    
    print("📋 competency_definitions 表结构:")
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
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
            OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = 'competency_definitions'
    """)
    fk_rows = cursor.fetchall()
    if fk_rows:
        for row in fk_rows:
            print(f"  {row[1]} -> {row[2]}.{row[3]}")
    else:
        print("  无外键")
    
    # 查看现有数据示例
    print("\n📊 现有数据示例:")
    cursor.execute("SELECT TOP 3 * FROM dbo.competency_definitions")
    rows = cursor.fetchall()
    if rows:
        cols = [desc[0] for desc in cursor.description]
        for row in rows:
            print(f"  {dict(zip(cols, row))}")
    else:
        print("  表为空")
