"""
调试 LIKE 查询问题
"""
import sys
sys.path.append('backend')

from database import Database

def debug_like_query():
    db = Database()
    conn = db.connect()
    cursor = conn.cursor()
    
    print("=" * 80)
    print("🔍 测试不同的 LIKE 查询")
    print("=" * 80)
    
    # 测试 1: 直接 LIKE 查询
    cursor.execute("""
        SELECT COUNT(*), 'LIKE查询'
        FROM dbo.tasks
        WHERE notes LIKE '%智能匹配系统%'
    """)
    count1 = cursor.fetchone()[0]
    print(f"\n1. LIKE '%智能匹配系统%': {count1} 条")
    
    # 测试 2: LIKE 查询带 COLLATE
    cursor.execute("""
        SELECT COUNT(*), 'LIKE with COLLATE'
        FROM dbo.tasks
        WHERE notes LIKE '%智能匹配系统%' COLLATE Chinese_PRC_CI_AS
    """)
    count2 = cursor.fetchone()[0]
    print(f"2. LIKE with COLLATE Chinese_PRC_CI_AS: {count2} 条")
    
    # 测试 3: CHARINDEX
    cursor.execute("""
        SELECT COUNT(*), 'CHARINDEX'
        FROM dbo.tasks
        WHERE CHARINDEX('智能匹配系统', notes) > 0
    """)
    count3 = cursor.fetchone()[0]
    print(f"3. CHARINDEX('智能匹配系统', notes): {count3} 条")
    
    # 测试 4: CONTAINS (需要全文索引)
    try:
        cursor.execute("""
            SELECT COUNT(*), 'CONTAINS'
            FROM dbo.tasks
            WHERE CONTAINS(notes, '智能匹配系统')
        """)
        count4 = cursor.fetchone()[0]
        print(f"4. CONTAINS(notes, '智能匹配系统'): {count4} 条")
    except Exception as e:
        print(f"4. CONTAINS 查询失败: {e}")
    
    # 测试 5: 查看 notes 字段的实际长度和编码
    cursor.execute("""
        SELECT TOP 3
            task_name,
            LEN(notes) as length,
            DATALENGTH(notes) as byte_length,
            LEFT(notes, 50) as preview
        FROM dbo.tasks
        WHERE notes IS NOT NULL
        ORDER BY created_at DESC
    """)
    
    print("\n" + "=" * 80)
    print("📝 notes 字段详情")
    print("=" * 80)
    for row in cursor.fetchall():
        print(f"\n任务: {row[0]}")
        print(f"  字符长度: {row[1]}")
        print(f"  字节长度: {row[2]}")
        print(f"  前50字符: {row[3]}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    debug_like_query()
