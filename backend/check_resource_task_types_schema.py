import pyodbc
from config import settings

conn_str = (
    f"DRIVER={{{settings.db_driver}}};"
    f"SERVER={settings.db_server};"
    f"DATABASE={settings.db_database};"
    f"UID={settings.db_username};"
    f"PWD={settings.db_password};"
    f"TrustServerCertificate=yes;"
)

conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

print("resource_task_types table structure:")
print("-" * 80)

# 获取列信息
cursor.execute("""
    SELECT 
        c.name AS column_name,
        t.name AS data_type,
        c.max_length,
        c.is_nullable,
        c.is_identity
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('resource_task_types')
    ORDER BY c.column_id
""")

for row in cursor.fetchall():
    nullable = "NULL" if row.is_nullable else "NOT NULL"
    identity = " (IDENTITY)" if row.is_identity else ""
    print(f"{row.column_name:30} {row.data_type:15} {nullable:10} {identity}")

# 检查外键
print("\nForeign key relationships:")
cursor.execute("""
    SELECT 
        fk.name AS fk_name,
        OBJECT_NAME(fk.parent_object_id) AS table_name,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS column_name,
        OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS referenced_column
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fc ON fk.object_id = fc.constraint_object_id
    WHERE fk.parent_object_id = OBJECT_ID('resource_task_types')
""")

fks = cursor.fetchall()
if fks:
    for row in fks:
        print(f"  {row.column_name} -> {row.referenced_table}.{row.referenced_column}")
else:
    print("  No foreign keys")

# 查看示例数据
print("\nSample data (top 3 rows):")
cursor.execute("SELECT TOP 3 * FROM resource_task_types")
rows = cursor.fetchall()
if rows:
    for row in rows:
        print(f"  {dict(zip([col[0] for col in cursor.description], row))}")
else:
    print("  No data")

cursor.close()
conn.close()
