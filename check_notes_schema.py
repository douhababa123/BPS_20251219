import sys
sys.path.append('backend')
from database import Database

db = Database()
conn = db.connect()
cursor = conn.cursor()

cursor.execute("""
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, COLLATION_NAME
    FROM INFORMATION_SCHEMA.COLUMNS  
    WHERE TABLE_NAME='tasks' AND COLUMN_NAME='notes'
""")

row = cursor.fetchone()
print(f"字段: {row[0]}")
print(f"类型: {row[1]}")
print(f"长度: {row[2]}")
print(f"排序规则: {row[3]}")

cursor.close()
conn.close()
