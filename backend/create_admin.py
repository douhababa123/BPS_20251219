"""
快速创建管理员账户
"""

from database import db
from auth import create_access_token, hash_password

def main():
    print("\n" + "=" * 100)
    print("📋 Step 1: 查看现有用户")
    print("=" * 100)
    
    with db.get_cursor() as cursor:
        # 查看现有用户
        cursor.execute("""
            SELECT id, email, name, role, is_active
            FROM dbo.users
            ORDER BY created_at DESC
        """)
        users = cursor.fetchall()
        
        if users:
            print("\n现有用户:")
            for i, user in enumerate(users, 1):
                role_icon = "👑" if user[3] == 'admin' else "👤"
                print(f"{i}. {role_icon} {user[2]} - {user[1]} (角色: {user[3]})")
        else:
            print("\n⚠️  数据库中没有用户")
        
        print("\n" + "=" * 100)
        print("📝 Step 2: 创建测试管理员账户")
        print("=" * 100)
        
        # 测试管理员账户信息
        admin_email = "admin@bosch.com"
        admin_password = "Admin1234"
        admin_name = "测试管理员"
        
        # 检查是否已存在
        cursor.execute("SELECT id, role FROM dbo.users WHERE email = ?", (admin_email,))
        existing = cursor.fetchone()
        
        if existing:
            user_id, current_role = existing
            if current_role == 'admin':
                print(f"\n✅ 管理员账户已存在: {admin_email}")
            else:
                # 升级为管理员
                cursor.execute("""
                    UPDATE dbo.users 
                    SET role = 'admin', updated_at = GETDATE()
                    WHERE email = ?
                """, (admin_email,))
                print(f"\n✅ 已将 {admin_email} 升级为管理员")
        else:
            # 创建新管理员
            hashed_password = hash_password(admin_password)
            cursor.execute("""
                INSERT INTO dbo.users (email, password_hash, name, role, is_active)
                VALUES (?, ?, ?, 'admin', 1)
            """, (admin_email, hashed_password, admin_name))
            print(f"\n✅ 成功创建管理员账户")
        
        print("\n" + "=" * 100)
        print("🔑 管理员账户信息")
        print("=" * 100)
        print(f"邮箱: {admin_email}")
        print(f"密码: {admin_password}")
        print(f"姓名: {admin_name}")
        print(f"角色: admin")
        
        # 生成测试 Token
        print("\n" + "=" * 100)
        print("🎫 Step 3: 生成测试 JWT Token")
        print("=" * 100)
        
        cursor.execute("""
            SELECT id, email, name, role 
            FROM dbo.users 
            WHERE email = ?
        """, (admin_email,))
        admin = cursor.fetchone()
        
        token_data = {
            "user_id": str(admin[0]),
            "email": admin[1],
            "name": admin[2],
            "role": admin[3]
        }
        token = create_access_token(token_data)
        
        print(f"\n✅ Token 已生成 (有效期: 24小时)")
        print("\n" + "-" * 100)
        print(token)
        print("-" * 100)
        
        # 测试说明
        print("\n" + "=" * 100)
        print("📝 测试步骤")
        print("=" * 100)
        print("\n方法 1: 使用 PowerShell 测试 (推荐)")
        print("-" * 100)
        print('# 1. 设置 Token')
        print(f'$token = "{token}"')
        print('\n# 2. 创建请求头')
        print('$headers = @{"Authorization" = "Bearer $token"}')
        print('\n# 3. 测试需要 admin 权限的接口 (假设有 /api/admin/users 端点)')
        print('Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users" -Headers $headers')
        
        print("\n方法 2: 使用前端登录")
        print("-" * 100)
        print("1. 访问: http://localhost:5173/login")
        print(f"2. 邮箱: {admin_email}")
        print(f"3. 密码: {admin_password}")
        print("4. 登录后查看浏览器 localStorage 中的 token")
        
        print("\n方法 3: 验证 Token 内容")
        print("-" * 100)
        print("在 Python 中解码 Token:")
        print("from auth import verify_token")
        print(f'payload = verify_token("{token[:50]}...")')
        print("print(payload)  # 应该包含 role='admin'")
        
        print("\n" + "=" * 100)
        print("✅ 管理员账户设置完成")
        print("=" * 100 + "\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
