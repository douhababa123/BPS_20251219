import requests

token = requests.post('http://localhost:8000/api/auth/login', json={
    'email': 'admin@bosch.com',
    'password': 'Admin1234'
}).json()['access_token']

r = requests.get('http://localhost:8000/api/admin/tasks', headers={
    'Authorization': 'Bearer ' + token
})

print(f'Status: {r.status_code}')
if r.status_code == 200:
    data = r.json()
    print(f'Type: {type(data)}')
    if isinstance(data, dict):
        print(f'Keys: {list(data.keys())}')
        if 'tasks' in data:
            print(f'Tasks count: {len(data["tasks"])}')
    else:
        print(f'List length: {len(data)}')
        if len(data) > 0:
            print(f'First task keys: {list(data[0].keys())}')
else:
    print(f'Error: {r.text}')
