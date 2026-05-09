import pyodbc
import calendar

YEAR = 2026
MONTH = 5
start = f"{YEAR}-{MONTH:02d}-01"
last_day = calendar.monthrange(YEAR, MONTH)[1]
end = f"{YEAR}-{MONTH:02d}-{last_day:02d}"

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=10.88.43.154;'
    'DATABASE=DCCT_BPS_Debug;'
    'UID=TEST;PWD=123456'
)
cursor = conn.cursor()

cursor.execute(f"""
SELECT 
    t.task_name,
    t.task_type,
    t.task_location,
    e.name AS employee_name,
    t.start_date,
    t.end_date,
    t.time_slot,
    t.total_hours,
    DATEDIFF(day, t.start_date, t.end_date)+1 AS actual_days,
    COALESCE(t.total_hours,
        (DATEDIFF(day, t.start_date, t.end_date)+1) *
        CASE WHEN t.time_slot IN ('AM','PM') THEN 4 ELSE 8 END
    ) AS effective_hours
FROM dbo.tasks t
LEFT JOIN dbo.employees e ON t.assigned_employee_id = e.id
WHERE t.start_date >= '{start}' AND t.start_date <= '{end}'
ORDER BY t.start_date, e.name
""")

rows = cursor.fetchall()
cols = [d[0] for d in cursor.description]

print(f"\n===== {YEAR}年{MONTH}月 任务统计 =====")
print(f"共 {len(rows)} 条任务记录\n")
print(f"{'日期范围':<24} {'员工':<16} {'任务名':<30} {'类型':<13} {'时段':<10} {'天':>3} {'小时':>5}")
print("-" * 106)

total_effective = 0
type_map = {}
emp_map = {}

for r in rows:
    row = dict(zip(cols, r))
    eff = row['effective_hours'] or 0
    total_effective += eff
    t = row['task_type'] or '未知'
    emp = row['employee_name'] or '未分配'
    type_map[t] = type_map.get(t, 0) + eff
    emp_map[emp] = emp_map.get(emp, 0) + eff
    date_range = f"{row['start_date']} ~ {row['end_date']}"
    name = (row['task_name'] or '无名')[:28]
    print(f"{date_range:<24} {emp:<16} {name:<30} {t:<13} {(row['time_slot'] or 'N/A'):<10} {row['actual_days']:>3}天 {eff:>5}h")

print(f"\n{'='*60}")
print(f"5月小时总计: {total_effective}h\n")

print("按任务类型:")
for k, v in sorted(type_map.items(), key=lambda x: -x[1]):
    bar = '█' * int(v / total_effective * 25) if total_effective else ''
    print(f"  {k:<15} {v:>5}h  {v/total_effective*100:>5.1f}%  {bar}")

print("\n按员工:")
for k, v in sorted(emp_map.items(), key=lambda x: -x[1]):
    bar = '█' * int(v / total_effective * 25) if total_effective else ''
    print(f"  {k:<15} {v:>5}h  {v/total_effective*100:>5.1f}%  {bar}")

conn.close()
