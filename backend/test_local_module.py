"""直接调用最新的 admin_task_types.py 进行本地测试"""
import sys
sys.path.insert(0, '.')

from routers.admin_task_types import TaskTypeCreate, create_task_type
from database import db
from pydantic import ValidationError

# 创建测试数据
try:
    data = TaskTypeCreate(code="LOCAL_TEST", name="Local Test", color_hex="#ABCDEF")
    print(f"✅ TaskTypeCreate 模型创建成功")
    print(f"   code={data.code}")
    print(f"   name={data.name}")
    print(f"   color_hex={data.color_hex}")
    print(f"   description={data.description}")
    
    # 检查字典输出
    data_dict = data.dict()
    print(f"\n📦 .dict() 输出:")
    for k,v in data_dict.items():
        print(f"   {k}={v}")
    
    # 模拟插入（手动执行 SQL）
    print(f"\n📝 测试 SQL 插入:")
    with db.get_cursor() as cursor:
        sql = "INSERT INTO dbo.task_types (code, name, description, color_hex, is_active) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, 1)"
        params = (data.code, data.name, data.description, data.color_hex)
        print(f"   SQL: {sql}")
        print(f"   参数: {params}")
        cursor.execute(sql, params)
        task_id = cursor.fetchone()[0]
        print(f"✅ 插入成功! ID={task_id}")
        
except ValidationError as e:
    print(f"❌ Pydantic 验证失败: {e}")
except Exception as e:
    print(f"❌ 测试失败: {e}")
