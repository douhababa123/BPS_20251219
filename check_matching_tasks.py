"""
检查数据库中匹配系统提交的任务
"""
import sys
sys.path.append('backend')

from database import Database

def check_matching_tasks():
    db = Database()
    conn = db.connect()
    cursor = conn.cursor()
    
    print("=" * 80)
    print("🔍 检查所有任务的 notes 字段")
    print("=" * 80)
    
    # 查询所有任务
    cursor.execute("""
        SELECT 
            id, task_name, status, notes, requester_id, created_at
        FROM dbo.tasks
        ORDER BY created_at DESC
    """)
    
    all_tasks = cursor.fetchall()
    print(f"\n📊 数据库中共有 {len(all_tasks)} 条任务记录\n")
    
    # 显示最近的 10 条任务
    for i, row in enumerate(all_tasks[:10], 1):
        task_id, task_name, status, notes, requester_id, created_at = row
        print(f"{i}. {task_name}")
        print(f"   ID: {task_id}")
        print(f"   Status: {status}")
        print(f"   Requester ID: {requester_id}")
        print(f"   Created: {created_at}")
        print(f"   Notes: {notes or '(NULL)'}")
        print(f"   包含'智能匹配系统': {'✅ 是' if notes and '智能匹配系统' in notes else '❌ 否'}")
        print()
    
    # 统计包含 "智能匹配系统" 的任务
    cursor.execute("""
        SELECT COUNT(*)
        FROM dbo.tasks
        WHERE notes LIKE '%智能匹配系统%'
    """)
    matching_count = cursor.fetchone()[0]
    
    print("=" * 80)
    print(f"📈 包含'智能匹配系统'的任务数量: {matching_count}")
    print("=" * 80)
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_matching_tasks()
