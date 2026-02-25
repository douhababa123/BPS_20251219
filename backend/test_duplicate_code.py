"""测试 duplicate code 场景"""
import requests
import uuid

# 使用测试账号登录获取 token
login_resp = requests.post("http://localhost:8000/api/auth/login", json={
    "email": "admin@bosch.com",
    "password": "Admin1234"
})

if login_resp.status_code != 200:
    print(f"[ERROR] Login failed: {login_resp.text}")
    exit(1)

token = login_resp.json()['access_token']
print(f"[OK] Login successful, token: {token[:50]}...")

headers = {'Authorization': f'Bearer {token}'}

# 1. 创建第一个部门
unique_code = f"TEST{uuid.uuid4().hex[:6].upper()}"
name1 = f"TestDept1_{uuid.uuid4().hex[:4]}"
resp1 = requests.post(
    "http://localhost:8000/api/admin/departments",
    json={'name': name1, 'code': unique_code},
    headers=headers
)

print(f"\n[INFO] First create: status={resp1.status_code}")
print(f"[INFO] Response: {resp1.text[:300]}")

# 2. 尝试创建相同 code 的部门
name2 = f"TestDept2_{uuid.uuid4().hex[:4]}"
resp2 = requests.post(
    "http://localhost:8000/api/admin/departments",
    json={'name': name2, 'code': unique_code},  # Same code!
    headers=headers
)

print(f"\n[INFO] Second create (duplicate code): status={resp2.status_code}")
print(f"[INFO] Response: {resp2.text}")

if resp2.status_code == 400:
    print("\n[OK] Test passed! Duplicate code correctly returns 400")
else:
    print(f"\n[FAIL] Test failed! Expected 400, got {resp2.status_code}")
