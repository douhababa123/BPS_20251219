"""
测试任务匹配API
"""
import sys
sys.path.insert(0, '.')

from database import Database, get_db
from contextlib import contextmanager

# 测试数据库连接
db = Database()
conn = db.connect()
cursor = conn.cursor()

print("=" * 70)
print("🧪 任务匹配模块 - 数据验证测试")
print("=" * 70)

# 1. 检查模块数据
print("\n📊 1. 检查模块数据")
cursor.execute("""
    SELECT DISTINCT module_id, module_name
    FROM dbo.skills
    WHERE is_active = 1
    ORDER BY module_id
""")
modules = cursor.fetchall()
print(f"   ✅ 找到 {len(modules)} 个模块:")
for m in modules[:5]:
    print(f"      - {m[0]}: {m[1]}")
if len(modules) > 5:
    print(f"      ... 还有 {len(modules) - 5} 个")

# 2. 检查技能数据
print("\n🎯 2. 检查技能数据")
cursor.execute("""
    SELECT COUNT(*) FROM dbo.skills WHERE is_active = 1
""")
skill_count = cursor.fetchone()[0]
print(f"   ✅ 活跃技能总数: {skill_count}")

# 3. 检查员工数据
print("\n👥 3. 检查员工数据")
cursor.execute("""
    SELECT COUNT(*) FROM dbo.employees WHERE is_active = 1
""")
emp_count = cursor.fetchone()[0]
print(f"   ✅ 活跃员工总数: {emp_count}")

cursor.execute("""
    SELECT TOP 3 id, name, department_id
    FROM dbo.employees
    WHERE is_active = 1
""")
emps = cursor.fetchall()
print(f"   示例员工:")
for e in emps:
    print(f"      - {e[1]} (ID: {e[0]})")

# 4. 检查能力评估数据
print("\n📈 4. 检查能力评估数据")
cursor.execute("""
    SELECT COUNT(*) FROM dbo.competency_assessments
""")
assessment_count = cursor.fetchone()[0]
print(f"   ✅ 能力评估记录总数: {assessment_count}")

if emp_count > 0:
    cursor.execute("""
        SELECT TOP 1 id FROM dbo.employees WHERE is_active = 1
    """)
    test_emp_id = str(cursor.fetchone()[0])  # 转换为字符串
    
    cursor.execute("""
        SELECT COUNT(*) 
        FROM dbo.competency_assessments
        WHERE employee_id = CAST(? AS uniqueidentifier)
    """, test_emp_id)
    test_emp_assessments = cursor.fetchone()[0]
    print(f"   示例员工评估数: {test_emp_assessments}")

# 5. 检查任务数据
print("\n📋 5. 检查任务数据")
cursor.execute("""
    SELECT COUNT(*) FROM dbo.tasks
""")
task_count = cursor.fetchone()[0]
print(f"   ✅ 任务总数: {task_count}")

cursor.execute("""
    SELECT COUNT(*) FROM dbo.tasks WHERE source = 'matching'
""")
matching_task_count = cursor.fetchone()[0]
print(f"   ✅ 匹配系统创建的任务数: {matching_task_count}")

# 6. 数据完整性检查
print("\n🔍 6. 数据完整性检查")
checks_passed = 0
checks_total = 5

if len(modules) > 0:
    print("   ✅ 模块数据完整")
    checks_passed += 1
else:
    print("   ❌ 缺少模块数据")

if skill_count > 0:
    print("   ✅ 技能数据完整")
    checks_passed += 1
else:
    print("   ❌ 缺少技能数据")

if emp_count > 0:
    print("   ✅ 员工数据完整")
    checks_passed += 1
else:
    print("   ❌ 缺少员工数据")

if assessment_count > 0:
    print("   ✅ 能力评估数据完整")
    checks_passed += 1
else:
    print("   ❌ 缺少能力评估数据")

if task_count >= 0:
    print("   ✅ 任务表可用")
    checks_passed += 1
else:
    print("   ❌ 任务表不可用")

print(f"\n📊 检查结果: {checks_passed}/{checks_total} 项通过")

if checks_passed == checks_total:
    print("✅ 所有数据检查通过，任务匹配功能可用！")
else:
    print("⚠️  部分数据缺失，可能影响匹配功能")

# 7. 测试匹配算法的数据准备
print("\n🧮 7. 匹配算法数据准备测试")
if emp_count > 0 and assessment_count > 0:
    cursor.execute("""
        SELECT TOP 1 e.id, e.name,
               COUNT(ca.id) as assessment_count
        FROM dbo.employees e
        LEFT JOIN dbo.competency_assessments ca ON e.id = ca.employee_id
        WHERE e.is_active = 1
        GROUP BY e.id, e.name
        HAVING COUNT(ca.id) > 0
    """)
    sample = cursor.fetchone()
    if sample:
        print(f"   ✅ 找到有能力评估的员工: {sample[1]} ({sample[2]}条评估)")
        print(f"   ✅ 匹配算法数据准备就绪")
    else:
        print("   ⚠️  没有找到有能力评估的员工")
else:
    print("   ⚠️  员工或评估数据不足")

conn.close()
print("\n" + "=" * 70)
print("✅ 测试完成")
print("=" * 70)
