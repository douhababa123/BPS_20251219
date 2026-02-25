"""查看 tasks 表数据"""
from database import db

with db.get_cursor() as cursor:
    cursor.execute("SELECT TOP 5 id, task_name, task_type, task_location, start_date, end_date, status FROM dbo.tasks")
    print("📊 tasks 表数据示例:")
    print("-" * 100)
    for row in cursor.fetchall():
        print(f"ID={row[0]}")
        print(f"  name={row[1]}, type={row[2]}, location={row[3]}")
        print(f"  start={row[4]}, end={row[5]}, status={row[6]}")
        print()
