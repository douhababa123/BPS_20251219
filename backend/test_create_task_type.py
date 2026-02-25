"""测试 task_types 创建功能"""
import requests

# 登录获取 token
print("🔑 登录...")
r = requests.post('http://localhost:8000/api/auth/login', 
                 json={'email':'admin@bosch.com','password':'Admin1234'})
token = r.json()['access_token']
print(f"✅ Token 获取成功")

# 创建任务类型
print("\n📝 创建任务类型...")
r2 = requests.post('http://localhost:8000/api/admin/task-types', 
                  json={'code':'FINAL001','name':'Final Test','color_hex':'#FF9900'}, 
                  headers={'Authorization':f'Bearer {token}'})

print(f"Status: {r2.status_code}")
if r2.status_code == 201:
    result = r2.json()
    print(f"✅ 成功创建!")
    print(f"   ID: {result['id']}")
    print(f"   Code: {result['code']}")
    print(f"   Name: {result['name']}")
    print(f"   Color: {result['color_hex']}")
else:
    print(f"❌ 失败")
    print(f"Response: {r2.text[:500]}")
