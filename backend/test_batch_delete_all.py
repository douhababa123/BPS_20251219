"""
快速测试批量删除功能
测试 departments, employees, skills 三个表的批量删除
"""

import requests
import sys
from auth import create_access_token, hash_password
from database import db

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
print("测试批量删除功能")
print("=" * 70)

# 测试 departments
print("\n1. 测试 departments 批量删除...")
dept_ids = []
for i in range(2):
    resp = requests.post(
        f"{base_url}/departments",
        json={'name': f'BatchTest_{i}', 'code': f'BT{i}'},
        headers=headers
    )
    if resp.status_code == 201:
        dept_ids.append(resp.json()['id'])
        print(f"   ✅ 创建部门: {resp.json()['id']}")

resp = requests.post(
    f"{base_url}/departments/batch-delete",
    json={'ids': dept_ids},
    headers=headers
)
print(f"   批量删除响应: {resp.status_code} - {resp.json()}")

# 测试 employees  
print("\n2. 测试 employees 批量删除...")
emp_ids = []
for i in range(2):
    resp = requests.post(
        f"{base_url}/employees",
        json={'employee_id': f'EMP_BT_{i}', 'name': f'员工{i}', 'department_id': 1},
        headers=headers
    )
    if resp.status_code == 201:
        emp_ids.append(resp.json()['id'])
        print(f"   ✅ 创建员工: {resp.json()['id']}")

resp = requests.post(
    f"{base_url}/employees/batch-delete",
    json={'ids': emp_ids},
    headers=headers
)
print(f"   批量删除响应: {resp.status_code} - {resp.json()}")

# 测试 skills
print("\n3. 测试 skills 批量删除...")
skill_ids = []
for i in range(2):
    resp = requests.post(
        f"{base_url}/skills",
        json={'module_id': 1, 'module_name': '测试模块', 'skill_name': f'批量测试技能{i}', 'display_order': 100 + i},
        headers=headers
    )
    if resp.status_code == 201:
        skill_ids.append(str(resp.json()['id']))
        print(f"   ✅ 创建技能: {resp.json()['id']}")

resp = requests.post(
    f"{base_url}/skills/batch-delete",
    json={'ids': skill_ids},
    headers=headers
)
print(f"   批量删除响应: {resp.status_code} - {resp.json()}")

print("\n" + "=" * 70)
print("✅ 所有批量删除测试完成!")
print("=" * 70)
