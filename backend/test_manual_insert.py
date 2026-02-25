"""手动测试 SQL INSERT"""
from database import db

try:
    with db.get_cursor() as cursor:
        cursor.execute(
            "INSERT INTO dbo.task_types (code, name, description, color_hex, is_active) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, 1)",
            ('MANUAL_TEST', 'Manual Test', None, '#123456')
        )
        task_id = cursor.fetchone()[0]
        print(f"✅ SQL INSERT 成功，ID={task_id}")
        print(f"参数: code='MANUAL_TEST', name='Manual Test', description=None, color_hex='#123456'")
except Exception as e:
    print(f"❌ SQL INSERT 失败: {e}")
