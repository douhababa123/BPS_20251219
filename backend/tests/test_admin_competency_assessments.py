"""
测试 competency_assessments 管理 API
"""
import pytest
import requests
from datetime import date

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


@pytest.fixture(scope="module")
def test_employee_id():
    """获取测试用 employee_id"""
    # 使用现有数据中的 employee_id
    return "8203FF1B-04B8-4455-AC42-E55928C99B96"


@pytest.fixture(scope="module")
def test_skill_id():
    """获取测试用 skill_id"""
    # 使用现有数据中的 skill_id
    return 73


def test_create_requires_admin(user_token, test_employee_id, test_skill_id):
    """测试创建需要管理员权限"""
    response = requests.post(
        f"{BASE_URL}/competency-assessments",
        json={
            "employee_id": test_employee_id,
            "skill_id": test_skill_id,
            "current_level": 3,
            "target_level": 4
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 403


def test_create_success(admin_token, test_employee_id, test_skill_id):
    """测试成功创建评估"""
    # 先删除可能存在的记录（避免唯一约束冲突）
    existing = requests.get(
        f"{BASE_URL}/competency-assessments?employee_id={test_employee_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    for item in existing.json():
        if item["skill_id"] == test_skill_id and item.get("assessment_year") == 2025:
            requests.delete(
                f"{BASE_URL}/competency-assessments/{item['id']}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
    
    # 创建新评估（使用 2025 年避免与现有数据冲突）
    response = requests.post(
        f"{BASE_URL}/competency-assessments",
        json={
            "employee_id": test_employee_id,
            "skill_id": test_skill_id,
            "current_level": 2,
            "target_level": 3,
            "assessment_year": 2025,
            "assessment_date": "2025-01-15",
            "notes": "Test assessment"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["employee_id"].lower() == test_employee_id.lower()
    assert data["skill_id"] == test_skill_id
    assert data["current_level"] == 2
    assert data["target_level"] == 3
    assert data["gap"] == 1  # gap is computed


def test_create_invalid_employee(admin_token, test_skill_id):
    """测试创建时 employee_id 无效"""
    response = requests.post(
        f"{BASE_URL}/competency-assessments",
        json={
            "employee_id": "00000000-0000-0000-0000-000000000000",
            "skill_id": test_skill_id,
            "current_level": 3,
            "target_level": 4
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 400
    assert "employee_id" in response.json()["detail"].lower()


def test_create_invalid_skill(admin_token, test_employee_id):
    """测试创建时 skill_id 无效"""
    response = requests.post(
        f"{BASE_URL}/competency-assessments",
        json={
            "employee_id": test_employee_id,
            "skill_id": 99999,
            "current_level": 3,
            "target_level": 4
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 400
    assert "skill_id" in response.json()["detail"].lower()


def test_list_assessments(admin_token):
    """测试获取评估列表"""
    response = requests.get(
        f"{BASE_URL}/competency-assessments",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_list_by_employee(admin_token, test_employee_id):
    """测试按员工筛选"""
    response = requests.get(
        f"{BASE_URL}/competency-assessments?employee_id={test_employee_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for item in data:
        assert item["employee_id"] == test_employee_id


def test_get_by_id(admin_token):
    """测试通过 ID 获取评估"""
    # 先获取列表
    response = requests.get(
        f"{BASE_URL}/competency-assessments",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assessments = response.json()
    assert len(assessments) > 0
    
    # 获取第一个评估
    assessment_id = assessments[0]["id"]
    response = requests.get(
        f"{BASE_URL}/competency-assessments/{assessment_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"].lower() == assessment_id.lower()


def test_update_success(admin_token):
    """测试更新评估"""
    # 先获取一个评估
    response = requests.get(
        f"{BASE_URL}/competency-assessments",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assessments = response.json()
    assessment_id = assessments[0]["id"]
    
    # 更新评估（不包含 gap，它是计算列）
    response = requests.put(
        f"{BASE_URL}/competency-assessments/{assessment_id}",
        json={
            "current_level": 2,
            "target_level": 3,
            "notes": "Updated assessment"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["current_level"] == 2
    assert data["target_level"] == 3


def test_delete_assessment(admin_token):
    """测试删除评估"""
    # 先创建一个评估
    response = requests.get(
        f"{BASE_URL}/competency-assessments",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assessments = response.json()
    if len(assessments) > 0:
        assessment_id = assessments[-1]["id"]
        
        # 删除评估
        response = requests.delete(
            f"{BASE_URL}/competency-assessments/{assessment_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
