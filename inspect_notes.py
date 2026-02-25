import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append('backend')
from database import Database

db = Database()
conn = db.connect()
cursor = conn.cursor()

cursor.execute("""
    SELECT TOP 1 notes
    FROM dbo.tasks  
    WHERE task_name = 'test11'
""")

row = cursor.fetchone()
if row and row[0]:
    notes = row[0]
    print(f"Notes 内容: '{notes}'")
    print(f"Notes 类型: {type(notes)}")
    print(f"Notes 长度: {len(notes)}")
    print(f"\n每个字符:")
    for i, ch in enumerate(notes):
        print(f"  {i}: '{ch}' (U+{ord(ch):04X}) - {ord(ch)}")
    
    # 测试是否能在 Python 中找到"智能匹配系统"
    if "智能匹配系统" in notes:
        print(f"\n✅ Python 中能找到 '智能匹配系统'")
    else:
        print(f"\n❌ Python 中找不到 '智能匹配系统'")

cursor.close()
conn.close()
