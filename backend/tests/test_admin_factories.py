"""
Phase 3.4.1: factories 表 CRUD API 测试套件
"""

import pytest
import requests
import uuid


class TestAdminFactories:
    """工厂管理 API 测试类"""
    
    @pytest.fixture(scope='class')
    def admin_token(self):
        """获取管理员 token"""
        response = requests.post(
            "http://localhost:8000/api/auth/login",
            json={"email": "admin@bosch.com", "password": "Admin1234"}
        )
        return response.json()['access_token']
    
    @pytest.fixture(scope='class')
    def user_token(self):
        """获取普通用户 token"""
        response = requests.post(
            "http://localhost:8000/api/auth/login",
            json={"email": "user@bosch.com", "password": "User1234"}
        )
        return response.json()['access_token']
    
    @pytest.fixture(scope='class')
    def api_base_url(self):
        return "http://localhost:8000/api/admin/factories"
    
    def test_create_factory_requires_admin(self, user_token, api_base_url):
        """测试创建工厂需要管理员权限"""
        factory_data = {
            'code': 'F001',
            'name': '测试工厂',
            'region': '中国'
        }
        response = requests.post(
            api_base_url,
            json=factory_data,
            headers={'Authorization': f'Bearer {user_token}'}
        )
        assert response.status_code == 403, "非管理员应该被拒绝"
    
    def test_create_factory_success(self, admin_token, api_base_url):
        """测试创建工厂成功"""
        factory_data = {
            'code': f'F{uuid.uuid4().hex[:6].upper()}',
            'name': f'工厂_{uuid.uuid4().hex[:8]}',
            'region': '中国'
        }
        response = requests.post(
            api_base_url,
            json=factory_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert response.status_code == 201, f"创建失败: {response.text}"
        data = response.json()
        assert 'id' in data
        assert data['code'] == factory_data['code']
        assert data['is_active'] == True
    
    def test_create_factory_with_duplicate_code(self, admin_token, api_base_url):
        """测试创建重复 code 的工厂应该失败"""
        unique_code = f'F{uuid.uuid4().hex[:6].upper()}'
        factory1 = {'code': unique_code, 'name': f'工厂1_{uuid.uuid4().hex[:6]}', 'region': '中国'}
        requests.post(api_base_url, json=factory1, headers={'Authorization': f'Bearer {admin_token}'})
        
        factory2 = {'code': unique_code, 'name': f'工厂2_{uuid.uuid4().hex[:6]}', 'region': '德国'}
        response = requests.post(api_base_url, json=factory2, headers={'Authorization': f'Bearer {admin_token}'})
        
        assert response.status_code == 400, "重复的 code 应该返回 400"
    
    def test_list_factories_excludes_deleted(self, admin_token, api_base_url):
        """测试列表查询默认排除已删除的工厂"""
        factory_ids = []
        for i in range(2):
            factory_data = {
                'code': f'LIST{uuid.uuid4().hex[:5].upper()}',
                'name': f'工厂{i+1}_{uuid.uuid4().hex[:8]}',
                'region': '中国'
            }
            create_resp = requests.post(api_base_url, json=factory_data, headers={'Authorization': f'Bearer {admin_token}'})
            factory_ids.append(create_resp.json()['id'])
        
        # 删除第一个
        requests.delete(f"{api_base_url}/{factory_ids[0]}", headers={'Authorization': f'Bearer {admin_token}'})
        
        # 查询列表
        list_resp = requests.get(api_base_url, headers={'Authorization': f'Bearer {admin_token}'})
        assert list_resp.status_code == 200
        factories = list_resp.json()['factories']
        factory_ids_in_list = [f['id'] for f in factories]
        
        assert factory_ids[0] not in factory_ids_in_list
        assert factory_ids[1] in factory_ids_in_list
    
    def test_get_factory_by_id(self, admin_token, api_base_url):
        """测试通过 ID 查询工厂详情"""
        create_data = {
            'code': f'GET{uuid.uuid4().hex[:6].upper()}',
            'name': f'测试工厂_{uuid.uuid4().hex[:8]}',
            'region': '中国'
        }
        create_resp = requests.post(api_base_url, json=create_data, headers={'Authorization': f'Bearer {admin_token}'})
        factory_id = create_resp.json()['id']
        
        get_resp = requests.get(f"{api_base_url}/{factory_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert get_resp.status_code == 200
        factory = get_resp.json()
        assert factory['id'] == factory_id
        assert factory['name'] == create_data['name']
    
    def test_update_factory_success(self, admin_token, api_base_url):
        """测试更新工厂成功"""
        create_data = {
            'code': f'UPD{uuid.uuid4().hex[:6].upper()}',
            'name': f'原始名字_{uuid.uuid4().hex[:8]}',
            'region': '中国'
        }
        create_resp = requests.post(api_base_url, json=create_data, headers={'Authorization': f'Bearer {admin_token}'})
        factory_id = create_resp.json()['id']
        
        update_data = {'name': '更新后的名字', 'region': '德国'}
        update_resp = requests.put(f"{api_base_url}/{factory_id}", json=update_data, headers={'Authorization': f'Bearer {admin_token}'})
        
        assert update_resp.status_code == 200
        updated = update_resp.json()
        assert updated['name'] == update_data['name']
        assert updated['region'] == update_data['region']
        assert updated['code'] == create_data['code']  # 未更新的字段保持不变
    
    def test_update_nonexistent_factory(self, admin_token, api_base_url):
        """测试更新不存在的工厂应该返回 404"""
        response = requests.put(f"{api_base_url}/999999", json={'name': '不存在'}, headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 404
    
    def test_soft_delete_factory(self, admin_token, api_base_url):
        """测试软删除工厂"""
        create_data = {
            'code': f'DEL{uuid.uuid4().hex[:6].upper()}',
            'name': f'待删除_{uuid.uuid4().hex[:8]}',
            'region': '中国'
        }
        create_resp = requests.post(api_base_url, json=create_data, headers={'Authorization': f'Bearer {admin_token}'})
        factory_id = create_resp.json()['id']
        
        delete_resp = requests.delete(f"{api_base_url}/{factory_id}", headers={'Authorization': f'Bearer {admin_token}'})
        assert delete_resp.status_code == 200
        assert '删除' in delete_resp.json()['message']
    
    def test_delete_nonexistent_factory(self, admin_token, api_base_url):
        """测试删除不存在的工厂应该返回 404"""
        response = requests.delete(f"{api_base_url}/999999", headers={'Authorization': f'Bearer {admin_token}'})
        assert response.status_code == 404
