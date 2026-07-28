from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models import TaskExecutionStatusUpdate
from routers import tasks


def test_expired_task_normalization_uses_strict_past_date_and_allowed_statuses_only():
    cursor = MagicMock()

    tasks._complete_expired_tasks(cursor)

    sql = cursor.execute.call_args.args[0].lower()
    assert "end_date < cast(getdate() as date)" in sql
    assert "'in_progress'" in sql
    assert "'confirmed'" in sql
    assert "t.status = 'planned'" in sql
    assert "auth_user_id" in sql
    assert "lower(e.email) = lower(u.email)" in sql
    assert "pending_approval" not in sql
    assert "rejected" not in sql
    assert "employee_rejected" not in sql
    assert "cancelled" not in sql


def test_get_tasks_normalizes_expired_tasks_before_reading(monkeypatch):
    cursor = MagicMock()
    cursor.fetchall.return_value = []
    calls = []

    monkeypatch.setattr(
        tasks,
        "_complete_expired_tasks",
        lambda received_cursor: calls.append(received_cursor),
    )

    result = tasks.get_tasks(
        cursor=cursor,
        current_user={"user_id": "user-1", "role": "user"},
    )

    assert result == []
    assert calls == [cursor]


def _task(**overrides):
    values = {
        "id": uuid4(),
        "requester_id": uuid4(),
        "assigned_employee_id": uuid4(),
        "status": "confirmed",
    }
    values.update(overrides)
    task = SimpleNamespace(**values)
    task.model_dump = lambda: {
        "id": str(task.id),
        "requester_id": str(task.requester_id),
        "assigned_employee_id": str(task.assigned_employee_id),
        "status": task.status,
    }
    return task


def test_execution_status_payload_accepts_only_execution_status():
    with pytest.raises(ValidationError):
        TaskExecutionStatusUpdate(
            status="completed",
            task_name="must not be editable here",
        )


def test_assignee_can_update_only_execution_status(monkeypatch):
    task_id = uuid4()
    employee_id = uuid4()
    existing = _task(id=task_id, assigned_employee_id=employee_id)
    updated = _task(
        id=task_id,
        assigned_employee_id=employee_id,
        requester_id=existing.requester_id,
        status="completed",
    )
    cursor = MagicMock()

    monkeypatch.setattr(tasks, "get_task", MagicMock(side_effect=[existing, updated]))
    monkeypatch.setattr(tasks, "_current_employee_id", lambda *_args: str(employee_id))
    monkeypatch.setattr(tasks, "_safe_log_task_audit", lambda *_args, **_kwargs: None)

    result = tasks.update_task_execution_status(
        task_id,
        TaskExecutionStatusUpdate(status="completed"),
        cursor=cursor,
        current_user={"user_id": str(uuid4()), "role": "user"},
    )

    update_call = next(
        call for call in cursor.execute.call_args_list
        if "UPDATE dbo.tasks" in call.args[0]
    )
    assert "status = ?" in update_call.args[0]
    assert update_call.args[1:] == ("completed", str(task_id))
    assert result.status == "completed"
    cursor.commit.assert_called_once()


def test_non_assignee_cannot_update_execution_status(monkeypatch):
    existing = _task()
    monkeypatch.setattr(tasks, "get_task", lambda *_args, **_kwargs: existing)
    monkeypatch.setattr(tasks, "_current_employee_id", lambda *_args: str(uuid4()))

    with pytest.raises(HTTPException) as error:
        tasks.update_task_execution_status(
            existing.id,
            TaskExecutionStatusUpdate(status="completed"),
            cursor=MagicMock(),
            current_user={"user_id": str(uuid4()), "role": "user"},
        )

    assert error.value.status_code == 403


def test_unaccepted_planned_assignment_cannot_use_execution_status_endpoint(monkeypatch):
    employee_id = uuid4()
    existing = _task(assigned_employee_id=employee_id, status="planned")
    monkeypatch.setattr(tasks, "get_task", lambda *_args, **_kwargs: existing)
    monkeypatch.setattr(tasks, "_current_employee_id", lambda *_args: str(employee_id))

    with pytest.raises(HTTPException) as error:
        tasks.update_task_execution_status(
            existing.id,
            TaskExecutionStatusUpdate(status="in_progress"),
            cursor=MagicMock(),
            current_user={"user_id": str(uuid4()), "role": "user"},
        )

    assert error.value.status_code == 400
