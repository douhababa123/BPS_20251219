"""
测试 resource_task_types 管理 API
"""
import pytest
import requests

BASE_URL = "http://localhost:8000/api"


@pytest.fixture(scope="module")
def admin_token():
    """获取管理员 token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@bosch.com",
        "password": "Admin1234"
    })
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def user_token():
    """获取普通用户 token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "user@bosch.com",
        "password": "User1234"
    })
    assert response.status_code == 200
    return response.json()["access_token"]


def test_create_requires_admin(user_token):
    """测试创建需要管理员权限"""
    response = requests.post(
        f"{BASE_URL}/resource-task-types",
        json={
            "code": "TEST",
            "name": "Test Type",
            "color_hex": "#FF0000"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 403


def test_create_success(admin_token):
    """测试成功创建"""
    response = requests.post(
        f"{BASE_URL}/resource-task-types",
        json={
            "code": "PYTEST",
            "name": "PyTest Type",
            "color_hex": "#FF9900",
            "description": "Test resource task type"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "PYTEST"
    assert data["name"] == "PyTest Type"
    assert data["color_hex"] == "#FF9900"


def test_create_duplicate_code(admin_token):
    """测试创建重复 code"""
    response = requests.post(
        f"{BASE_URL}/resource-task-types",
        json={
            "code": "WS",  # 已存在
            "name": "Duplicate",
            "color_hex": "#000000"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 400


def test_list_types(admin_token):
    """测试获取列表"""
    response = requests.get(
        f"{BASE_URL}/resource-task-types",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_by_id(admin_token):
    """测试通过 ID 获取"""
    response = requests.get(
        f"{BASE_URL}/resource-task-types/1",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert "code" in data


def test_update_success(admin_token):
    """测试更新"""
    # 先创建一个用于测试的记录
    create_resp = requests.post(
        f"{BASE_URL}/resource-task-types",
        json={
            "code": "UPD_TEST",
            "name": "Update Test",
            "color_hex": "#AAAAAA"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if create_resp.status_code == 200:
        task_type_id = create_resp.json()["id"]
    else:
        # 如果已存在，查找它
        list_resp = requests.get(
            f"{BASE_URL}/resource-task-types",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        types = [t for t in list_resp.json() if t["code"] == "UPD_TEST"]
        task_type_id = types[0]["id"]
    
    # 更新
    response = requests.put(
        f"{BASE_URL}/resource-task-types/{task_type_id}",
        json={
            "name": "Updated Name",
            "description": "Updated description"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"


def test_update_nonexistent(admin_token):
    """测试更新不存在的记录"""
    response = requests.put(
        f"{BASE_URL}/resource-task-types/99999",
        json={"name": "New Name"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 404


def test_delete_type(admin_token):
    """测试删除（软删除）"""
    # 先创建一个用于测试的记录
    create_resp = requests.post(
        f"{BASE_URL}/resource-task-types",
        json={
            "code": "DEL_TEST",
            "name": "Delete Test",
            "color_hex": "#111111"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    if create_resp.status_code == 200:
        task_type_id = create_resp.json()["id"]
        
        # 删除
        response = requests.delete(
            f"{BASE_URL}/resource-task-types/{task_type_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
