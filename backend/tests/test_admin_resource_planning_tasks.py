"""
测试资源规划任务 Admin CRUD 端点
"""
import pytest
from datetime import date, datetime
import requests
from uuid import uuid4

# 基础 URL
BASE_URL = "http://localhost:8000/api"

# Admin 凭证
ADMIN_EMAIL = "admin@bosch.com"
ADMIN_PASSWORD = "Admin1234"

# User 凭证 (用于验证权限)
USER_EMAIL = "user@bosch.com"
USER_PASSWORD = "User1234"


@pytest.fixture(scope="module")
def admin_token():
    """获取 admin JWT token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200
    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def user_token():
    """获取普通用户 JWT token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": USER_EMAIL,
        "password": USER_PASSWORD
    })
    assert response.status_code == 200
    data = response.json()
    return data["access_token"]


@pytest.fixture(scope="module")
def valid_employee_id(admin_token):
    """获取一个有效的员工 ID"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/admin/employees", headers=headers)
    assert response.status_code == 200
    data = response.json()
    employees = data.get("employees", [])
    assert len(employees) > 0, "需要至少一个员工记录"
    return employees[0]["id"]


def test_create_requires_admin(user_token, valid_employee_id):
    """验证创建资源规划任务需要管理员权限"""
    headers = {"Authorization": f"Bearer {user_token}"}
    data = {
        "employee_id": valid_employee_id,
        "task_type_code": "TEST",
        "start_date": "2025-12-01",
        "end_date": "2025-12-01",
        "topic": "Test Topic",
        "location": "Test Location"
    }
    response = requests.post(f"{BASE_URL}/admin/resource-planning-tasks", json=data, headers=headers)
    assert response.status_code == 403


def test_create_success(admin_token, valid_employee_id):
    """测试成功创建资源规划任务"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    data = {
        "employee_id": valid_employee_id,
        "task_type_code": "WS",
        "start_week": "CW50",
        "end_week": "CW50",
        "start_date": "2025-12-15",
        "end_date": "2025-12-15",
        "topic": "Workshop Test",
        "location": "Test Factory",
        "notes": "This is a test task",
        "task_date": "2025-12-15",
        "year_month": "2025-12",
        "cw_week": "CW50",
        "day_of_month": 15,
        "task_type": "WS"
    }
    response = requests.post(f"{BASE_URL}/admin/resource-planning-tasks", json=data, headers=headers)
    assert response.status_code == 200
    result = response.json()
    assert result["employee_id"].lower() == valid_employee_id.lower()
    assert result["task_type_code"] == "WS"
    assert result["topic"] == "Workshop Test"
    assert "id" in result


def test_create_invalid_employee(admin_token):
    """测试使用无效员工 ID 创建任务"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    fake_employee_id = str(uuid4())
    data = {
        "employee_id": fake_employee_id,
        "task_type_code": "P",
        "start_date": "2025-12-01",
        "end_date": "2025-12-01",
        "topic": "Invalid Test"
    }
    response = requests.post(f"{BASE_URL}/admin/resource-planning-tasks", json=data, headers=headers)
    assert response.status_code == 400


def test_list_tasks(admin_token):
    """测试获取资源规划任务列表"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/admin/resource-planning-tasks", headers=headers)
    assert response.status_code == 200
    tasks = response.json()
    assert isinstance(tasks, list)
    if len(tasks) > 0:
        task = tasks[0]
        assert "id" in task
        assert "employee_id" in task


def test_filter_by_employee(admin_token, valid_employee_id):
    """测试按员工筛选任务"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(
        f"{BASE_URL}/admin/resource-planning-tasks",
        params={"employee_id": valid_employee_id},
        headers=headers
    )
    assert response.status_code == 200
    tasks = response.json()
    assert isinstance(tasks, list)
    for task in tasks:
        assert task["employee_id"].lower() == valid_employee_id.lower()


def test_get_by_id(admin_token):
    """测试根据 ID 获取任务详情"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 先获取列表
    response = requests.get(f"{BASE_URL}/admin/resource-planning-tasks", headers=headers)
    assert response.status_code == 200
    tasks = response.json()
    assert len(tasks) > 0, "需要至少一个任务记录"
    
    task_id = tasks[0]["id"]
    
    # 获取详情
    response = requests.get(f"{BASE_URL}/admin/resource-planning-tasks/{task_id}", headers=headers)
    assert response.status_code == 200
    task = response.json()
    assert task["id"] == task_id


def test_update_success(admin_token, valid_employee_id):
    """测试更新资源规划任务"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 先创建一个任务
    create_data = {
        "employee_id": valid_employee_id,
        "task_type_code": "P",
        "start_date": "2025-12-20",
        "end_date": "2025-12-20",
        "topic": "Original Topic",
        "location": "Original Location"
    }
    response = requests.post(f"{BASE_URL}/admin/resource-planning-tasks", json=create_data, headers=headers)
    assert response.status_code == 200
    created_task = response.json()
    task_id = created_task["id"]
    
    # 更新任务
    update_data = {
        "topic": "Updated Topic",
        "location": "Updated Location",
        "notes": "This task has been updated"
    }
    response = requests.put(f"{BASE_URL}/admin/resource-planning-tasks/{task_id}", json=update_data, headers=headers)
    assert response.status_code == 200
    updated_task = response.json()
    assert updated_task["topic"] == "Updated Topic"
    assert updated_task["location"] == "Updated Location"
    assert updated_task["notes"] == "This task has been updated"


def test_update_nonexistent(admin_token):
    """测试更新不存在的任务"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    fake_id = 999999999
    data = {"topic": "Updated"}
    response = requests.put(f"{BASE_URL}/admin/resource-planning-tasks/{fake_id}", json=data, headers=headers)
    assert response.status_code == 404


def test_delete_task(admin_token, valid_employee_id):
    """测试删除资源规划任务"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 先创建一个任务
    create_data = {
        "employee_id": valid_employee_id,
        "task_type_code": "M",
        "start_date": "2025-12-25",
        "end_date": "2025-12-25",
        "topic": "To Delete",
        "location": "Test"
    }
    response = requests.post(f"{BASE_URL}/admin/resource-planning-tasks", json=create_data, headers=headers)
    assert response.status_code == 200
    created_task = response.json()
    task_id = created_task["id"]
    
    # 删除任务
    response = requests.delete(f"{BASE_URL}/admin/resource-planning-tasks/{task_id}", headers=headers)
    assert response.status_code == 200
    
    # 验证已删除
    response = requests.get(f"{BASE_URL}/admin/resource-planning-tasks/{task_id}", headers=headers)
    assert response.status_code == 404
