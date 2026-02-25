"""检查能力定义表中的NULL值"""
import pyodbc
from config import settings

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

# 检查有多少行的description为NULL或空
cursor.execute("""
    SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN description IS NULL THEN 1 ELSE 0 END) as null_desc,
        SUM(CASE WHEN description = '' THEN 1 ELSE 0 END) as empty_desc,
        SUM(CASE WHEN owner_engineer IS NULL THEN 1 ELSE 0 END) as null_owner
    FROM dbo.competency_definitions
""")

row = cursor.fetchone()
print(f"总记录数: {row[0]}")
print(f"description为NULL: {row[1]}")
print(f"description为空字符串: {row[2]}")
print(f"owner_engineer为NULL: {row[3]}")

# 显示前5条有NULL description的记录
print("\n前5条description为NULL的记录:")
cursor.execute("""
    SELECT TOP 5 id, module_name, competency_type, competency_code, description, owner_engineer
    FROM dbo.competency_definitions
    WHERE description IS NULL OR description = ''
""")

for row in cursor.fetchall():
    print(f"  ID={row[0]}, module={row[1]}, type={row[2]}, code={row[3]}, desc='{row[4]}', owner='{row[5]}'")

conn.close()
