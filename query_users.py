import pyodbc

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;DATABASE=DCCT_BPS_Debug;UID=TEST;PWD=123456'
)
c = conn.cursor()

# 查询 test@bosch.com
c.execute(
    "SELECT id, email, name, role, is_active, password_hash "
    "FROM users WHERE email = 'test@bosch.com'"
)
r = c.fetchone()
if r:
    print('id       :', r.id)
    print('email    :', r.email)
    print('name     :', r.name)
    print('role     :', r.role)
    print('is_active:', r.is_active)
    print('has_pwd  :', 'Yes (password login available)' if r.password_hash else 'No (OTP only)')
else:
    print('NOT FOUND - test@bosch.com 不存在于 users 表')

# 列出所有账号供参考
print()
print('=== 所有用户账号 ===')
c.execute(
    "SELECT email, name, role, is_active, "
    "CASE WHEN password_hash IS NOT NULL THEN 'Yes' ELSE 'No' END AS has_password "
    "FROM users ORDER BY role DESC, email"
)
for row in c.fetchall():
    print(f'  {str(row.email):35s} | {str(row.name):20s} | role={row.role} | active={row.is_active} | pwd={row.has_password}')

conn.close()
