"""
测试 CSV 导入功能
验证 departments, employees, skills 三个表的 CSV 导入端点
"""

import requests
from auth import create_access_token, hash_password
from database import db
import os

# 创建管理员 token
with db.get_cursor() as cursor:
    cursor.execute("""
        SELECT id, name, email
        FROM dbo.users
        WHERE email = 'admin@bosch.com'
    """)
    admin = cursor.fetchone()
    
    if not admin:
        cursor.execute("""
            INSERT INTO dbo.users (email, password_hash, name, role)
            OUTPUT INSERTED.id, INSERTED.name, INSERTED.email
            VALUES (?, ?, ?, 'admin')
        """, ('admin@bosch.com', hash_password('Admin1234'), '测试管理员'))
        admin = cursor.fetchone()

token = create_access_token({
    'user_id': str(admin[0]),
    'name': admin[1],
    'email': admin[2],
    'role': 'admin'
})

headers = {'Authorization': f'Bearer {token}'}
base_url = 'http://localhost:8000/api/admin'

print("=" * 70)
print("测试 CSV 导入功能")
print("=" * 70)

# 测试 departments 导入
print("\n1. 测试 departments 导入...")
csv_file = 'test_data/departments_import.csv'
if os.path.exists(csv_file):
    with open(csv_file, 'rb') as f:
        files = {'file': ('departments.csv', f, 'text/csv')}
        resp = requests.post(
            f"{base_url}/departments/import/csv",
            headers=headers,
            files=files
        )
    print(f"   响应状态: {resp.status_code}")
    if resp.status_code == 200:
        result = resp.json()
        print(f"   ✅ 成功: {result['success']} 条")
        print(f"   ❌ 失败: {result['failed']} 条")
        if result['errors']:
            print(f"   错误详情: {result['errors'][:3]}")  # 只显示前3条
    else:
        print(f"   ❌ 失败: {resp.text[:200]}")
else:
    print(f"   ⚠️ 测试文件不存在: {csv_file}")

# 测试 employees 导入
print("\n2. 测试 employees 导入...")
csv_file = 'test_data/employees_import.csv'
if os.path.exists(csv_file):
    with open(csv_file, 'rb') as f:
        files = {'file': ('employees.csv', f, 'text/csv')}
        resp = requests.post(
            f"{base_url}/employees/import/csv",
            headers=headers,
            files=files
        )
    print(f"   响应状态: {resp.status_code}")
    if resp.status_code == 200:
        result = resp.json()
        print(f"   ✅ 成功: {result['success']} 条")
        print(f"   ❌ 失败: {result['failed']} 条")
        if result['errors']:
            print(f"   错误详情: {result['errors'][:3]}")
    else:
        print(f"   ❌ 失败: {resp.text[:200]}")
else:
    print(f"   ⚠️ 测试文件不存在: {csv_file}")

# 测试 skills 导入
print("\n3. 测试 skills 导入...")
csv_file = 'test_data/skills_import.csv'
if os.path.exists(csv_file):
    with open(csv_file, 'rb') as f:
        files = {'file': ('skills.csv', f, 'text/csv')}
        resp = requests.post(
            f"{base_url}/skills/import/csv",
            headers=headers,
            files=files
        )
    print(f"   响应状态: {resp.status_code}")
    if resp.status_code == 200:
        result = resp.json()
        print(f"   ✅ 成功: {result['success']} 条")
        print(f"   ❌ 失败: {result['failed']} 条")
        if result['errors']:
            print(f"   错误详情: {result['errors'][:3]}")
    else:
        print(f"   ❌ 失败: {resp.text[:200]}")
else:
    print(f"   ⚠️ 测试文件不存在: {csv_file}")

# 测试错误处理：重复导入
print("\n4. 测试重复导入（应部分失败）...")
csv_file = 'test_data/departments_import.csv'
if os.path.exists(csv_file):
    with open(csv_file, 'rb') as f:
        files = {'file': ('departments.csv', f, 'text/csv')}
        resp = requests.post(
            f"{base_url}/departments/import/csv",
            headers=headers,
            files=files
        )
    if resp.status_code == 200:
        result = resp.json()
        print(f"   成功: {result['success']} 条（应该是0）")
        print(f"   失败: {result['failed']} 条（应该是3）")
        if result['errors']:
            print(f"   ✅ 正确检测到重复: {result['errors'][0]['error']}")
    else:
        print(f"   响应: {resp.status_code}")

# 测试非 CSV 文件
print("\n5. 测试非 CSV 文件（应返回 400）...")
resp = requests.post(
    f"{base_url}/departments/import/csv",
    headers=headers,
    files={'file': ('test.txt', b'invalid', 'text/plain')}
)
if resp.status_code == 400:
    print(f"   ✅ 正确拒绝非 CSV 文件: {resp.json()['detail']}")
else:
    print(f"   ❌ 应该返回 400，实际返回 {resp.status_code}")

# 验证导入的数据
print("\n6. 验证导入的数据...")
resp = requests.get(f"{base_url}/departments", headers=headers)
if resp.status_code == 200:
    depts = resp.json()['departments']
    csv_depts = [d for d in depts if d['code'].startswith('CSVTEST')]
    print(f"   ✅ 找到 {len(csv_depts)} 个 CSV 导入的部门")

resp = requests.get(f"{base_url}/employees", headers=headers)
if resp.status_code == 200:
    emps = resp.json()['employees']
    csv_emps = [e for e in emps if e['employee_id'].startswith('CSV_EMP')]
    print(f"   ✅ 找到 {len(csv_emps)} 个 CSV 导入的员工")

resp = requests.get(f"{base_url}/skills", headers=headers)
if resp.status_code == 200:
    skills = resp.json()['skills']
    csv_skills = [s for s in skills if (s.get('skill_code') or '').startswith('CSVSKILL')]
    print(f"   ✅ 找到 {len(csv_skills)} 个 CSV 导入的技能")

print("\n" + "=" * 70)
print("✅ CSV 导入测试完成!")
print("=" * 70)
