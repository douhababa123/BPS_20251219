"""
测试计划变更通知 Admin CRUD 端点
"""
import pytest
from datetime import datetime
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
def test_data(admin_token):
    """获取测试所需的有效 ID"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 获取员工 ID
    response = requests.get(f"{BASE_URL}/admin/employees", headers=headers)
    assert response.status_code == 200
    employees = response.json().get("employees", [])
    assert len(employees) >= 2, "需要至少两个员工记录"
    
    # 获取任务 ID
    response = requests.get(f"{BASE_URL}/admin/tasks", headers=headers)
    assert response.status_code == 200
    tasks_data = response.json()
    tasks = tasks_data.get("tasks", [])
    assert len(tasks) > 0, "需要至少一个任务记录"
    
    return {
        "affected_employee_id": employees[0]["id"],
        "modified_by_employee_id": employees[1]["id"],
        "task_id": tasks[0]["id"]
    }


def test_create_requires_admin(user_token, test_data):
    """验证创建通知需要管理员权限"""
    headers = {"Authorization": f"Bearer {user_token}"}
    data = {
        "task_id": test_data["task_id"],
        "affected_employee_id": test_data["affected_employee_id"],
        "modified_by_employee_id": test_data["modified_by_employee_id"],
        "notification_type": "CREATED",
        "change_description": "Test notification"
    }
    response = requests.post(f"{BASE_URL}/admin/schedule-change-notifications", json=data, headers=headers)
    assert response.status_code == 403


def test_create_success(admin_token, test_data):
    """测试成功创建通知"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    data = {
        "task_id": test_data["task_id"],
        "affected_employee_id": test_data["affected_employee_id"],
        "modified_by_employee_id": test_data["modified_by_employee_id"],
        "notification_type": "UPDATED",
        "change_description": "Task updated for testing",
        "is_read": False
    }
    response = requests.post(f"{BASE_URL}/admin/schedule-change-notifications", json=data, headers=headers)
    assert response.status_code == 200
    result = response.json()
    assert result["notification_type"] == "UPDATED"
    assert result["change_description"] == "Task updated for testing"
    assert result["is_read"] == False
    assert "id" in result


def test_create_invalid_employee(admin_token, test_data):
    """测试使用无效员工 ID 创建通知"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    fake_employee_id = str(uuid4())
    data = {
        "affected_employee_id": fake_employee_id,
        "modified_by_employee_id": test_data["modified_by_employee_id"],
        "notification_type": "CREATED",
        "change_description": "Invalid test"
    }
    response = requests.post(f"{BASE_URL}/admin/schedule-change-notifications", json=data, headers=headers)
    assert response.status_code == 400


def test_list_notifications(admin_token):
    """测试获取通知列表"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/admin/schedule-change-notifications", headers=headers)
    assert response.status_code == 200
    notifications = response.json()
    assert isinstance(notifications, list)
    if len(notifications) > 0:
        notification = notifications[0]
        assert "id" in notification
        assert "affected_employee_id" in notification
        assert "notification_type" in notification


def test_filter_by_employee(admin_token, test_data):
    """测试按受影响员工筛选通知"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(
        f"{BASE_URL}/admin/schedule-change-notifications",
        params={"affected_employee_id": test_data["affected_employee_id"]},
        headers=headers
    )
    assert response.status_code == 200
    notifications = response.json()
    assert isinstance(notifications, list)
    for notification in notifications:
        assert notification["affected_employee_id"].lower() == test_data["affected_employee_id"].lower()


def test_get_by_id(admin_token):
    """测试根据 ID 获取通知详情"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 先获取列表
    response = requests.get(f"{BASE_URL}/admin/schedule-change-notifications", headers=headers)
    assert response.status_code == 200
    notifications = response.json()
    assert len(notifications) > 0, "需要至少一个通知记录"
    
    notification_id = notifications[0]["id"]
    
    # 获取详情
    response = requests.get(f"{BASE_URL}/admin/schedule-change-notifications/{notification_id}", headers=headers)
    assert response.status_code == 200
    notification = response.json()
    assert notification["id"] == notification_id


def test_update_success(admin_token, test_data):
    """测试更新通知"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 先创建一个通知
    create_data = {
        "affected_employee_id": test_data["affected_employee_id"],
        "modified_by_employee_id": test_data["modified_by_employee_id"],
        "notification_type": "CREATED",
        "change_description": "Original description",
        "is_read": False
    }
    response = requests.post(f"{BASE_URL}/admin/schedule-change-notifications", json=create_data, headers=headers)
    assert response.status_code == 200
    created_notification = response.json()
    notification_id = created_notification["id"]
    
    # 更新通知
    update_data = {
        "is_read": True,
        "change_description": "Updated description"
    }
    response = requests.put(f"{BASE_URL}/admin/schedule-change-notifications/{notification_id}", json=update_data, headers=headers)
    assert response.status_code == 200
    updated_notification = response.json()
    assert updated_notification["is_read"] == True
    assert updated_notification["change_description"] == "Updated description"


def test_update_nonexistent(admin_token):
    """测试更新不存在的通知"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    fake_id = str(uuid4())
    data = {"is_read": True}
    response = requests.put(f"{BASE_URL}/admin/schedule-change-notifications/{fake_id}", json=data, headers=headers)
    assert response.status_code == 404


def test_delete_notification(admin_token, test_data):
    """测试删除通知"""
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 先创建一个通知
    create_data = {
        "affected_employee_id": test_data["affected_employee_id"],
        "modified_by_employee_id": test_data["modified_by_employee_id"],
        "notification_type": "DELETED",
        "change_description": "To be deleted"
    }
    response = requests.post(f"{BASE_URL}/admin/schedule-change-notifications", json=create_data, headers=headers)
    assert response.status_code == 200
    created_notification = response.json()
    notification_id = created_notification["id"]
    
    # 删除通知
    response = requests.delete(f"{BASE_URL}/admin/schedule-change-notifications/{notification_id}", headers=headers)
    assert response.status_code == 200
    
    # 验证已删除
    response = requests.get(f"{BASE_URL}/admin/schedule-change-notifications/{notification_id}", headers=headers)
    assert response.status_code == 404
