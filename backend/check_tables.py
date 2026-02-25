"""检查数据库表结构"""
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

# 查找所有包含 'otp' 的表
print("\n包含 'otp' 的表:")
cursor.execute("""
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME LIKE '%otp%'
    ORDER BY TABLE_NAME
""")
tables = cursor.fetchall()
for table in tables:
    print(f"  - {table[0]}")

# 如果找到了表，显示列信息
if tables:
    table_name = tables[0][0]
    print(f"\n{table_name} 表的列:")
    cursor.execute(f"""
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '{table_name}'
        ORDER BY ORDINAL_POSITION
    """)
    columns = cursor.fetchall()
    for col in columns:
        col_name, data_type, max_len = col
        length_info = f"({max_len})" if max_len else ""
        print(f"  - {col_name}: {data_type}{length_info}")

cursor.close()
conn.close()
