"""
执行 003_add_is_active_to_departments.sql 迁移

为 departments 表添加 is_active 字段（软删除支持）
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db

def run_migration():
    """执行迁移脚本"""
    
    migration_file = os.path.join(
        os.path.dirname(__file__),
        'migrations',
        '003_add_is_active_to_departments.sql'
    )
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # 按 GO 分割 SQL 语句
    sql_blocks = [block.strip() for block in sql_content.split('GO') if block.strip()]
    
    print(f"🔧 执行迁移: {migration_file}")
    print(f"📝 共 {len(sql_blocks)} 个 SQL 语句块")
    
    with db.get_cursor() as cursor:
        for i, block in enumerate(sql_blocks, 1):
            try:
                print(f"▶️  执行块 {i}/{len(sql_blocks)}...", end=' ')
                cursor.execute(block)
                print(f"✅ 块 {i} 执行成功")
            except Exception as e:
                print(f"❌ 块 {i} 执行失败: {e}")
                raise
    
    print("\n✅ departments 表 is_active 字段迁移完成！")


if __name__ == '__main__':
    run_migration()
