from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

from models import TaskCreate
from routers import tasks


def _task_create(assigned_employee_id, status="planned"):
    return TaskCreate(
        task_name="Self-entered schedule",
        task_type="Leave",
        task_location="out of office",
        assigned_employee_id=assigned_employee_id,
        start_date="2026-07-16",
        end_date="2026-07-16",
        time_slot="FULL_DAY",
        status=status,
    )


def test_normal_user_self_entered_schedule_keeps_business_status(monkeypatch):
    user_id = uuid4()
    employee_id = uuid4()
    inserted_id = uuid4()
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(employee_id,), (inserted_id,)]

    def fake_get_task(*_args, **_kwargs):
        insert_call = next(
            call for call in cursor.execute.call_args_list
            if "INSERT INTO dbo.tasks" in call.args[0]
        )
        values = insert_call.args[1]
        created = SimpleNamespace(status=values[8], requester_id=values[12])
        created.dict = lambda: {
            "status": created.status,
            "requester_id": created.requester_id,
        }
        return created

    monkeypatch.setattr(tasks, "get_task", fake_get_task)
    monkeypatch.setattr(tasks, "_safe_log_task_audit", lambda *_args, **_kwargs: None)

    created = tasks.create_task(
        _task_create(employee_id, status="planned"),
        cursor=cursor,
        current_user={
            "user_id": str(user_id),
            "email": "self@bshg.com",
            "role": "user",
        },
    )

    assert created.status == "planned"
    assert created.requester_id == str(user_id)


def test_normal_user_assignment_to_another_employee_requires_approval(monkeypatch):
    user_id = uuid4()
    own_employee_id = uuid4()
    other_employee_id = uuid4()
    inserted_id = uuid4()
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(own_employee_id,), (inserted_id,)]

    def fake_get_task(*_args, **_kwargs):
        insert_call = next(
            call for call in cursor.execute.call_args_list
            if "INSERT INTO dbo.tasks" in call.args[0]
        )
        values = insert_call.args[1]
        created = SimpleNamespace(status=values[8], requester_id=values[12])
        created.dict = lambda: {
            "status": created.status,
            "requester_id": created.requester_id,
        }
        return created

    monkeypatch.setattr(tasks, "get_task", fake_get_task)
    monkeypatch.setattr(tasks, "_safe_log_task_audit", lambda *_args, **_kwargs: None)

    created = tasks.create_task(
        _task_create(other_employee_id, status="planned"),
        cursor=cursor,
        current_user={
            "user_id": str(user_id),
            "email": "self@bshg.com",
            "role": "user",
        },
    )

    assert created.status == "pending_approval"


def test_requester_can_modify_self_entered_planned_schedule():
    user_id = uuid4()
    employee_id = uuid4()
    task = SimpleNamespace(
        requester_id=str(user_id),
        assigned_employee_id=str(employee_id),
        status="planned",
    )

    assert tasks._can_modify_task(
        task,
        {
            "user_id": str(user_id),
            "role": "user",
            "employee_id": str(employee_id),
        },
    ) is True
