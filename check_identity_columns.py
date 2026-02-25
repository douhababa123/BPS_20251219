import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;'
    'DATABASE=DCCT_BPS_Debug;'
    'UID=TEST;'
    'PWD=123456'
)

cursor = conn.cursor()

# 查询所有有 IDENTITY 列的表
query = """
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE COLUMNPROPERTY(OBJECT_ID('dbo.' + TABLE_NAME), COLUMN_NAME, 'IsIdentity') = 1
    ORDER BY TABLE_NAME
"""

cursor.execute(query)

print("\n表中的 IDENTITY 列:")
print("-" * 50)
for row in cursor.fetchall():
    print(f"  {row[0]}.{row[1]}")

conn.close()
