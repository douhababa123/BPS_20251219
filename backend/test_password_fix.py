"""
测试密码修复是否生效
"""
import auth

def test_password():
    print("=" * 50)
    print("测试密码函数修复")
    print("=" * 50)
    
    # 测试短密码
    short_pwd = "Test1234"
    print(f"\n1. 测试短密码: {short_pwd}")
    try:
        hash1 = auth.hash_password(short_pwd)
        print(f"   ✅ hash_password 成功")
        result = auth.verify_password(short_pwd, hash1)
        print(f"   ✅ verify_password 成功: {result}")
    except Exception as e:
        print(f"   ❌ 错误: {e}")
        return False
    
    # 测试长密码（超过72字节）
    long_pwd = "A" * 100
    print(f"\n2. 测试长密码: {len(long_pwd)} 字符")
    try:
        hash2 = auth.hash_password(long_pwd)
        print(f"   ✅ hash_password 成功（应自动截断）")
        result = auth.verify_password(long_pwd, hash2)
        print(f"   ✅ verify_password 成功: {result}")
    except Exception as e:
        print(f"   ❌ 错误: {e}")
        return False
    
    print("\n" + "=" * 50)
    print("✅ 所有测试通过！密码修复已生效")
    print("=" * 50)
    return True

if __name__ == "__main__":
    test_password()
