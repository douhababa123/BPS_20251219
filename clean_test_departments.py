import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;DATABASE=DCCT_BPS_Debug;UID=TEST;PWD=123456'
)
c = conn.cursor()

# 真实部门 id <= 15（1-15 是业务数据，16+ 是测试数据）
c.execute('SELECT COUNT(*) FROM departments WHERE id >= 16')
cnt = c.fetchone()[0]
print(f'待删除测试部门数: {cnt}')

c.execute('DELETE FROM departments WHERE id >= 16')
conn.commit()
print(f'已删除 {c.rowcount} 条测试部门')

c.execute('SELECT COUNT(*) FROM departments')
print(f'剩余部门数: {c.fetchone()[0]}')

conn.close()
