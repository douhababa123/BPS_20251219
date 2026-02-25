"""
快速检查数据库中的用户
"""
from database import db

# 查询员工
print("\n========== 检查员工数据 ==========")
with db.get_cursor() as cursor:
    cursor.execute("SELECT TOP 10 employee_id, name, email FROM employees WHERE email IS NOT NULL")
    rows = cursor.fetchall()
    
    print(f"\n找到 {len(rows)} 个有邮箱的员工:\n")
    for row in rows:
        print(f"  {row.employee_id:15s} | {row.name:20s} | {row.email}")
    
    # 统计总数
    cursor.execute("SELECT COUNT(*) as total FROM employees")
    total = cursor.fetchone()[0]
    print(f"\n员工总数: {total}")
    
    # 检查是否有 test@bosch.com
    cursor.execute("SELECT * FROM employees WHERE email = 'test@bosch.com'")
    test_user = cursor.fetchone()
    if test_user:
        print(f"\n✅ 找到 test@bosch.com 用户")
    else:
        print(f"\n❌ 未找到 test@bosch.com 用户")
        print("\n提示：您需要使用已存在的用户邮箱进行登录")
        
        # 显示前几个用户的邮箱作为示例
        cursor.execute("SELECT TOP 3 email, name FROM employees WHERE email IS NOT NULL ORDER BY name")
        users = cursor.fetchall()
        if users:
            print(f"\n💡 数据库中的用户邮箱（可用于登录）:")
            for user in users:
                print(f"   📧 {user.email:40s} ({user.name})")
        
    print("\n" + "="*70)
