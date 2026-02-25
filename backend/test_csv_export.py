"""
测试 CSV 导出功能
验证 departments, employees, skills 三个表的 CSV 导出端点
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
print("测试 CSV 导出功能")
print("=" * 70)

# 测试 departments 导出
print("\n1. 测试 departments 导出...")
resp = requests.get(
    f"{base_url}/departments/export/csv",
    headers=headers
)
print(f"   响应状态: {resp.status_code}")
print(f"   Content-Type: {resp.headers.get('Content-Type')}")
print(f"   Content-Disposition: {resp.headers.get('Content-Disposition')}")
print(f"   数据大小: {len(resp.content)} bytes")
if resp.status_code == 200:
    lines = resp.text.split('\n')
    print(f"   ✅ 成功! 导出 {len(lines)-2} 条记录")
    print(f"   表头: {lines[0]}")
else:
    print(f"   ❌ 失败: {resp.text[:200]}")

# 测试 departments 导出（仅部分字段）
print("\n2. 测试 departments 导出（仅 id,name,code）...")
resp = requests.get(
    f"{base_url}/departments/export/csv?fields=id,name,code",
    headers=headers
)
if resp.status_code == 200:
    lines = resp.text.split('\n')
    print(f"   ✅ 成功! 表头: {lines[0]}")
else:
    print(f"   ❌ 失败: {resp.text[:200]}")

# 测试 employees 导出
print("\n3. 测试 employees 导出...")
resp = requests.get(
    f"{base_url}/employees/export/csv",
    headers=headers
)
print(f"   响应状态: {resp.status_code}")
if resp.status_code == 200:
    lines = resp.text.split('\n')
    print(f"   ✅ 成功! 导出 {len(lines)-2} 条记录")
    print(f"   表头: {lines[0]}")
else:
    print(f"   ❌ 失败: {resp.text[:200]}")

# 测试 employees 导出（按部门筛选）
print("\n4. 测试 employees 导出（按部门筛选）...")
resp = requests.get(
    f"{base_url}/employees/export/csv?department_id=1",
    headers=headers
)
if resp.status_code == 200:
    lines = resp.text.split('\n')
    print(f"   ✅ 成功! 部门 1 的员工: {len(lines)-2} 条记录")
else:
    print(f"   ❌ 失败: {resp.text[:200]}")

# 测试 skills 导出
print("\n5. 测试 skills 导出...")
resp = requests.get(
    f"{base_url}/skills/export/csv",
    headers=headers
)
print(f"   响应状态: {resp.status_code}")
if resp.status_code == 200:
    lines = resp.text.split('\n')
    print(f"   ✅ 成功! 导出 {len(lines)-2} 条记录")
    print(f"   表头: {lines[0]}")
else:
    print(f"   ❌ 失败: {resp.text[:200]}")

# 测试 skills 导出（按模块筛选）
print("\n6. 测试 skills 导出（按模块筛选）...")
resp = requests.get(
    f"{base_url}/skills/export/csv?module_id=1",
    headers=headers
)
if resp.status_code == 200:
    lines = resp.text.split('\n')
    print(f"   ✅ 成功! 模块 1 的技能: {len(lines)-2} 条记录")
else:
    print(f"   ❌ 失败: {resp.text[:200]}")

# 测试无效字段
print("\n7. 测试无效字段（应返回 400）...")
resp = requests.get(
    f"{base_url}/departments/export/csv?fields=invalid_field",
    headers=headers
)
if resp.status_code == 400:
    print(f"   ✅ 正确处理无效字段: {resp.json()['detail']}")
else:
    print(f"   ❌ 应该返回 400，实际返回 {resp.status_code}")

print("\n" + "=" * 70)
print("✅ CSV 导出测试完成!")
print("=" * 70)
