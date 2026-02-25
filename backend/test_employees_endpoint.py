import requests

token = requests.post('http://localhost:8000/api/auth/login', json={
    'email': 'admin@bosch.com',
    'password': 'Admin1234'
}).json()['access_token']

r = requests.get('http://localhost:8000/api/admin/employees', headers={
    'Authorization': 'Bearer ' + token
})

print(f'Status: {r.status_code}')
if r.status_code == 200:
    data = r.json()
    print(f'Type: {type(data)}')
    if isinstance(data, list):
        print(f'Length: {len(data)}')
        if len(data) > 0:
            print(f'First employee keys: {list(data[0].keys())}')
    else:
        print(f'Not a list: {data}')
else:
    print(f'Response: {r.text}')
