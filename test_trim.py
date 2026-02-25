import sys
sys.path.append('backend')
from database import Database

db = Database()
conn = db.connect()
cursor = conn.cursor()

cursor.execute("SELECT COUNT(*) FROM dbo.tasks WHERE RTRIM(LTRIM(notes)) LIKE '%智能匹配系统%'")
print(f'使用 RTRIM(LTRIM()) 的结果: {cursor.fetchone()[0]} 条')

cursor.close()
conn.close()
