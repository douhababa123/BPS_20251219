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

# 检查 gap 列是否为计算列
cursor.execute("""
    SELECT c.name, c.is_computed, cc.definition
    FROM sys.columns c
    LEFT JOIN sys.computed_columns cc ON c.object_id = cc.object_id AND c.column_id = cc.column_id
    WHERE c.object_id = OBJECT_ID('competency_assessments')
    AND c.name = 'gap'
""")

row = cursor.fetchone()
if row:
    print(f"Column: {row[0]}")
    print(f"Is Computed: {row[1]}")
    print(f"Definition: {row[2]}")

cursor.close()
conn.close()
