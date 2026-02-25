import requests

r = requests.get('http://localhost:8000/api/openapi.json')
if r.status_code == 200:
    routes = r.json().get('paths', {})
    admin_routes = [path for path in routes.keys() if '/admin/' in path]
    print(f'Total admin routes: {len(admin_routes)}')
    print('\nFirst 15 admin routes:')
    for route in sorted(admin_routes)[:15]:
        print(f'  {route}')
    
    # Check if departments routes exist
    dept_routes = [r for r in admin_routes if 'departments' in r.lower()]
    print(f'\nDepartments routes ({len(dept_routes)}):')
    for route in dept_routes:
        print(f'  {route}')
else:
    print(f'Failed to get OpenAPI spec: {r.status_code}')
