"""清理测试数据"""
from database import db

with db.get_cursor() as cursor:
    # 查询测试数据数量
    cursor.execute("SELECT COUNT(*) FROM dbo.departments WHERE name LIKE '%测试%' OR name LIKE '%部门%' OR name LIKE '%待删除%'")
    count = cursor.fetchone()[0]
    
    print(f"[INFO] Found {count} test departments to delete")
    
    if count > 0:
        # 删除测试数据
        cursor.execute("""
            DELETE FROM dbo.departments 
            WHERE name LIKE '%测试%' OR name LIKE '%部门%' OR name LIKE '%待删除%'
        """)
        print(f"[OK] Deleted {count} test departments")
    else:
        print("[INFO] No test departments to delete")
