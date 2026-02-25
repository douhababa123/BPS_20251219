"""检查competency_assessments表结构"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db

with db.get_cursor() as cursor:
    # 获取表结构
    cursor.execute("SELECT TOP 0 * FROM competency_assessments")
    columns = [column[0] for column in cursor.description]
    
    print("="*60)
    print("competency_assessments 表字段:")
    print("="*60)
    for i, col in enumerate(columns):
        print(f"{i}: {col}")
    
    # 获取一条示例数据
    cursor.execute("SELECT TOP 1 * FROM competency_assessments")
    row = cursor.fetchone()
    
    if row:
        print("\n" + "="*60)
        print("示例数据:")
        print("="*60)
        for i, (col, val) in enumerate(zip(columns, row)):
            val_str = str(val)[:50] if val is not None else "NULL"
            print(f"{i}: {col} = {val_str}")
