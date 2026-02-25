import requests

# 获取 admin token
login_resp = requests.post('http://localhost:8000/api/auth/login', json={
    'email': 'admin@bosch.com',
    'password': 'Admin1234'
})

print(f"Login status: {login_resp.status_code}")
if login_resp.status_code == 200:
    token = login_resp.json()['access_token']
    
    # 测试 departments 端点
    headers = {'Authorization': f'Bearer {token}'}
    
    # 尝试 GET
    get_resp = requests.get('http://localhost:8000/api/admin/departments', headers=headers)
    print(f"GET /admin/departments: {get_resp.status_code}")
    
    # 尝试 POST
    post_resp = requests.post('http://localhost:8000/api/admin/departments', json={
        'name': 'Test Dept',
        'code': 'TEST01'
    }, headers=headers)
    print(f"POST /admin/departments: {post_resp.status_code}")
    print(f"POST Response: {post_resp.text[:200]}")
else:
    print(f"Login failed: {login_resp.text}")
