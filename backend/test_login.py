"""
测试登录流程
演示如何使用 chao.dong@bshg.com 登录
"""
import requests
import time

BASE_URL = "http://localhost:8000/api"

print("\n" + "="*70)
print("🔐 BPS 登录测试")
print("="*70)

# 测试邮箱
email = "chao.dong@bshg.com"

# 步骤1：请求发送OTP
print(f"\n📧 步骤1: 请求发送验证码到 {email}")
print("-" * 70)

try:
    response = requests.post(
        f"{BASE_URL}/auth/signup-otp",
        json={"email": email}
    )
    
    if response.status_code == 200:
        print("✅ 验证码请求成功！")
        data = response.json()
        print(f"   消息: {data.get('message')}")
        print(f"   详情: {data.get('detail')}")
    else:
        print(f"❌ 请求失败: {response.status_code}")
        print(f"   错误: {response.json()}")
        exit(1)
        
except Exception as e:
    print(f"❌ 连接失败: {e}")
    print("   请确保后端服务正在运行 (http://localhost:8000)")
    exit(1)

# 步骤2：从文件读取验证码
print(f"\n🔑 步骤2: 读取验证码")
print("-" * 70)

time.sleep(1)  # 等待验证码写入文件

try:
    with open("CURRENT_OTP.txt", "r", encoding="utf-8") as f:
        content = f.read()
        # 提取验证码（查找"验证码: XXXXXX"）
        for line in content.split('\n'):
            if '验证码:' in line:
                otp = line.split(':')[1].strip()
                print(f"✅ 获取到验证码: {otp}")
                break
        else:
            print("❌ 未找到验证码")
            exit(1)
except FileNotFoundError:
    print("❌ CURRENT_OTP.txt 文件不存在")
    print("   提示：请先运行 'python get_otp.py' 或在前端请求验证码")
    exit(1)

# 步骤3：验证OTP并登录
print(f"\n✅ 步骤3: 验证OTP并获取Token")
print("-" * 70)

response = requests.post(
    f"{BASE_URL}/auth/verify-otp",
    json={
        "email": email,
        "otp": otp
    }
)

if response.status_code == 200:
    print("🎉 登录成功！")
    data = response.json()
    
    token = data.get('access_token')
    token_type = data.get('token_type', 'Bearer')
    user = data.get('user', {})
    
    print(f"\n📋 用户信息:")
    print(f"   邮箱: {user.get('email')}")
    print(f"   姓名: {user.get('name')}")
    print(f"   用户ID: {user.get('id')}")
    
    print(f"\n🎫 Token信息:")
    print(f"   类型: {token_type}")
    print(f"   Token: {token[:50]}..." if len(token) > 50 else f"   Token: {token}")
    print(f"   有效期: 7天")
    
    # 步骤4：测试使用Token访问受保护的API
    print(f"\n🔐 步骤4: 测试Token访问受保护API")
    print("-" * 70)
    
    headers = {
        "Authorization": f"{token_type} {token}"
    }
    
    # 测试获取当前用户信息
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    
    if response.status_code == 200:
        print("✅ Token验证成功！可以访问受保护的API")
        me_data = response.json()
        print(f"   当前登录用户: {me_data.get('email')}")
    else:
        print(f"⚠️  Token验证失败: {response.status_code}")
    
    # 保存Token到文件（模拟前端localStorage）
    print(f"\n💾 步骤5: 保存Token（模拟前端存储）")
    print("-" * 70)
    
    with open("SAVED_TOKEN.txt", "w", encoding="utf-8") as f:
        f.write(f"Token Type: {token_type}\n")
        f.write(f"Access Token: {token}\n")
        f.write(f"User Email: {user.get('email')}\n")
        f.write(f"User Name: {user.get('name')}\n")
        f.write(f"Valid for: 7 days\n")
    
    print("✅ Token已保存到 SAVED_TOKEN.txt")
    print("   在真实应用中，前端会将Token保存到 localStorage")
    print("   下次访问时自动使用该Token，无需重新登录")
    
else:
    print(f"❌ 登录失败: {response.status_code}")
    print(f"   错误: {response.json()}")
    exit(1)

print("\n" + "="*70)
print("✅ 测试完成！")
print("="*70)
print("\n💡 提示:")
print("   1. Token有效期已延长至7天")
print("   2. 前端应将Token保存到localStorage")
print("   3. 每次API请求带上 Authorization: Bearer {token}")
print("   4. 7天内无需重新登录\n")
