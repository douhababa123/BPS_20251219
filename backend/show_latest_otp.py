"""显示最新的OTP验证码"""
from database import Database
from datetime import datetime

db = Database()
cursor = db.connect().cursor()

# 查询最新的验证码
cursor.execute("""
    SELECT TOP 5 
        email, 
        token, 
        created_at, 
        expires_at
    FROM otp_tokens 
    ORDER BY created_at DESC
""")

rows = cursor.fetchall()

print("\n" + "="*80)
print("📱 最新生成的验证码")
print("="*80 + "\n")

if not rows:
    print("❌ 没有找到验证码记录")
else:
    for i, row in enumerate(rows, 1):
        email, token, created_at, expires_at = row
        now = datetime.now()
        is_valid = expires_at > now if expires_at else False
        
        print(f"记录 {i}:")
        print(f"  📧 邮箱: {email}")
        print(f"  🔢 验证码: {token}")
        print(f"  🕐 创建时间: {created_at}")
        print(f"  ⏰ 过期时间: {expires_at}")
        print(f"  ✅ 状态: {'✅ 有效' if is_valid else '❌ 已过期'}")
        print("-" * 80)

cursor.close()
