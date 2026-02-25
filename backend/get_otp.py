"""
快速获取 OTP 验证码的脚本
用于测试和开发
"""
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from auth import generate_otp, store_otp

def get_otp_for_email(email: str):
    """为指定邮箱生成并显示 OTP"""
    otp = generate_otp()
    store_otp(email, otp)
    
    print("\n" + "="*50)
    print("🔑 OTP 验证码已生成")
    print("="*50)
    print(f"\n📧 邮箱: {email}")
    print(f"🔢 验证码: {otp}")
    print(f"⏱️  有效期: 5 分钟")
    print("\n" + "="*50)
    print("\n使用方法：")
    print(f"1. 在浏览器中访问: http://localhost:5173")
    print(f"2. 输入邮箱: {email}")
    print(f"3. 点击 '获取验证码'（或直接使用此验证码）")
    print(f"4. 输入验证码: {otp}")
    print(f"5. 点击 '登录'")
    print("\n")

if __name__ == "__main__":
    # 使用数据库中存在的用户邮箱
    email = "liu.kui@bosch.com"
    
    if len(sys.argv) > 1:
        email = sys.argv[1]
    
    get_otp_for_email(email)
