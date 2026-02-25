"""
部门管理 API 测试用例
Phase 3.1: departments 表 CRUD API + 审计日志集成

测试范围：
1. 创建部门（记录审计日志）
2. 更新部门（记录字段级审计日志）
3. 软删除部门（记录审计日志）
4. 查询部门列表
5. 批量删除部门
6. 权限验证（仅管理员可操作）
"""

import pytest
import requests
from database import db
from auth import create_access_token, hash_password
import uuid


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def admin_token():
    """创建管理员 token"""
    with db.get_cursor() as cursor:
        cursor.execute("""
            SELECT id, name, email
            FROM dbo.users
            WHERE email = 'admin@bosch.com'
        """)
        admin = cursor.fetchone()
        
        if not admin:
            cursor.execute("""
                INSERT INTO dbo.users (email, password_hash, name, role)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.email
                VALUES (?, ?, ?, 'admin')
            """, ('admin@bosch.com', hash_password('Admin1234'), '测试管理员'))
            admin = cursor.fetchone()
    
    token = create_access_token({
        'user_id': str(admin[0]),
        'name': admin[1],
        'email': admin[2],
        'role': 'admin'
    })
    return token


@pytest.fixture
def user_token():
    """创建普通用户 token"""
    with db.get_cursor() as cursor:
        cursor.execute("""
            SELECT id, name, email
            FROM dbo.users
            WHERE email = 'user@bosch.com' AND role = 'user'
        """)
        user = cursor.fetchone()
        
        if not user:
            cursor.execute("""
                INSERT INTO dbo.users (email, password_hash, name, role)
                OUTPUT INSERTED.id, INSERTED.name, INSERTED.email
                VALUES (?, ?, ?, 'user')
            """, ('user@bosch.com', hash_password('User1234'), '测试用户'))
            user = cursor.fetchone()
    
    token = create_access_token({
        'user_id': str(user[0]),
        'name': user[1],
        'email': user[2],
        'role': 'user'
    })
    return token


@pytest.fixture
def api_base_url():
    """API 基础 URL"""
    return "http://localhost:8000/api/admin/departments"


# ============================================================================
# Test Class
# ============================================================================

