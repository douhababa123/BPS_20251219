"""Phase 3.4.4: competency_definitions 表 CRUD API 测试"""
import pytest, requests, uuid

class TestAdminCompetencyDefinitions:
    @pytest.fixture(scope='class')
    def admin_token(self):
        return requests.post("http://localhost:8000/api/auth/login", 
                           json={"email": "admin@bosch.com", "password": "Admin1234"}).json()['access_token']
    
    @pytest.fixture(scope='class')
    def user_token(self):
        return requests.post("http://localhost:8000/api/auth/login", 
                           json={"email": "user@bosch.com", "password": "User1234"}).json()['access_token']
    
    @pytest.fixture(scope='class')
    def api_base_url(self):
        return "http://localhost:8000/api/admin/competency-definitions"
    
    def test_create_requires_admin(self, user_token, api_base_url):
        response = requests.post(api_base_url, 
                                json={'module_id': 1, 'module_name': 'Test', 'competency_type': 'Type1', 'competency_code': 'T-001'}, 
                                headers={'Authorization': f'Bearer {user_token}'})
        assert response.status_code == 403
    
    def test_create_success(self, admin_token, api_base_url):
        code = f'TEST-{uuid.uuid4().hex[:8].upper()}'
        data = {
            'module_id': 9,
            'module_name': 'Test Module',
            'competency_type': 'Test Type',
            'competency_code': code,
            'owner_engineer': 'Test Engineer',
            'is_key_competency': True
        }
        response = requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 201
        assert response.json()['competency_code'] == code
    
    def test_create_duplicate_code(self, admin_token, api_base_url):
        code = f'DUP-{uuid.uuid4().hex[:6].upper()}'
        data = {'module_id': 1, 'module_name': 'BPS', 'competency_type': 'Type1', 'competency_code': code}
        requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        response = requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 400
    
    def test_list_definitions(self, admin_token, api_base_url):
        # 创建 2 个定义
        for i in range(2):
            requests.post(api_base_url, 
                         json={'module_id': 2, 'module_name': 'Investment', 'competency_type': f'Type{i}', 
                              'competency_code': f'INV-{i}-{uuid.uuid4().hex[:6]}'}, 
                         headers={'Authorization': f'Bearer {admin_token}'})
        
        list_resp = requests.get(api_base_url, headers={'Authorization': f'Bearer {admin_token}'})
        assert list_resp.status_code == 200
        assert list_resp.json()['count'] >= 2
    
    def test_get_by_id(self, admin_token, api_base_url):
        code = f'GET-{uuid.uuid4().hex[:8].upper()}'
        data = {'module_id': 3, 'module_name': 'TPM', 'competency_type': 'Test Type', 'competency_code': code}
        create_resp = requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        def_id = create_resp.json()['id']
        
        get_resp = requests.get(f"{api_base_url}/{def_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert get_resp.status_code == 200
        assert get_resp.json()['competency_code'] == code
    
    def test_update_success(self, admin_token, api_base_url):
        create_resp = requests.post(api_base_url, 
                                   json={'module_id': 4, 'module_name': 'CIP', 'competency_type': 'Original', 
                                        'competency_code': f'UPD-{uuid.uuid4().hex[:6]}'}, 
                                   headers={'Authorization': f'Bearer {admin_token}'})
        def_id = create_resp.json()['id']
        
        update_resp = requests.put(f"{api_base_url}/{def_id}", 
                                  json={'competency_type': 'Updated', 'owner_engineer': 'New Engineer'}, 
                                  headers={'Authorization': f'Bearer {admin_token}'})
        assert update_resp.status_code == 200
        assert update_resp.json()['competency_type'] == 'Updated'
        assert update_resp.json()['owner_engineer'] == 'New Engineer'
    
    def test_update_nonexistent(self, admin_token, api_base_url):
        response = requests.put(f"{api_base_url}/999999", 
                               json={'competency_type': 'NonExistent'}, 
                               headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 404
    
    def test_delete_definition(self, admin_token, api_base_url):
        create_resp = requests.post(api_base_url, 
                                   json={'module_id': 5, 'module_name': 'Leadership', 'competency_type': 'ToDelete', 
                                        'competency_code': f'DEL-{uuid.uuid4().hex[:6]}'}, 
                                   headers={'Authorization': f'Bearer {admin_token}'})
        def_id = create_resp.json()['id']
        
        delete_resp = requests.delete(f"{api_base_url}/{def_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert delete_resp.status_code == 200
        
        # 验证删除后无法获取
        get_resp = requests.get(f"{api_base_url}/{def_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert get_resp.status_code == 404
    
    def test_delete_nonexistent(self, admin_token, api_base_url):
        response = requests.delete(f"{api_base_url}/999999", headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 404
