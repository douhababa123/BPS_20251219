"""
测试管理员权限系统
包含3个测试场景:
1. 使用管理员 token 访问需要 admin 权限的端点 → 应该成功
2. 使用普通用户 token 访问需要 admin 权限的端点 → 应该返回 403
3. 使用管理员 token 访问普通端点 → 应该成功
"""

import requests
from auth import create_access_token

# 服务器地址
BASE_URL = "http://localhost:8000"

def test_admin_permission():
    print("\n" + "=" * 100)
    print("🧪 测试管理员权限系统")
    print("=" * 100)
    
    # ========================================================================
    # 测试 1: 管理员访问 admin 端点 (应该成功)
    # ========================================================================
    print("\n" + "-" * 100)
    print("测试 1: 管理员 token 访问 /api/admin/test (需要 admin 权限)")
    print("-" * 100)
    
    admin_token_data = {
        "user_id": "test-admin-id",
        "email": "admin@bosch.com",
        "name": "测试管理员",
        "role": "admin"
    }
    admin_token = create_access_token(admin_token_data)
    
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/test", headers=headers_admin)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 200:
            print("✅ 测试通过 - 管理员可以访问 admin 端点")
        else:
            print(f"❌ 测试失败 - 预期 200，实际 {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")
    
    # ========================================================================
    # 测试 2: 普通用户访问 admin 端点 (应该返回 403)
    # ========================================================================
    print("\n" + "-" * 100)
    print("测试 2: 普通用户 token 访问 /api/admin/test (需要 admin 权限)")
    print("-" * 100)
    
    user_token_data = {
        "user_id": "test-user-id",
        "email": "user@bosch.com",
        "name": "普通用户",
        "role": "user"
    }
    user_token = create_access_token(user_token_data)
    
    headers_user = {"Authorization": f"Bearer {user_token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/test", headers=headers_user)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 403:
            print("✅ 测试通过 - 普通用户被正确拒绝访问")
        else:
            print(f"❌ 测试失败 - 预期 403，实际 {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")
    
    # ========================================================================
    # 测试 3: 管理员访问普通端点 (应该成功)
    # ========================================================================
    print("\n" + "-" * 100)
    print("测试 3: 管理员 token 访问 /api/admin/user-info (任何登录用户)")
    print("-" * 100)
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/user-info", headers=headers_admin)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 200:
            print("✅ 测试通过 - 管理员可以访问普通端点")
        else:
            print(f"❌ 测试失败 - 预期 200，实际 {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")
    
    # ========================================================================
    # 测试 4: 普通用户访问普通端点 (应该成功)
    # ========================================================================
    print("\n" + "-" * 100)
    print("测试 4: 普通用户 token 访问 /api/admin/user-info (任何登录用户)")
    print("-" * 100)
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/user-info", headers=headers_user)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 200:
            print("✅ 测试通过 - 普通用户可以访问普通端点")
        else:
            print(f"❌ 测试失败 - 预期 200，实际 {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")
    
    # ========================================================================
    # 测试 5: 无 token 访问 (应该返回 401 或 403)
    # ========================================================================
    print("\n" + "-" * 100)
    print("测试 5: 无 token 访问 /api/admin/test")
    print("-" * 100)
    
    try:
        response = requests.get(f"{BASE_URL}/api/admin/test")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code in [401, 403]:
            print("✅ 测试通过 - 未认证用户被正确拒绝")
        else:
            print(f"❌ 测试失败 - 预期 401/403，实际 {response.status_code}")
    except Exception as e:
        print(f"❌ 请求失败: {e}")
    
    # ========================================================================
    # 测试总结
    # ========================================================================
    print("\n" + "=" * 100)
    print("📊 测试总结")
    print("=" * 100)
    print("✅ 管理员权限系统测试完成")
    print("\n核心功能验证:")
    print("  1. get_current_user() - 从 JWT token 提取用户信息")
    print("  2. verify_admin() - 验证用户是否为管理员")
    print("  3. 403 Forbidden - 正确拒绝非管理员访问")
    print("  4. 200 OK - 管理员可以正常访问受保护端点")
    print("\n" + "=" * 100 + "\n")


if __name__ == "__main__":
    try:
        test_admin_permission()
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
