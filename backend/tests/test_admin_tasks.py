"""Phase 3.4.3: tasks 表 CRUD API 测试"""
import pytest, requests, uuid
from datetime import date, timedelta

class TestAdminTasks:
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
        return "http://localhost:8000/api/admin/tasks"
    
    def test_create_requires_admin(self, user_token, api_base_url):
        response = requests.post(api_base_url, 
                                json={'task_name': 'Test', 'task_type': 'workshop', 'task_location': 'FDCCh', 
                                     'start_date': '2026-03-01', 'end_date': '2026-03-05'}, 
                                headers={'Authorization': f'Bearer {user_token}'})
        assert response.status_code == 403
    
    def test_create_success(self, admin_token, api_base_url):
        data = {
            'task_name': f'Task_{uuid.uuid4().hex[:8]}',
            'task_type': 'workshop',
            'task_location': 'FDCCh',
            'start_date': '2026-03-01',
            'end_date': '2026-03-05',
            'status': 'active'
        }
        response = requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 201
        assert response.json()['task_name'] == data['task_name']
    
    def test_list_tasks(self, admin_token, api_base_url):
        # 创建 2 个任务
        for i in range(2):
            requests.post(api_base_url, 
                         json={'task_name': f'List_{i}_{uuid.uuid4().hex[:6]}', 'task_type': 'meeting', 
                              'task_location': 'FLCCh', 'start_date': '2026-03-10', 'end_date': '2026-03-10'}, 
                         headers={'Authorization': f'Bearer {admin_token}'})
        
        list_resp = requests.get(api_base_url, headers={'Authorization': f'Bearer {admin_token}'})
        assert list_resp.status_code == 200
        assert list_resp.json()['count'] >= 2
    
    def test_get_by_id(self, admin_token, api_base_url):
        data = {'task_name': f'Get_{uuid.uuid4().hex[:8]}', 'task_type': 'project', 
               'task_location': 'FEDNa', 'start_date': '2026-04-01', 'end_date': '2026-04-15'}
        create_resp = requests.post(api_base_url, json=data, headers={'Authorization': f'Bearer {admin_token}'})
        task_id = create_resp.json()['id']
        
        get_resp = requests.get(f"{api_base_url}/{task_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert get_resp.status_code == 200
        assert get_resp.json()['task_name'] == data['task_name']
    
    def test_update_success(self, admin_token, api_base_url):
        create_resp = requests.post(api_base_url, 
                                   json={'task_name': 'Original', 'task_type': 'workshop', 
                                        'task_location': 'FDCCh', 'start_date': '2026-05-01', 'end_date': '2026-05-05'}, 
                                   headers={'Authorization': f'Bearer {admin_token}'})
        task_id = create_resp.json()['id']
        
        update_resp = requests.put(f"{api_base_url}/{task_id}", 
                                  json={'task_name': 'Updated', 'status': 'completed'}, 
                                  headers={'Authorization': f'Bearer {admin_token}'})
        assert update_resp.status_code == 200
        assert update_resp.json()['task_name'] == 'Updated'
        assert update_resp.json()['status'] == 'completed'
    
    def test_update_nonexistent(self, admin_token, api_base_url):
        fake_id = str(uuid.uuid4())
        response = requests.put(f"{api_base_url}/{fake_id}", 
                               json={'task_name': 'NonExistent'}, 
                               headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 404
    
    def test_delete_task(self, admin_token, api_base_url):
        create_resp = requests.post(api_base_url, 
                                   json={'task_name': 'ToDelete', 'task_type': 'meeting', 
                                        'task_location': 'FLCCh', 'start_date': '2026-06-01', 'end_date': '2026-06-01'}, 
                                   headers={'Authorization': f'Bearer {admin_token}'})
        task_id = create_resp.json()['id']
        
        delete_resp = requests.delete(f"{api_base_url}/{task_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert delete_resp.status_code == 200
        
        # 验证删除后无法获取
        get_resp = requests.get(f"{api_base_url}/{task_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert get_resp.status_code == 404
    
    def test_delete_nonexistent(self, admin_token, api_base_url):
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{api_base_url}/{fake_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 404
