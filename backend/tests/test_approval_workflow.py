"""
审批工作流 端到端测试
测试链路:
  submit (pending_approval) → approve → confirm
  submit (pending_approval) → reject
  approve → employee-reject
"""
import pytest
import requests
import uuid

API = "http://localhost:8000/api"


# ============================================================================
# Fixtures：获取 admin / 普通用户 token，以及创建测试任务的辅助函数
# ============================================================================

@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{API}/auth/login",
                         json={"email": "admin@bosch.com", "password": "Admin1234"})
    assert resp.status_code == 200, f"admin 登录失败: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def user_token():
    resp = requests.post(f"{API}/auth/login",
                         json={"email": "user@bosch.com", "password": "User1234"})
    assert resp.status_code == 200, f"普通用户登录失败: {resp.text}"
    return resp.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def make_pending_task(admin_token: str) -> str:
    """
    直接在数据库层写入一条 status=pending_approval 的任务，
    用于测试 approve/reject 流程（绕过匹配算法）。
    通过 admin tasks API 先创建，再手动改状态。
    """
    task_name = f"TestApproval_{uuid.uuid4().hex[:8]}"
    # 1. 创建 planned 任务
    create_resp = requests.post(
        f"{API}/admin/tasks",
        json={
            "task_name": task_name,
            "task_type": "workshop",
            "task_location": "FDCCh",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
            "status": "planned",
        },
        headers=auth(admin_token),
    )
    assert create_resp.status_code == 201, f"创建任务失败: {create_resp.text}"
    task_id = create_resp.json()["id"]

    # 2. 直接改状态为 pending_approval（通过 PATCH/PUT）
    update_resp = requests.put(
        f"{API}/admin/tasks/{task_id}",
        json={"status": "pending_approval"},
        headers=auth(admin_token),
    )
    assert update_resp.status_code == 200, f"更改状态失败: {update_resp.text}"
    return task_id


def make_planned_task(admin_token: str) -> str:
    """创建一条 status=planned 任务，用于测试工程师 confirm/employee-reject 流程"""
    task_name = f"TestPlanned_{uuid.uuid4().hex[:8]}"
    create_resp = requests.post(
        f"{API}/admin/tasks",
        json={
            "task_name": task_name,
            "task_type": "workshop",
            "task_location": "FDCCh",
            "start_date": "2026-07-01",
            "end_date": "2026-07-03",
            "status": "planned",
        },
        headers=auth(admin_token),
    )
    assert create_resp.status_code == 201, f"创建任务失败: {create_resp.text}"
    return create_resp.json()["id"]


# ============================================================================
# 1. approve 端点
# ============================================================================

class TestApproveTask:

    def test_approve_requires_admin(self, user_token, admin_token):
        """普通用户无法审批 → 403"""
        task_id = make_pending_task(admin_token)
        resp = requests.post(f"{API}/tasks/{task_id}/approve", headers=auth(user_token))
        assert resp.status_code == 403

    def test_approve_success(self, admin_token):
        """admin 审批通过 → status 变为 planned，返回 200"""
        task_id = make_pending_task(admin_token)
        resp = requests.post(f"{API}/tasks/{task_id}/approve", headers=auth(admin_token))
        assert resp.status_code == 200
        assert "审批通过" in resp.json().get("message", "")

        # 验证状态已更新
        get_resp = requests.get(f"{API}/admin/tasks/{task_id}", headers=auth(admin_token))
        assert get_resp.json()["status"] == "planned"

    def test_approve_wrong_status(self, admin_token):
        """非 pending_approval 状态调用 approve → 400"""
        task_id = make_planned_task(admin_token)  # status=planned
        resp = requests.post(f"{API}/tasks/{task_id}/approve", headers=auth(admin_token))
        assert resp.status_code == 400

    def test_approve_nonexistent_task(self, admin_token):
        """不存在的任务 → 404"""
        fake_id = str(uuid.uuid4())
        resp = requests.post(f"{API}/tasks/{fake_id}/approve", headers=auth(admin_token))
        assert resp.status_code == 404


# ============================================================================
# 2. reject 端点
# ============================================================================

class TestRejectTask:

    def test_reject_requires_admin(self, user_token, admin_token):
        """普通用户无法拒绝 → 403"""
        task_id = make_pending_task(admin_token)
        resp = requests.post(
            f"{API}/tasks/{task_id}/reject",
            json={"rejection_reason": "测试拒绝"},
            headers=auth(user_token),
        )
        assert resp.status_code == 403

    def test_reject_requires_reason(self, admin_token):
        """拒绝时不填原因 → 400"""
        task_id = make_pending_task(admin_token)
        resp = requests.post(
            f"{API}/tasks/{task_id}/reject",
            json={},  # 无 rejection_reason
            headers=auth(admin_token),
        )
        assert resp.status_code == 400

    def test_reject_empty_reason(self, admin_token):
        """拒绝时填空字符串 → 400"""
        task_id = make_pending_task(admin_token)
        resp = requests.post(
            f"{API}/tasks/{task_id}/reject",
            json={"rejection_reason": "   "},
            headers=auth(admin_token),
        )
        assert resp.status_code == 400

    def test_reject_success(self, admin_token):
        """admin 拒绝 → status=rejected，rejection_reason 已写入"""
        task_id = make_pending_task(admin_token)
        reason = "资源不足，暂不安排"
        resp = requests.post(
            f"{API}/tasks/{task_id}/reject",
            json={"rejection_reason": reason},
            headers=auth(admin_token),
        )
        assert resp.status_code == 200
        assert "拒绝" in resp.json().get("message", "")

        get_resp = requests.get(f"{API}/admin/tasks/{task_id}", headers=auth(admin_token))
        data = get_resp.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == reason

    def test_reject_wrong_status(self, admin_token):
        """非 pending_approval 状态调用 reject → 400"""
        task_id = make_planned_task(admin_token)
        resp = requests.post(
            f"{API}/tasks/{task_id}/reject",
            json={"rejection_reason": "测试"},
            headers=auth(admin_token),
        )
        assert resp.status_code == 400


