"""
检查 schedule_change_notifications 表结构
"""
from database import db

with db.get_cursor() as cursor:
    # 获取表结构
    cursor.execute("""
        SELECT 
            c.name AS column_name,
            t.name AS data_type,
            c.is_nullable,
            c.is_identity
        FROM sys.columns c
        JOIN sys.types t ON c.user_type_id = t.user_type_id
        WHERE c.object_id = OBJECT_ID('schedule_change_notifications')
        ORDER BY c.column_id
    """)
    
    print("schedule_change_notifications table structure:")
    print("-" * 80)
    for row in cursor.fetchall():
        nullable = "NULL" if row.is_nullable else "NOT NULL"
        identity = "  (IDENTITY)" if row.is_identity else ""
        print(f"{row.column_name:30} {row.data_type:15} {nullable:10}{identity}")
    
    # 获取外键关系
    print("\nForeign key relationships:")
    cursor.execute("""
        SELECT 
            fk.name AS fk_name,
            OBJECT_NAME(fkc.parent_object_id) AS table_name,
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
            OBJECT_NAME(fkc.referenced_object_id) AS referenced_table,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
        FROM sys.foreign_key_columns fkc
        JOIN sys.foreign_keys fk ON fkc.constraint_object_id = fk.object_id
        WHERE fkc.parent_object_id = OBJECT_ID('schedule_change_notifications')
    """)
    
    fk_rows = cursor.fetchall()
    if fk_rows:
        for row in fk_rows:
            print(f"  {row.column_name} -> {row.referenced_table}.{row.referenced_column}")
    else:
        print("  No foreign keys")
    
    # 获取示例数据
    print("\nSample data (top 3 rows):")
    cursor.execute("SELECT TOP 3 * FROM schedule_change_notifications")
    rows = cursor.fetchall()
    for row in rows:
        # 转换为字典显示
        columns = [column[0] for column in cursor.description]
        row_dict = dict(zip(columns, row))
        print(f"  {row_dict}")