class TestAdminDepartments:
    """部门管理 API 测试"""
    
    def test_create_department_requires_admin(self, user_token, api_base_url):
        """测试创建部门需要管理员权限"""
        response = requests.post(
            api_base_url,
            json={'name': '测试部门', 'code': 'TEST', 'description': '测试'},
            headers={'Authorization': f'Bearer {user_token}'}
        )
        assert response.status_code == 403, "普通用户不能创建部门"
    
    def test_create_department_success(self, admin_token, api_base_url):
        """测试创建部门成功"""
        dept_data = {
            'name': f'测试部门_{uuid.uuid4().hex[:8]}',
            'code': f'TEST{uuid.uuid4().hex[:4].upper()}',
            'description': '这是一个测试部门'
        }
        
        response = requests.post(
            api_base_url,
            json=dept_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 201, f"创建失败: {response.text}"
        data = response.json()
        assert 'id' in data, "返回结果应包含 id"
        assert data['name'] == dept_data['name']
        
        # 验证审计日志已记录
        dept_id = data['id']
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM dbo.data_audit_logs
                WHERE table_name = 'departments'
                    AND record_id = ?
                    AND operation_type = 'INSERT'
            """, (dept_id,))
            count = cursor.fetchone()[0]
            assert count > 0, "应该记录审计日志"
    
    def test_update_department_success(self, admin_token, api_base_url):
        """测试更新部门成功（记录字段级审计日志）"""
        # 1. 创建测试部门
        create_data = {
            'name': f'部门_{uuid.uuid4().hex[:8]}',
            'code': f'D{uuid.uuid4().hex[:4].upper()}',
            'description': '原始描述'
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        dept_id = create_resp.json()['id']
        
        # 2. 更新部门
        update_data = {
            'name': f'更新后_{uuid.uuid4().hex[:8]}',
            'description': '新的描述'
        }
        response = requests.put(
            f"{api_base_url}/{dept_id}",
            json=update_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200, f"更新失败: {response.text}"
        data = response.json()
        assert data['name'] == update_data['name']
        
        # 3. 验证字段级审计日志
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT field_name, old_value, new_value
                FROM dbo.data_audit_logs
                WHERE table_name = 'departments'
                    AND record_id = ?
                    AND operation_type = 'UPDATE'
                ORDER BY operated_at DESC
            """, (dept_id,))
            logs = cursor.fetchall()
            
            # 应该有 name 和 description 两个字段的变更日志
            assert len(logs) >= 2, "应该记录至少 2 条字段变更日志"
            
            field_names = [log[0] for log in logs]
            assert 'name' in field_names, "应该记录 name 字段变更"
            assert 'description' in field_names, "应该记录 description 字段变更"
    
    def test_soft_delete_department(self, admin_token, api_base_url):
        """测试软删除部门（设置 is_active=false）"""
        # 1. 创建测试部门
        create_data = {
            'name': f'待删除_{uuid.uuid4().hex[:8]}',
            'code': f'DEL{uuid.uuid4().hex[:4].upper()}'
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        dept_id = create_resp.json()['id']
        
        # 2. 软删除部门
        response = requests.delete(
            f"{api_base_url}/{dept_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200, f"删除失败: {response.text}"
        
        # 3. 验证数据库中 is_active 已设置为 false
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT is_active
                FROM dbo.departments
                WHERE id = ?
            """, (dept_id,))
            result = cursor.fetchone()
            assert result is not None, "部门记录应该存在"
            assert result[0] == False, "is_active 应该为 false"
        
        # 4. 验证审计日志
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM dbo.data_audit_logs
                WHERE table_name = 'departments'
                    AND record_id = ?
                    AND operation_type = 'DELETE'
            """, (dept_id,))
            count = cursor.fetchone()[0]
            assert count > 0, "应该记录删除审计日志"
    
    def test_list_departments_excludes_deleted(self, admin_token, api_base_url):
        """测试查询部门列表排除已删除的"""
        # 1. 创建 2 个部门
        dept_ids = []
        for i in range(2):
            create_resp = requests.post(
                api_base_url,
                json={
                    'name': f'部门{i}_{uuid.uuid4().hex[:8]}',
                    'code': f'D{i}{uuid.uuid4().hex[:3].upper()}'
                },
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            dept_ids.append(create_resp.json()['id'])
        
        # 2. 删除第一个部门
        requests.delete(
            f"{api_base_url}/{dept_ids[0]}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        # 3. 查询部门列表
        response = requests.get(
            api_base_url,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200
        departments = response.json()['departments']
        
        # 4. 验证已删除的部门不在列表中
        dept_ids_in_list = [d['id'] for d in departments]
        assert dept_ids[0] not in dept_ids_in_list, "已删除的部门不应出现在列表中"
        assert dept_ids[1] in dept_ids_in_list, "未删除的部门应该在列表中"
    
    def test_get_department_by_id(self, admin_token, api_base_url):
        """测试根据 ID 查询部门详情"""
        # 1. 创建测试部门
        create_data = {
            'name': f'详情查询_{uuid.uuid4().hex[:8]}',
            'code': f'DET{uuid.uuid4().hex[:4].upper()}',
            'description': '用于详情查询测试'
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        dept_id = create_resp.json()['id']
        
        # 2. 查询详情
        response = requests.get(
            f"{api_base_url}/{dept_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200
        dept = response.json()
        assert dept['id'] == dept_id
        assert dept['name'] == create_data['name']
        assert dept['code'] == create_data['code']
        assert dept['description'] == create_data['description']
    
    def test_create_department_with_duplicate_code(self, admin_token, api_base_url):
        """测试创建重复 code 的部门应该失败"""
        unique_code = f'DUP{uuid.uuid4().hex[:4].upper()}'
        
        # 1. 创建第一个部门（使用随机名字避免 UNIQUE 约束冲突）
        name1 = f'TestDept1_{uuid.uuid4().hex[:6]}'
        requests.post(
            api_base_url,
            json={'name': name1, 'code': unique_code},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        # 2. 尝试创建相同 code 的部门（使用不同的随机名字）
        name2 = f'TestDept2_{uuid.uuid4().hex[:6]}'
        response = requests.post(
            api_base_url,
            json={'name': name2, 'code': unique_code},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 400, "重复的 code 应该返回 400"
        # 支持中英文错误消息
        response_text_lower = response.text.lower()
        assert ('code' in response_text_lower or 
                'duplicate' in response_text_lower or 
                '代码' in response.text or 
                '已存在' in response.text), "错误消息应包含相关关键词"
    
    def test_update_nonexistent_department(self, admin_token, api_base_url):
        """测试更新不存在的部门应该返回 404"""
        fake_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{api_base_url}/{fake_id}",
            json={'name': '新名称'},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 404, "不存在的部门应该返回 404"
    
    def test_delete_nonexistent_department(self, admin_token, api_base_url):
        """测试删除不存在的部门应该返回 404"""
        fake_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{api_base_url}/{fake_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 404, "不存在的部门应该返回 404"
    
    def test_batch_delete_departments_success(self, admin_token, api_base_url):
        """测试批量删除部门成功"""
        # 1. 创建多个测试部门
        dept_ids = []
        for i in range(3):
            unique_suffix = uuid.uuid4().hex[:6].upper()
            create_data = {
                'name': f'BatchTest_{i}_{unique_suffix}',
                'code': f'BATCH{i}_{unique_suffix}',
                'description': f'测试批量删除 {i}'
            }
            
            response = requests.post(
                api_base_url,
                json=create_data,
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            assert response.status_code == 201
            dept_ids.append(response.json()['id'])
        
        # 2. 批量删除
        response = requests.post(
            f"{api_base_url}/batch-delete",
            json={'ids': dept_ids},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # 验证返回格式
        assert 'deleted' in result
        assert 'failed' in result
        assert 'errors' in result
        assert result['deleted'] == 3, "应该成功删除 3 个部门"
        assert result['failed'] == 0, "不应该有失败"
        assert len(result['errors']) == 0, "不应该有错误"
        
        # 3. 验证部门已被软删除
        for dept_id in dept_ids:
            response = requests.get(
                f"{api_base_url}/{dept_id}",
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            assert response.status_code == 404, "已删除的部门应该返回 404"
    
    def test_batch_delete_with_nonexistent_ids(self, admin_token, api_base_url):
        """测试批量删除包含不存在的 ID"""
        # 1. 创建 1 个有效部门
        unique_suffix = uuid.uuid4().hex[:6].upper()
        create_data = {
            'name': f'ValidDept_{unique_suffix}',
            'code': f'VALID_{unique_suffix}'
        }
        response = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        assert response.status_code == 201
        valid_id = response.json()['id']
        
        # 2. 批量删除（1 个有效 + 2 个无效）
        fake_ids = ['99999', '88888']
        response = requests.post(
            f"{api_base_url}/batch-delete",
            json={'ids': [valid_id] + fake_ids},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # 验证结果
        assert result['deleted'] == 1, "应该成功删除 1 个"
        assert result['failed'] == 2, "应该失败 2 个"
        assert len(result['errors']) == 2, "应该有 2 个错误详情"
        
        # 验证错误详情包含 ID
        error_ids = [err['id'] for err in result['errors']]
        assert '99999' in error_ids
        assert '88888' in error_ids
    
    def test_batch_delete_empty_list(self, admin_token, api_base_url):
        """测试批量删除空列表应该返回 422"""
        response = requests.post(
            f"{api_base_url}/batch-delete",
            json={'ids': []},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 422, "空列表应该返回 422 验证错误"
