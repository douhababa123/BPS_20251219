from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from models import PasswordLoginRequest
from routers import auth as auth_router


def user_row(*, role="admin", is_active=True):
    return (
        "11111111-1111-1111-1111-111111111111",
        "admin@bosch.com",
        "Admin",
        "password-hash",
        role,
        is_active,
        False,
    )


def test_active_admin_can_log_in_without_employee_record(monkeypatch):
    cursor = MagicMock()
    monkeypatch.setattr(auth_router, "_get_active_employee", lambda *_: None)
    monkeypatch.setattr(auth_router, "_get_user_by_email", lambda *_: user_row())
    monkeypatch.setattr(auth_router.auth, "verify_password", lambda *_: True)

    result = auth_router._login_employee_user(
        PasswordLoginRequest(email="admin@bosch.com", password="Admin1234"),
        cursor,
    )

    assert result["role"] == "admin"
    assert result["email"] == "admin@bosch.com"
    cursor.commit.assert_called_once()


def test_non_admin_still_requires_an_active_employee(monkeypatch):
    cursor = MagicMock()
    monkeypatch.setattr(auth_router, "_get_active_employee", lambda *_: None)
    monkeypatch.setattr(
        auth_router,
        "_get_user_by_email",
        lambda *_: user_row(role="user"),
    )

    with pytest.raises(HTTPException) as exc_info:
        auth_router._login_employee_user(
            PasswordLoginRequest(email="user@bosch.com", password="User1234"),
            cursor,
        )

    assert exc_info.value.status_code == 403


def test_inactive_standalone_admin_cannot_log_in(monkeypatch):
    cursor = MagicMock()
    monkeypatch.setattr(auth_router, "_get_active_employee", lambda *_: None)
    monkeypatch.setattr(
        auth_router,
        "_get_user_by_email",
        lambda *_: user_row(is_active=False),
    )

    with pytest.raises(HTTPException) as exc_info:
        auth_router._login_employee_user(
            PasswordLoginRequest(email="admin@bosch.com", password="Admin1234"),
            cursor,
        )

    assert exc_info.value.status_code == 403
