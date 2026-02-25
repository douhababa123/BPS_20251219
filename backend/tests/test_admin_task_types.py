"""Phase 3.4.2: task_types 表 CRUD API"""
import pytest, requests, uuid

class TestAdminTaskTypes:
    @pytest.fixture(scope='class')
    def admin_token(self):
        return requests.post("http://localhost:8000/api/auth/login", json={"email": "admin@bosch.com", "password": "Admin1234"}).json()['access_token']
    
    @pytest.fixture(scope='class')
    def user_token(self):
        return requests.post("http://localhost:8000/api/auth/login", json={"email": "user@bosch.com", "password": "User1234"}).json()['access_token']
    
    @pytest.fixture(scope='class')
    def api_base_url(self):
        return "http://localhost:8000/api/admin/task-types"
    
    def test_create_requires_admin(self, user_token, api_base_url):
        response = requests.post(api_base_url, json={'code': 'T001', 'name': '测试', 'color_hex': '#808080'}, headers={'Authorization': f'Bearer {user_token}'})
        assert response.status_code == 403
    
    def test_create_success(self, admin_token, api_base_url):
        data = {'code': f'T{uuid.uuid4().hex[:6].upper()}', 'name': f'任务类型_{uuid.uuid4().hex[:8]}', 'color_hex': '#3B82F6'}
        response = requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 201
        assert response.json()['code'] == data['code']
    
    def test_create_duplicate_code(self, admin_token, api_base_url):
        code = f'T{uuid.uuid4().hex[:6].upper()}'
        requests.post(api_base_url, json={'code': code, 'name': '类型1', 'color_hex': '#10B981'}, headers={'Authorization': f'Bearer {admin_token}'})
        response = requests.post(api_base_url, json={'code': code, 'name': '类型2', 'color_hex': '#EF4444'}, headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 400
    
    def test_list_excludes_deleted(self, admin_token, api_base_url):
        ids = []
        for i in range(2):
            r = requests.post(api_base_url, json={'code': f'L{uuid.uuid4().hex[:5].upper()}', 'name': f'类型{i}', 'color_hex': '#F59E0B'}, headers={'Authorization': f'Bearer {admin_token}'})
            ids.append(r.json()['id'])
        requests.delete(f"{api_base_url}/{ids[0]}", headers={'Authorization': f'Bearer {admin_token}'})
        list_resp = requests.get(api_base_url, headers={'Authorization': f'Bearer {admin_token}'})
        task_ids = [t['id'] for t in list_resp.json()['task_types']]
        assert ids[0] not in task_ids and ids[1] in task_ids
    
    def test_get_by_id(self, admin_token, api_base_url):
        data = {'code': f'G{uuid.uuid4().hex[:6].upper()}', 'name': '测试类型', 'color_hex': '#8B5CF6'}
        create_resp = requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        task_id = create_resp.json()['id']
        get_resp = requests.get(f"{api_base_url}/{task_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert get_resp.status_code == 200 and get_resp.json()['name'] == data['name']
    
    def test_update_success(self, admin_token, api_base_url):
        create_resp = requests.post(api_base_url, json={'code': f'U{uuid.uuid4().hex[:6].upper()}', 'name': '原始名', 'color_hex': '#EC4899'}, headers={'Authorization': f'Bearer {admin_token}'})
        task_id = create_resp.json()['id']
        update_resp = requests.put(f"{api_base_url}/{task_id}", json={'name': '更新名'}, headers={'Authorization': f'Bearer {admin_token}'})
        assert update_resp.status_code == 200 and update_resp.json()['name'] == '更新名'
    
    def test_update_nonexistent(self, admin_token, api_base_url):
        assert requests.put(f"{api_base_url}/999999", json={'name': '不存在'}, headers={'Authorization': f'Bearer {admin_token}'}).status_code == 404
    
    def test_soft_delete(self, admin_token, api_base_url):
        create_resp = requests.post(api_base_url, json={'code': f'D{uuid.uuid4().hex[:6].upper()}', 'name': '待删除', 'color_hex': '#14B8A6'}, headers={'Authorization': f'Bearer {admin_token}'})
        delete_resp = requests.delete(f"{api_base_url}/{create_resp.json()['id']}", headers={'Authorization': f'Bearer {admin_token}'})
        assert delete_resp.status_code == 200
    
    def test_delete_nonexistent(self, admin_token, api_base_url):
        assert requests.delete(f"{api_base_url}/999999", headers={'Authorization': f'Bearer {admin_token}'}).status_code == 404
