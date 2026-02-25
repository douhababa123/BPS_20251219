import sys
sys.path.append('backend')
from database import Database

db = Database()
conn = db.connect()
cursor = conn.cursor()

cursor.execute("""
    SELECT COUNT(*)
    FROM dbo.tasks  
    WHERE notes COLLATE Chinese_PRC_CI_AS LIKE N'%智能匹配系统%'
""")

count = cursor.fetchone()[0]
print(f"✅ 使用 Chinese_PRC_CI_AS 排序规则的结果: {count} 条")

cursor.close()
conn.close()
