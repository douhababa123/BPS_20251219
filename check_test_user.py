import pyodbc
conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;DATABASE=DCCT_BPS_Debug;UID=TEST;PWD=123456'
)
cursor = conn.cursor()

# 查用户基本信息
cursor.execute(
    "SELECT id, email, role, is_active FROM users WHERE email = 'test@bosch.com'"
)
user = cursor.fetchone()
if not user:
    print("❌ users 表中未找到 test@bosch.com")
else:
    print(f"✅ 用户: id={user.id} | email={user.email} | role={user.role} | active={user.is_active}")

    # 查最新 OTP
    cursor.execute(
        "SELECT TOP 3 code, expires_at, used, created_at "
        "FROM otp_tokens WHERE user_id = ? ORDER BY created_at DESC",
        (user.id,)
    )
    otps = cursor.fetchall()
    if otps:
        print("\n最近的 OTP 记录:")
        for o in otps:
            print(f"  code={o.code} | expires={str(o.expires_at)[:19]} | used={o.used}")
    else:
        print("\n暂无 OTP 记录（需先调用 /api/auth/send-otp 触发发送）")

conn.close()
