"""检查 departments 表的 id 类型"""
from database import db

with db.get_cursor() as cursor:
    # 检查是否有数据
    cursor.execute("SELECT COUNT(*) FROM dbo.departments")
    count = cursor.fetchone()[0]
    print(f"📊 departments 表共有 {count} 条记录")
    
    if count > 0:
        cursor.execute("SELECT TOP 1 id FROM dbo.departments")
        sample_id = cursor.fetchone()[0]
        print(f"🔍 示例 ID: {sample_id}")
        print(f"🔍 ID 类型: {type(sample_id)}")
        print(f"🔍 ID 是整数: {isinstance(sample_id, int)}")
        
        # 测试查询不存在的 UUID 格式 ID
        import uuid
        fake_uuid = str(uuid.uuid4())
        print(f"\n🧪 测试查询 UUID 格式 ID: {fake_uuid}")
        
        try:
            cursor.execute("""
                SELECT name
                FROM dbo.departments
                WHERE id = ?
            """, (fake_uuid,))
            result = cursor.fetchone()
            print(f"✅ 查询成功，结果: {result}")
        except Exception as e:
            print(f"❌ 查询失败: {e}")
