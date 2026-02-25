"""查看 schedule_change_notifications 表的列结构"""
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

# 查询表的列信息
cursor.execute("""
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'schedule_change_notifications'
    ORDER BY ORDINAL_POSITION
""")

print("schedule_change_notifications table columns:")
print("=" * 70)
for row in cursor.fetchall():
    print(f"  {row[0]:<40} {row[1]}")

conn.close()