# ============================================================================
# 3. confirm 端点（工程师确认）
# ============================================================================

class TestConfirmTask:

    def test_confirm_wrong_status(self, admin_token):
        """非 planned 状态调用 confirm → 400"""
        task_id = make_pending_task(admin_token)  # pending_approval
        resp = requests.post(f"{API}/tasks/{task_id}/confirm", headers=auth(admin_token))
        assert resp.status_code == 400

    def test_confirm_success_by_admin(self, admin_token):
        """admin 可以确认任意 planned 任务"""
        task_id = make_planned_task(admin_token)
        resp = requests.post(f"{API}/tasks/{task_id}/confirm", headers=auth(admin_token))
        assert resp.status_code == 200
        assert "确认" in resp.json().get("message", "")

        get_resp = requests.get(f"{API}/admin/tasks/{task_id}", headers=auth(admin_token))
        assert get_resp.json()["status"] == "confirmed"

    def test_confirm_nonexistent_task(self, admin_token):
        fake_id = str(uuid.uuid4())
        resp = requests.post(f"{API}/tasks/{fake_id}/confirm", headers=auth(admin_token))
        assert resp.status_code == 404


# ============================================================================
# 4. employee-reject 端点（工程师拒绝）
# ============================================================================

class TestEmployeeRejectTask:

    def test_employee_reject_requires_reason(self, admin_token):
        """不填原因 → 400"""
        task_id = make_planned_task(admin_token)
        resp = requests.post(
            f"{API}/tasks/{task_id}/employee-reject",
            json={},
            headers=auth(admin_token),
        )
        assert resp.status_code == 400

    def test_employee_reject_success_by_admin(self, admin_token):
        """admin 可代为执行 employee-reject"""
        task_id = make_planned_task(admin_token)
        reason = "时间冲突，无法接受"
        resp = requests.post(
            f"{API}/tasks/{task_id}/employee-reject",
            json={"rejection_reason": reason},
            headers=auth(admin_token),
        )
        assert resp.status_code == 200

        get_resp = requests.get(f"{API}/admin/tasks/{task_id}", headers=auth(admin_token))
        data = get_resp.json()
        assert data["status"] == "employee_rejected"
        assert data["rejection_reason"] == reason
        assert data["rejected_by"] == "employee"

    def test_employee_reject_wrong_status(self, admin_token):
        """非 planned 状态 → 400"""
        task_id = make_pending_task(admin_token)  # pending_approval
        resp = requests.post(
            f"{API}/tasks/{task_id}/employee-reject",
            json={"rejection_reason": "测试"},
            headers=auth(admin_token),
        )
        assert resp.status_code == 400


# ============================================================================
# 5. 完整审批链路
# ============================================================================

class TestFullWorkflowChain:

    def test_submit_approve_confirm_chain(self, admin_token):
        """完整链路: pending_approval → planned → confirmed"""
        # 手动构造 pending_approval 任务
        task_id = make_pending_task(admin_token)

        # 审批通过
        approve_resp = requests.post(f"{API}/tasks/{task_id}/approve", headers=auth(admin_token))
        assert approve_resp.status_code == 200

        # 工程师确认
        confirm_resp = requests.post(f"{API}/tasks/{task_id}/confirm", headers=auth(admin_token))
        assert confirm_resp.status_code == 200

        # 最终状态
        final = requests.get(f"{API}/admin/tasks/{task_id}", headers=auth(admin_token)).json()
        assert final["status"] == "confirmed"

    def test_submit_reject_chain(self, admin_token):
        """链路: pending_approval → rejected"""
        task_id = make_pending_task(admin_token)

        reject_resp = requests.post(
            f"{API}/tasks/{task_id}/reject",
            json={"rejection_reason": "人力不足"},
            headers=auth(admin_token),
        )
        assert reject_resp.status_code == 200

        final = requests.get(f"{API}/admin/tasks/{task_id}", headers=auth(admin_token)).json()
        assert final["status"] == "rejected"
        assert final["rejection_reason"] == "人力不足"

    def test_submit_approve_employee_reject_chain(self, admin_token):
        """链路: pending_approval → planned → employee_rejected"""
        task_id = make_pending_task(admin_token)

        requests.post(f"{API}/tasks/{task_id}/approve", headers=auth(admin_token))

        emp_reject_resp = requests.post(
            f"{API}/tasks/{task_id}/employee-reject",
            json={"rejection_reason": "技能不匹配"},
            headers=auth(admin_token),
        )
        assert emp_reject_resp.status_code == 200

        final = requests.get(f"{API}/admin/tasks/{task_id}", headers=auth(admin_token)).json()
        assert final["status"] == "employee_rejected"
