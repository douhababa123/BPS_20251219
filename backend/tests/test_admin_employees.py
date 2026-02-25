"""
员工管理 API 测试用例
Phase 3.2: employees 表 CRUD API + 审计日志集成

测试范围：
1. 创建员工（记录审计日志，验证 department_id）
2. 更新员工（记录字段级审计日志）
3. 软删除员工（记录审计日志）
4. 查询员工列表
5. 权限验证（仅管理员可操作）
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
    return "http://localhost:8000/api/admin/employees"


@pytest.fixture
def test_department_id():
    """创建测试部门并返回其 ID"""
    with db.get_cursor() as cursor:
        # 查找或创建测试部门
        cursor.execute("""
            SELECT id FROM dbo.departments 
            WHERE code = 'TEST_DEPT' AND is_active = 1
        """)
        dept = cursor.fetchone()
        
        if dept:
            return dept[0]
        
        # 创建新部门
        cursor.execute("""
            INSERT INTO dbo.departments (name, code, description)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?)
        """, ('测试部门', 'TEST_DEPT', '用于员工测试'))
        
        return cursor.fetchone()[0]


# ============================================================================
# 测试用例
# ============================================================================

class TestAdminEmployees:
    """员工管理 API 测试类"""
    
    def test_create_employee_requires_admin(self, user_token, api_base_url, test_department_id):
        """测试创建员工需要管理员权限"""
        emp_data = {
            'employee_id': 'EMP001',
            'name': '测试员工',
            'department_id': test_department_id
        }
        
        response = requests.post(
            api_base_url,
            json=emp_data,
            headers={'Authorization': f'Bearer {user_token}'}
        )
        
        assert response.status_code == 403, "非管理员应该被拒绝"
    
    def test_create_employee_success(self, admin_token, api_base_url, test_department_id):
        """测试创建员工成功"""
        emp_data = {
            'employee_id': f'EMP{uuid.uuid4().hex[:6].upper()}',
            'name': f'测试员工_{uuid.uuid4().hex[:8]}',
            'department_id': test_department_id,
            'email': f'test{uuid.uuid4().hex[:6]}@bosch.com',
            'position': '工程师'
        }
        
        response = requests.post(
            api_base_url,
            json=emp_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 201, f"创建失败: {response.text}"
        
        data = response.json()
        assert 'id' in data
        assert data['employee_id'] == emp_data['employee_id']
        assert data['name'] == emp_data['name']
        assert data['is_active'] == True
        
        # 验证审计日志
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) FROM dbo.data_audit_logs
                WHERE table_name = 'employees' 
                AND record_id = ?
                AND operation_type = 'INSERT'
            """, (data['id'],))
            
            assert cursor.fetchone()[0] > 0, "应该记录审计日志"
    
    def test_create_employee_with_invalid_department(self, admin_token, api_base_url):
        """测试创建员工时部门不存在应该失败"""
        emp_data = {
            'employee_id': f'EMP{uuid.uuid4().hex[:6].upper()}',
            'name': '测试员工',
            'department_id': 999999  # 不存在的部门
        }
        
        response = requests.post(
            api_base_url,
            json=emp_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 400, "无效的部门应该返回 400"
        assert '部门' in response.text or 'department' in response.text.lower()
    
    def test_update_employee_success(self, admin_token, api_base_url, test_department_id):
        """测试更新员工成功"""
        # 1. 创建测试员工
        create_data = {
            'employee_id': f'EMP{uuid.uuid4().hex[:6].upper()}',
            'name': f'原始名字_{uuid.uuid4().hex[:8]}',
            'department_id': test_department_id
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        emp_id = create_resp.json()['id']
        
        # 2. 更新员工
        update_data = {
            'name': f'新名字_{uuid.uuid4().hex[:8]}',
            'position': '高级工程师'
        }
        response = requests.put(
            f"{api_base_url}/{emp_id}",
            json=update_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200, f"更新失败: {response.text}"
        
        data = response.json()
        assert data['name'] == update_data['name']
        assert data['position'] == update_data['position']
        
        # 3. 验证字段级审计日志
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT field_name FROM dbo.data_audit_logs
                WHERE table_name = 'employees' 
                AND record_id = ?
                AND operation_type = 'UPDATE'
            """, (emp_id,))
            
            field_names = [row[0] for row in cursor.fetchall()]
            assert 'name' in field_names, "应该记录 name 字段变更"
            assert 'position' in field_names, "应该记录 position 字段变更"
    
    def test_soft_delete_employee(self, admin_token, api_base_url, test_department_id):
        """测试软删除员工（设置 is_active=false）"""
        # 1. 创建测试员工
        create_data = {
            'employee_id': f'EMP{uuid.uuid4().hex[:6].upper()}',
            'name': f'待删除_{uuid.uuid4().hex[:8]}',
            'department_id': test_department_id
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        emp_id = create_resp.json()['id']
        
        # 2. 软删除员工
        response = requests.delete(
            f"{api_base_url}/{emp_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200, f"删除失败: {response.text}"
        
        # 3. 验证数据库中 is_active 已设置为 false
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT is_active
                FROM dbo.employees
                WHERE id = ?
            """, (emp_id,))
            
            is_active = cursor.fetchone()[0]
            assert is_active == False, "is_active 应该为 False"
        
        # 4. 验证审计日志
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) FROM dbo.data_audit_logs
                WHERE table_name = 'employees' 
                AND record_id = ?
                AND operation_type = 'DELETE'
            """, (emp_id,))
            
            assert cursor.fetchone()[0] > 0, "应该记录删除审计日志"
    
    def test_list_employees_excludes_deleted(self, admin_token, api_base_url, test_department_id):
        """测试列表查询默认排除已删除的员工"""
        # 1. 创建 2 个员工
        emp_ids = []
        for i in range(2):
            create_data = {
                'employee_id': f'EMP{uuid.uuid4().hex[:6].upper()}',
                'name': f'员工{i+1}_{uuid.uuid4().hex[:8]}',
                'department_id': test_department_id
            }
            create_resp = requests.post(
                api_base_url,
                json=create_data,
                headers={'Authorization': f'Bearer {admin_token}'}
            )
            emp_ids.append(create_resp.json()['id'])
        
        # 2. 删除第一个员工
        requests.delete(
            f"{api_base_url}/{emp_ids[0]}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        # 3. 列表查询（默认不包含已删除）
        response = requests.get(
            api_base_url,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        emp_list = data['employees']
        active_emp_ids = [emp['id'] for emp in emp_list]
        
        assert emp_ids[0] not in active_emp_ids, "已删除的员工不应出现在列表中"
        assert emp_ids[1] in active_emp_ids, "活跃员工应该出现在列表中"
        
        # 4. 查询包含已删除的员工
        response_with_deleted = requests.get(
            f"{api_base_url}?include_inactive=true",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response_with_deleted.status_code == 200
        data_with_deleted = response_with_deleted.json()
        
        all_emp_ids = [emp['id'] for emp in data_with_deleted['employees']]
        assert emp_ids[0] in all_emp_ids, "包含已删除时应该显示被删除的员工"
    
    def test_get_employee_by_id(self, admin_token, api_base_url, test_department_id):
        """测试通过 ID 查询员工详情"""
        # 1. 创建测试员工
        create_data = {
            'employee_id': f'EMP{uuid.uuid4().hex[:6].upper()}',
            'name': f'测试员工_{uuid.uuid4().hex[:8]}',
            'department_id': test_department_id,
            'position': '测试工程师'
        }
        create_resp = requests.post(
            api_base_url,
            json=create_data,
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        emp_id = create_resp.json()['id']
        
        # 2. 查询员工详情
        response = requests.get(
            f"{api_base_url}/{emp_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data['id'] == emp_id
        assert data['employee_id'] == create_data['employee_id']
        assert data['name'] == create_data['name']
        assert data['position'] == create_data['position']
    
    def test_create_employee_with_duplicate_employee_id(self, admin_token, api_base_url, test_department_id):
        """测试创建重复 employee_id 的员工应该失败"""
        unique_emp_id = f'EMP{uuid.uuid4().hex[:6].upper()}'
        
        # 1. 创建第一个员工
        name1 = f'Employee1_{uuid.uuid4().hex[:6]}'
        requests.post(
            api_base_url,
            json={'employee_id': unique_emp_id, 'name': name1, 'department_id': test_department_id},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        # 2. 尝试创建相同 employee_id 的员工
        name2 = f'Employee2_{uuid.uuid4().hex[:6]}'
        response = requests.post(
            api_base_url,
            json={'employee_id': unique_emp_id, 'name': name2, 'department_id': test_department_id},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 400, "重复的 employee_id 应该返回 400"
        # 支持中英文错误消息
        response_text_lower = response.text.lower()
        assert ('employee_id' in response_text_lower or 
                'duplicate' in response_text_lower or 
                '员工编号' in response.text or 
                '已存在' in response.text), "错误消息应包含相关关键词"
    
    def test_update_nonexistent_employee(self, admin_token, api_base_url):
        """测试更新不存在的员工应该返回 404"""
        fake_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{api_base_url}/{fake_id}",
            json={'name': '新名称'},
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 404, "不存在的员工应该返回 404"
    
    def test_delete_nonexistent_employee(self, admin_token, api_base_url):
        """测试删除不存在的员工应该返回 404"""
        fake_id = str(uuid.uuid4())
        
        response = requests.delete(
            f"{api_base_url}/{fake_id}",
            headers={'Authorization': f'Bearer {admin_token}'}
        )
        
        assert response.status_code == 404, "不存在的员工应该返回 404"
