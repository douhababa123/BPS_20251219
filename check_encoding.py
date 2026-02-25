"""
检查 notes 字段的 16 进制编码
"""
import sys
sys.path.append('backend')

from database import Database

def check_encoding():
    db = Database()
    conn = db.connect()
    cursor = conn.cursor()
    
    print("=" * 80)
    print("🔍 检查 notes 字段的字节编码")
    print("=" * 80)
    
    # 获取一条包含"智能匹配系统"的记录
    cursor.execute("""
        SELECT TOP 1
            task_name,
            notes,
            CONVERT(VARBINARY(MAX), notes) as hex_notes
        FROM dbo.tasks
        WHERE notes LIKE '%通过%'
        ORDER BY created_at DESC
    """)
    
    row = cursor.fetchone()
    if row:
        task_name, notes, hex_notes = row
        print(f"\n任务名: {task_name}")
        print(f"\nNotes 文本: {notes}")
        print(f"\nNotes 长度: {len(notes) if notes else 0} 字符")
        print(f"\nNotes 16进制 (前200字节):")
        if hex_notes:
            hex_str = hex_notes[:200].hex()
            # 每32个字符（16字节）换行
            for i in range(0, len(hex_str), 32):
                print(f"  {hex_str[i:i+32]}")
        
        # 显示每个字符的 Unicode 码点
        print(f"\n字符 Unicode 码点:")
        if notes:
            for i, char in enumerate(notes[:20]):  # 只显示前20个字符
                print(f"  {i}: '{char}' = U+{ord(char):04X}")
    
    # 测试：直接比较文本
    print("\n" + "=" * 80)
    print("🧪 测试直接文本比较")
    print("=" * 80)
    
    cursor.execute("""
        SELECT COUNT(*)
        FROM dbo.tasks
        WHERE notes = N'通过智能匹配系统分配 (综合评分: 100%) [来源:智能匹配系统]'
    """)
    exact_match = cursor.fetchone()[0]
    print(f"\n完全匹配的记录: {exact_match} 条")
    
    cursor.execute("""
        SELECT COUNT(*)
        FROM dbo.tasks  
        WHERE LEFT(notes, 10) = N'通过智能匹配系'
    """)
    prefix_match = cursor.fetchone()[0]
    print(f"前10个字符匹配的记录: {prefix_match} 条")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_encoding()
