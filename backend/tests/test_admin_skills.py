"""
Phase 3.3: skills 表 CRUD API 测试套件
TDD Red Phase - 创建测试（预期失败）

测试覆盖:
1. 权限检查 (admin only)
2. CREATE - 创建技能
3. LIST - 查询技能列表（支持按 module_id 过滤）
4. GET - 查询单个技能
5. UPDATE - 更新技能
6. DELETE - 软删除技能
7. 边界测试 (skill_code 唯一性、不存在的记录)
"""

import pytest
import requests
import uuid


class TestAdminSkills:
    """技能管理 API 测试类"""
    
    @pytest.fixture(scope='class')
    def admin_token(self):
        """获取管理员 token"""
        response = requests.post(
            "http://localhost:8000/api/auth/login",
            json={
                "email": "admin@bosch.com",
                "password": "Admin1234"
            }
        )
        return response.json()['access_token']
    
    @pytest.fixture(scope='class')
    def user_token(self):
        """获取普通用户 token"""
        response = requests.post(
            "http://localhost:8000/api/auth/login",
            json={
                "email": "user@bosch.com",
                "password": "User1234"
            }
        )
        return response.json()['access_token']
    
    @pytest.fixture(scope='class')
    def api_base_url(self):
        """API 基础 URL"""
        return "http://localhost:8000/api/admin/skills"
    
    # ============================================================================
    # 权限测试
    # ============================================================================
    
    def test_create_skill_requires_admin(self, user_token, api_base_url):
        """测试创建技能需要管理员权限"""
        skill_data = {
            'module_id': 1,
            'module_name': 'BPS elements',
            'skill_name': '测试技能',
            'skill_code': 'TEST001',
            'display_order': 999
        }
        
        response = requests.post(
            api_base_url,
            json=skill_data,
            headers={'Authorization': f'Bearer {user_token}'}
        )
        
        assert response.status_code == 403, "非管理员应该被拒绝"
    
    # ============================================================================
    # CREATE 测试
    # ============================================================================
    
    def test_create_skill_success(self, admin_token, api_base_url):
        """测试创建技能成功"""
        skill_data = {
            'module_id': 1,
            'module_name': 'BPS elements',
            'skill_name': f'测试技能_{uuid.uuid4().hex[:8]}',
            'skill_code': f'TEST{uuid.uuid4().hex[:6].upper()}',
            'description': '这是一个测试技能',
            'display_order': 999
        }
        
        response = requests.post(
            api_base_url,
            json=skill_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 201, f"创建失败: {response.text}"
        data = response.json()
        
        # 验证返回数据
        assert 'id' in data
        assert data['skill_name'] == skill_data['skill_name']
        assert data['skill_code'] == skill_data['skill_code']
        assert data['module_id'] == 1
        assert data['is_active'] == True
    
    def test_create_skill_with_duplicate_code(self, admin_token, api_base_url):
        """测试创建重复 skill_code 的技能应该失败"""
        unique_code = f'TEST{uuid.uuid4().hex[:6].upper()}'
        
        # 1. 创建第一个技能
        skill1 = {
            'module_id': 1,
            'module_name': 'BPS elements',
            'skill_name': f'技能1_{uuid.uuid4().hex[:6]}',
            'skill_code': unique_code,
            'display_order': 999
        }
        requests.post(
            api_base_url,
            json=skill1,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        # 2. 尝试创建相同 skill_code 的技能
        skill2 = {
            'module_id': 2,
            'module_name': 'TPM',
            'skill_name': f'技能2_{uuid.uuid4().hex[:6]}',
            'skill_code': unique_code,
            'display_order': 999
        }
        response = requests.post(
            api_base_url,
            json=skill2,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 400, "重复的 skill_code 应该返回 400"
        assert 'skill_code' in response.text.lower() or '已存在' in response.text
    
    # ============================================================================
    # LIST 测试
    # ============================================================================
    
    def test_list_skills_excludes_deleted(self, admin_token, api_base_url):
        """测试列表查询默认排除已删除的技能"""
        # 1. 创建 2 个技能
        skill_ids = []
        for i in range(2):
            skill_data = {
                'module_id': 1,
                'module_name': 'BPS elements',
                'skill_name': f'技能{i+1}_{uuid.uuid4().hex[:8]}',
                'skill_code': f'LIST{uuid.uuid4().hex[:5].upper()}',
                'display_order': 900 + i
            }
            create_resp = requests.post(
                api_base_url,
                json=skill_data,
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            skill_ids.append(create_resp.json()['id'])
        
        # 2. 删除第一个技能
        requests.delete(
            f"{api_base_url}/{skill_ids[0]}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        # 3. 查询列表（默认不包含已删除）
        list_resp = requests.get(
            api_base_url,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert list_resp.status_code == 200
        skills = list_resp.json()['skills']
        skill_ids_in_list = [s['id'] for s in skills]
        
        # 验证：已删除的不在列表中，未删除的在列表中
        assert skill_ids[0] not in skill_ids_in_list, "已删除的技能不应出现"
        assert skill_ids[1] in skill_ids_in_list, "未删除的技能应该出现"
        
        # 4. 使用 include_inactive=true 查询（应该包含已删除）
        list_with_deleted = requests.get(
            f"{api_base_url}?include_inactive=true",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        all_skills = list_with_deleted.json()['skills']
        all_skill_ids = [s['id'] for s in all_skills]
        
        assert skill_ids[0] in all_skill_ids, "include_inactive=true 时应包含已删除技能"
    
    def test_list_skills_filter_by_module(self, admin_token, api_base_url):
        """测试按 module_id 过滤技能列表"""
        # 1. 创建不同模块的技能
        skill_module1 = {
            'module_id': 1,
            'module_name': 'BPS elements',
            'skill_name': f'模块1技能_{uuid.uuid4().hex[:8]}',
            'skill_code': f'M1{uuid.uuid4().hex[:6].upper()}',
            'display_order': 900
        }
        skill_module2 = {
            'module_id': 2,
            'module_name': 'TPM',
            'skill_name': f'模块2技能_{uuid.uuid4().hex[:8]}',
            'skill_code': f'M2{uuid.uuid4().hex[:6].upper()}',
            'display_order': 900
        }
        
        requests.post(api_base_url, json=skill_module1, headers={'Authorization': f'Bearer {admin_token}'})
        requests.post(api_base_url, json=skill_module2, headers={'Authorization': f'Bearer {admin_token}'})
        
        # 2. 按 module_id=1 过滤
        response = requests.get(
            f"{api_base_url}?module_id=1",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200
        skills = response.json()['skills']
        
        # 验证：所有返回的技能都属于 module_id=1
        for skill in skills:
            assert skill['module_id'] == 1, "返回的技能应该都是 module_id=1"
    
    # ============================================================================
    # GET 测试
    # ============================================================================
    
    def test_get_skill_by_id(self, admin_token, api_base_url):
        """测试通过 ID 查询技能详情"""
        # 1. 创建测试技能
        skill_data = {
            'module_id': 1,
            'module_name': 'BPS elements',
            'skill_name': f'测试技能_{uuid.uuid4().hex[:8]}',
            'skill_code': f'GET{uuid.uuid4().hex[:6].upper()}',
            'description': '详情测试',
            'display_order': 999
        }
        create_resp = requests.post(
            api_base_url,
            json=skill_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        skill_id = create_resp.json()['id']
        
        # 2. 查询详情
        get_resp = requests.get(
            f"{api_base_url}/{skill_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert get_resp.status_code == 200
        skill = get_resp.json()
        
        # 验证数据完整性
        assert skill['id'] == skill_id
        assert skill['skill_name'] == skill_data['skill_name']
        assert skill['description'] == skill_data['description']
        assert skill['is_active'] == True
    
    # ============================================================================
    # UPDATE 测试
    # ============================================================================
    
    def test_update_skill_success(self, admin_token, api_base_url):
        """测试更新技能成功"""
        # 1. 创建测试技能
        create_data = {
            'module_id': 1,
            'module_name': 'BPS elements',
            'skill_name': f'原始名字_{uuid.uuid4().hex[:8]}',
            'skill_code': f'UPD{uuid.uuid4().hex[:6].upper()}',
            'display_order': 999
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        skill_id = create_resp.json()['id']
        
        # 2. 更新技能
        update_data = {
            'skill_name': '更新后的名字',
            'description': '新增的描述',
            'display_order': 1000
        }
        update_resp = requests.put(
            f"{api_base_url}/{skill_id}",
            json=update_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert update_resp.status_code == 200
        updated_skill = update_resp.json()
        
        # 验证更新成功
        assert updated_skill['skill_name'] == update_data['skill_name']
        assert updated_skill['description'] == update_data['description']
        assert updated_skill['display_order'] == update_data['display_order']
        
        # 验证未更新的字段保持不变
        assert updated_skill['skill_code'] == create_data['skill_code']
        assert updated_skill['module_id'] == create_data['module_id']
    
    def test_update_nonexistent_skill(self, admin_token, api_base_url):
        """测试更新不存在的技能应该返回 404"""
        update_data = {
            'skill_name': '不存在的技能'
        }
        
        response = requests.put(
            f"{api_base_url}/999999",  # 不存在的 ID
            json=update_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 404, "更新不存在的技能应该返回 404"
    
    # ============================================================================
    # DELETE 测试
    # ============================================================================
    
    def test_soft_delete_skill(self, admin_token, api_base_url):
        """测试软删除技能（设置 is_active=false）"""
        # 1. 创建测试技能
        create_data = {
            'module_id': 1,
            'module_name': 'BPS elements',
            'skill_name': f'待删除_{uuid.uuid4().hex[:8]}',
            'skill_code': f'DEL{uuid.uuid4().hex[:6].upper()}',
            'display_order': 999
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        skill_id = create_resp.json()['id']
        
        # 2. 软删除
        delete_resp = requests.delete(
            f"{api_base_url}/{skill_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert delete_resp.status_code == 200
        assert '删除' in delete_resp.json()['message']
        
        # 3. 验证已标记为删除（查询应该返回 404 或 is_active=false）
        get_resp = requests.get(
            f"{api_base_url}/{skill_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        # 允许返回 404 或者返回数据但 is_active=false
        if get_resp.status_code == 200:
            assert get_resp.json()['is_active'] == False, "已删除的技能应该 is_active=false"
        else:
            assert get_resp.status_code == 404, "已删除的技能应该返回 404"
    
    def test_delete_nonexistent_skill(self, admin_token, api_base_url):
        """测试删除不存在的技能应该返回 404"""
        response = requests.delete(
            f"{api_base_url}/999999",  # 不存在的 ID
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 404, "删除不存在的技能应该返回 404"
