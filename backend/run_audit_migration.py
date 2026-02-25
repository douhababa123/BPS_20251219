"""
执行审计日志表迁移脚本
"""

from database import db
import os

def run_audit_log_migration():
    """执行审计日志表创建迁移"""
    
    sql_file = os.path.join(os.path.dirname(__file__), 
                            'migrations', '002_create_audit_logs_table.sql')
    
    print(f"\n🔧 执行审计日志表迁移: {sql_file}")
    print("=" * 80)
    
    # 读取SQL文件
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # 按 GO 分割
    sql_blocks = [block.strip() for block in sql_content.split('\nGO\n') if block.strip()]
    
    print(f"📝 共 {len(sql_blocks)} 个 SQL 语句块\n")
    
    # 执行每个块
    with db.get_cursor() as cursor:
        for i, block in enumerate(sql_blocks, 1):
            # 跳过注释块
            if block.startswith('/*') and '*/' in block and block.strip().endswith('*/'):
                continue
            
            try:
                print(f"▶️  执行块 {i}/{len(sql_blocks)}...")
                
                # 执行SQL
                cursor.execute(block)
                
                # 获取打印输出
                while cursor.nextset():
                    pass
                
                print(f"✅ 块 {i} 执行成功")
                
            except Exception as e:
                print(f"❌ 块 {i} 执行失败: {e}")
                # 继续执行其他块
    
    print("\n" + "=" * 80)
    print("✅ 审计日志表迁移完成！\n")

if __name__ == '__main__':
    try:
        run_audit_log_migration()
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
