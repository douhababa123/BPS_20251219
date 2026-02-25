import pyodbc
import hashlib
import bcrypt

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;DATABASE=DCCT_BPS_Debug;UID=TEST;PWD=123456'
)
c = conn.cursor()

# 取 password_hash
c.execute("SELECT password_hash FROM users WHERE email = 'test@bosch.com'")
r = c.fetchone()
if not r or not r.password_hash:
    print("No password hash found")
    conn.close()
    exit()

stored_hash = r.password_hash
print(f"Stored hash: {stored_hash}")
print(f"Hash type  : {'bcrypt' if stored_hash.startswith('$2') else 'other'}")
print()

# 候选密码列表
candidates = [
    "Test1234", "test1234", "test123", "Test123",
    "Admin1234", "admin1234", "Bosch1234", "bosch1234",
    "123456", "12345678", "password", "Password1",
    "Test@123", "Bosch@123", "test@bosch", "Test@bosch"
]

print("=== 验证常见密码 ===")
found = False
for pwd in candidates:
    try:
        match = bcrypt.checkpw(pwd.encode(), stored_hash.encode())
        status = "✅ MATCH!" if match else "❌"
        print(f"  {pwd:20s} -> {status}")
        if match:
            found = True
            break
    except Exception as e:
        print(f"  {pwd:20s} -> Error: {e}")

if not found:
    print("\n未在候选列表中找到匹配密码")

conn.close()
