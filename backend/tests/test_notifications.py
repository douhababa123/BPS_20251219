"""
通知系统测试
测试 GET /api/notifications/ / POST /api/notifications/{id}/read / POST /api/notifications/read-all
"""
import pytest
import requests
import uuid

API = "http://localhost:8000/api"


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


# ============================================================================
# 1. 获取通知列表
# ============================================================================

class TestGetNotifications:

    def test_requires_auth(self):
        """未登录不能获取通知 → 403（FastAPI HTTPBearer 无凭证返回 403）"""
        resp = requests.get(f"{API}/notifications/")
        assert resp.status_code == 403

    def test_returns_notification_list_structure(self, admin_token):
        """返回结构包含 notifications 列表和 unread_count"""
        resp = requests.get(f"{API}/notifications/", headers=auth(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)

    def test_unread_count_matches_list(self, admin_token):
        """unread_count 应等于 is_read=false 的通知数量"""
        resp = requests.get(f"{API}/notifications/", headers=auth(admin_token))
        data = resp.json()
        unread_in_list = sum(1 for n in data["notifications"] if not n["is_read"])
        assert data["unread_count"] == unread_in_list

    def test_notification_fields(self, admin_token):
        """每条通知必须包含必要字段"""
        resp = requests.get(f"{API}/notifications/", headers=auth(admin_token))
        data = resp.json()
        required_fields = {"id", "user_id", "type", "title", "body", "is_read"}
        for notif in data["notifications"]:
            assert required_fields.issubset(notif.keys()), \
                f"通知缺少字段: {required_fields - notif.keys()}"

    def test_different_users_see_own_notifications(self, admin_token, user_token):
        """不同用户只能看到自己的通知"""
        admin_resp = requests.get(f"{API}/notifications/", headers=auth(admin_token))
        user_resp = requests.get(f"{API}/notifications/", headers=auth(user_token))
        assert admin_resp.status_code == 200
        assert user_resp.status_code == 200

        admin_user_ids = {n["user_id"] for n in admin_resp.json()["notifications"]}
        user_user_ids = {n["user_id"] for n in user_resp.json()["notifications"]}
        # 两者不应有交集（除非同一人）
        assert admin_user_ids.isdisjoint(user_user_ids) or len(admin_user_ids) == 0 or len(user_user_ids) == 0


# ============================================================================
# 2. 标记单条已读
# ============================================================================

class TestMarkSingleRead:

    def test_mark_nonexistent_returns_404(self, admin_token):
        """不存在的通知 ID → 404"""
        fake_id = str(uuid.uuid4())
        resp = requests.post(f"{API}/notifications/{fake_id}/read", headers=auth(admin_token))
        assert resp.status_code == 404

    def test_mark_read_requires_auth(self):
        """未登录不能标记已读 → 403（FastAPI HTTPBearer 无凭证返回 403）"""
        fake_id = str(uuid.uuid4())
        resp = requests.post(f"{API}/notifications/{fake_id}/read")
        assert resp.status_code == 403

    def test_mark_read_after_workflow_creates_notification(self, admin_token):
        """
        触发审批流程会产生通知，然后标记该通知为已读。
        前提: 存在至少一条未读通知。
        """
        resp = requests.get(f"{API}/notifications/", headers=auth(admin_token))
        notifications = resp.json()["notifications"]
        unread = [n for n in notifications if not n["is_read"]]

        if not unread:
            pytest.skip("当前 admin 账号无未读通知，跳过此测试（需先触发工作流）")

        notif_id = unread[0]["id"]

        # 标记已读
        mark_resp = requests.post(f"{API}/notifications/{notif_id}/read",
                                  headers=auth(admin_token))
        assert mark_resp.status_code == 200

        # 再次查询，确认已读
        resp2 = requests.get(f"{API}/notifications/", headers=auth(admin_token))
        notif_after = next(
            (n for n in resp2.json()["notifications"] if n["id"] == notif_id), None
        )
        if notif_after:
            assert notif_after["is_read"] is True


# ============================================================================
# 3. 标记全部已读
# ============================================================================

class TestMarkAllRead:

    def test_mark_all_read_requires_auth(self):
        """未登录不能标记全部已读 → 403（FastAPI HTTPBearer 无凭证返回 403）"""
        resp = requests.post(f"{API}/notifications/read-all")
        assert resp.status_code == 403

    def test_mark_all_read_success(self, admin_token):
        """标记全部已读后 unread_count 变为 0"""
        # 先标记全部已读
        mark_resp = requests.post(f"{API}/notifications/read-all", headers=auth(admin_token))
        assert mark_resp.status_code == 200

        # 验证 unread_count == 0
        list_resp = requests.get(f"{API}/notifications/", headers=auth(admin_token))
        assert list_resp.json()["unread_count"] == 0

    def test_mark_all_read_idempotent(self, admin_token):
        """重复调用 read-all 不报错"""
        resp1 = requests.post(f"{API}/notifications/read-all", headers=auth(admin_token))
        resp2 = requests.post(f"{API}/notifications/read-all", headers=auth(admin_token))
        assert resp1.status_code == 200
        assert resp2.status_code == 200
