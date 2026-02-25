"""
测试管理员账户设置脚本
功能：
1. 查看当前用户列表
2. 将指定用户设置为管理员
3. 生成测试 JWT token
"""

from database import get_cursor
from auth import create_access_token, hash_password
import sys

def list_users():
    """列出所有用户"""
    cursor = get_cursor()
    try:
        cursor.execute("""
            SELECT id, email, name, role, is_active, created_at
            FROM dbo.users
            ORDER BY created_at DESC
        """)
        users = cursor.fetchall()
        
        print("\n" + "=" * 100)
        print("📋 当前用户列表")
        print("=" * 100)
        
        if not users:
            print("⚠️  数据库中没有用户")
            return []
        
        for i, user in enumerate(users, 1):
            role_icon = "👑" if user[3] == 'admin' else "👤"
            active_icon = "✅" if user[4] else "❌"
            print(f"\n{i}. {role_icon} {user[2]} ({user[1]})")
            print(f"   角色: {user[3]}")
            print(f"   状态: {'活跃' if user[4] else '停用'} {active_icon}")
            print(f"   创建时间: {user[5]}")
            print(f"   ID: {user[0]}")
        
        print("\n" + "=" * 100)
        return users
    finally:
        cursor.close()

def set_admin_role(user_email):
    """将指定用户设置为管理员"""
    cursor = get_cursor()
    try:
        # 检查用户是否存在
        cursor.execute("SELECT id, name, role FROM dbo.users WHERE email = ?", (user_email,))
        user = cursor.fetchone()
        
        if not user:
            print(f"\n❌ 用户不存在: {user_email}")
            return False
        
        user_id, name, current_role = user
        
        if current_role == 'admin':
            print(f"\n✅ 用户 {name} ({user_email}) 已经是管理员")
            return True
        
        # 更新为管理员
        cursor.execute("""
            UPDATE dbo.users 
            SET role = 'admin', updated_at = GETDATE()
            WHERE email = ?
        """, (user_email,))
        cursor.commit()
        
        print(f"\n✅ 成功将用户 {name} ({user_email}) 设置为管理员")
        print(f"   角色变更: {current_role} → admin")
        return True
    finally:
        cursor.close()

def create_test_user(email, password, name, role='user'):
    """创建测试用户"""
    cursor = get_cursor()
    try:
        # 检查用户是否已存在
        cursor.execute("SELECT id FROM dbo.users WHERE email = ?", (email,))
        if cursor.fetchone():
            print(f"\n⚠️  用户已存在: {email}")
            return False
        
        # 创建新用户
        hashed_password = hash_password(password)
        cursor.execute("""
            INSERT INTO dbo.users (email, password_hash, name, role, is_active)
            VALUES (?, ?, ?, ?, 1)
        """, (email, hashed_password, name, role))
        cursor.commit()
        
        role_icon = "👑" if role == 'admin' else "👤"
        print(f"\n✅ 成功创建用户 {role_icon}")
        print(f"   姓名: {name}")
        print(f"   邮箱: {email}")
        print(f"   角色: {role}")
        print(f"   密码: {password}")
        return True
    finally:
        cursor.close()

def generate_test_token(user_email):
    """为指定用户生成测试 JWT token"""
    cursor = get_cursor()
    try:
        cursor.execute("""
            SELECT id, email, name, role 
            FROM dbo.users 
            WHERE email = ? AND is_active = 1
        """, (user_email,))
        user = cursor.fetchone()
        
        if not user:
            print(f"\n❌ 用户不存在或未激活: {user_email}")
            return None
        
        user_id, email, name, role = user
        
        # 生成 token
        token_data = {
            "user_id": str(user_id),
            "email": email,
            "name": name,
            "role": role
        }
        token = create_access_token(token_data)
        
        role_icon = "👑" if role == 'admin' else "👤"
        print(f"\n🔑 已生成 JWT Token {role_icon}")
        print(f"   用户: {name} ({email})")
        print(f"   角色: {role}")
        print("\n" + "=" * 100)
        print("Token (复制用于测试):")
        print("=" * 100)
        print(token)
        print("=" * 100)
        print("\n📝 使用方式:")
        print("   在 HTTP 请求头中添加: Authorization: Bearer <token>")
        print("   或使用以下 PowerShell 命令测试:")
        print(f'\n   $token = "{token[:50]}..."')
        print('   $headers = @{"Authorization" = "Bearer $token"}')
        print('   Invoke-RestMethod -Uri "http://localhost:8000/api/admin/test" -Headers $headers')
        
        return token
    finally:
        cursor.close()

def interactive_menu():
    """交互式菜单"""
    while True:
        print("\n" + "=" * 100)
        print("🔧 管理员账户设置工具")
        print("=" * 100)
        print("1. 查看所有用户")
        print("2. 将现有用户设置为管理员")
        print("3. 创建新的管理员账户")
        print("4. 为用户生成测试 Token")
        print("0. 退出")
        print("=" * 100)
        
        choice = input("\n请选择操作 [0-4]: ").strip()
        
        if choice == '0':
            print("\n👋 退出程序")
            break
        elif choice == '1':
            list_users()
        elif choice == '2':
            list_users()
            email = input("\n请输入要设置为管理员的用户邮箱: ").strip()
            if email:
                set_admin_role(email)
        elif choice == '3':
            print("\n📝 创建新的管理员账户")
            email = input("邮箱: ").strip()
            password = input("密码 (至少8位，包含大小写字母和数字): ").strip()
            name = input("姓名: ").strip()
            
            if email and password and name:
                create_test_user(email, password, name, role='admin')
            else:
                print("\n❌ 信息不完整")
        elif choice == '4':
            list_users()
            email = input("\n请输入用户邮箱: ").strip()
            if email:
                generate_test_token(email)
        else:
            print("\n❌ 无效选择")

if __name__ == "__main__":
    try:
        interactive_menu()
    except KeyboardInterrupt:
        print("\n\n👋 程序被中断")
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
