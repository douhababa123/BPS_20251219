"""
快速查看当前内存中的OTP验证码
用于开发测试
"""
import sys
sys.path.insert(0, '.')

from auth import otp_storage
from datetime import datetime

print("\n" + "="*80)
print("📱 当前内存中的验证码（仅后端重启前有效）")
print("="*80 + "\n")

if not otp_storage:
    print("❌ 没有找到验证码（内存中为空）")
    print("\n请使用以下命令生成验证码：")
    print("  python get_otp.py your.email@bosch.com")
else:
    for email, data in otp_storage.items():
        now = datetime.utcnow()
        is_valid = data['expire_time'] > now
        
        print(f"📧 邮箱: {email}")
        print(f"🔢 验证码: {data['otp']}")
        print(f"🕐 创建时间: {data['created_at']}")
        print(f"⏰ 过期时间: {data['expire_time']}")
        print(f"✅ 状态: {'✅ 有效' if is_valid else '❌ 已过期'}")
        print("-" * 80)

print("\n💡 提示：这些验证码存储在内存中，后端重启后会丢失")
print("如需持久化，请使用数据库存储\n")
