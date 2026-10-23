from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from models import TaskApprovalAction, TaskUpdate, TaskExecutionStatusUpdate
from routers import tasks, matching, admin_tasks
from task_approval import load_approval_directory, approval_metadata, authorize_approval, require_approval_route


def directory():
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        ('wang', 'ning.wang@bshg.com', 'Wang Ning', 'wang-user', 'ning.wang@bshg.com'),
        ('tyler', 'tyler.tan@bshg.com', 'Tyler Tan', 'tyler-user', 'tyler.tan@bshg.com'),
        ('xue', 'ting.xue@bshg.com', 'Xue Ting', 'xue-user', 'ting.xue@bshg.com'),
        ('chen', 'jianjun.chen@bshg.com', 'Chen Jianjun', 'chen-user', 'jianjun.chen@bshg.com'),
        ('qian', 'rongbing.qian@bshg.com', 'Qian Rongbing', 'qian-user', 'rongbing.qian@bshg.com'),
    ]
    return load_approval_directory(cursor)


def test_routing_follows_engineer_and_allows_wang_to_approve_self():
    routes = directory()
    for employee in ['wang', 'xue', 'qian']:
        assert routes[employee]['approver_user_id'] == 'wang-user'
    assert routes['chen']['approver_user_id'] == 'tyler-user'
    task = {'assigned_employee_id': 'wang', 'status': 'pending_approval', 'approval_version': 4}
    assert authorize_approval(routes, task, {'user_id': 'wang-user', 'role': 'admin'}, 4)['approval_site'] == 'SNa'


@pytest.mark.parametrize('user_id', ['tyler-user', 'other-admin'])
def test_global_admin_is_not_permission_to_approve_sna_task(user_id):
    task = {'assigned_employee_id': 'xue', 'status': 'pending_approval', 'approval_version': 0}
    with pytest.raises(HTTPException) as error:
        authorize_approval(directory(), task, {'user_id': user_id, 'role': 'admin'}, 0)
    assert error.value.status_code == 403


def test_old_approval_is_rejected_even_if_reassigned_within_same_site():
    task = {'assigned_employee_id': 'xue', 'status': 'pending_approval', 'approval_version': 2}
    with pytest.raises(HTTPException) as error:
        authorize_approval(directory(), task, {'user_id': 'wang-user'}, 1)
    assert error.value.status_code == 409
    assert approval_metadata(directory(), 'xue', {'user_id': 'wang-user'}, 'planned')['can_approve'] is False


def test_disabled_or_missing_approver_does_not_fall_back_to_any_admin():
    cursor = MagicMock()
    cursor.fetchall.return_value = [('xue', 'ting.xue@bshg.com', 'Xue Ting', 'xue-user', 'ting.xue@bshg.com')]
    with pytest.raises(HTTPException) as error:
        require_approval_route(load_approval_directory(cursor), 'xue')
    assert error.value.status_code == 422


@pytest.mark.parametrize('site,approver', [('SNa', 'wang-user'), ('SCh', 'tyler-user')])
@pytest.mark.parametrize('old_status', ['pending_approval', 'planned', 'confirmed', 'completed'])
def test_admin_reassignment_always_restarts_approval(monkeypatch, site, approver, old_status):
    task_id, old_employee, new_employee = uuid4(), uuid4(), uuid4()
    existing = SimpleNamespace(id=task_id, task_name='Task', assigned_employee_id=old_employee,
                               requester_id=uuid4(), status=old_status, approval_version=3)
    existing.model_dump = lambda: {'status': old_status}
    cursor = MagicMock()
    cursor.rowcount = 1
    route = {'approval_site': site, 'approver_user_id': approver, 'approver_name': approver}
    monkeypatch.setattr(tasks, 'get_task', lambda *a, **k: existing)
    monkeypatch.setattr(tasks, 'load_approval_directory', lambda _: {str(new_employee): route})
    monkeypatch.setattr(tasks, '_safe_log_task_audit', MagicMock())
    notify = MagicMock()
    monkeypatch.setattr(tasks, 'notify_approver', notify)
    tasks.update_task(task_id, TaskUpdate(assigned_employee_id=new_employee, status='completed'),
                      cursor=cursor, current_user={'role': 'admin', 'user_id': str(uuid4())})
    sql, params = cursor.execute.call_args.args
    assert 'pending_approval' in params
    assert 'completed' not in params
    assert 'rejection_reason = NULL' in sql
    assert 'approval_version = approval_version + 1' in sql
    assert 'AND approval_version = ?' in sql
    assert params[-1] == 3
    assert notify.call_args.args[1]['approver_user_id'] == approver


def test_pending_task_cannot_be_approved_by_generic_edit(monkeypatch):
    existing = SimpleNamespace(assigned_employee_id=uuid4(), requester_id=uuid4(), status='pending_approval')
    monkeypatch.setattr(tasks, 'get_task', lambda *a, **k: existing)
    cursor = MagicMock()
    with pytest.raises(HTTPException) as error:
        tasks.update_task(uuid4(), TaskUpdate(status='planned'), cursor=cursor, current_user={'role': 'admin'})
    assert error.value.status_code == 403
    cursor.execute.assert_not_called()


def test_self_schedule_bypass_applies_to_admin_and_regular_user():
    for role in ('admin', 'user'):
        assert tasks._status_for_assignment({'role': role}, 'in_progress', 'e1', 'e1') == 'in_progress'
        assert tasks._status_for_assignment({'role': role}, 'completed', 'e2', 'e1') == 'pending_approval'


def test_wrong_site_approval_endpoint_does_not_write(monkeypatch):
    task = {'id': 't', 'task_name': 'Task', 'assigned_employee_id': 'chen',
            'requester_id': 'requester', 'status': 'pending_approval', 'approval_version': 0}
    monkeypatch.setattr(tasks, '_get_task_or_404', lambda *a: task)
    monkeypatch.setattr(tasks, 'load_approval_directory', lambda _: directory())
    cursor = MagicMock()
    with pytest.raises(HTTPException) as error:
        tasks.approve_task(uuid4(), TaskApprovalAction(expected_version=0),
                           cursor=cursor, current_user={'role': 'admin', 'user_id': 'wang-user'})
    assert error.value.status_code == 403
    cursor.execute.assert_not_called()


def test_stale_execution_status_cannot_overwrite_reassignment(monkeypatch):
    existing = SimpleNamespace(status='confirmed', assigned_employee_id=uuid4(), approval_version=2)
    monkeypatch.setattr(tasks, 'get_task', lambda *a, **k: existing)
    cursor = MagicMock()
    cursor.rowcount = 0
    with pytest.raises(HTTPException) as error:
        tasks.update_task_execution_status(uuid4(), TaskExecutionStatusUpdate(status='completed'),
                                           cursor=cursor, current_user={'role': 'admin'})
    assert error.value.status_code == 409
    cursor.commit.assert_not_called()
    cursor.rollback.assert_called_once()


def test_wang_self_approval_endpoint_succeeds_and_waits_for_acceptance(monkeypatch):
    task = {'id': 't', 'task_name': 'Task', 'assigned_employee_id': 'wang',
            'requester_id': None, 'status': 'pending_approval', 'approval_version': 3}
    monkeypatch.setattr(tasks, '_get_task_or_404', lambda *a: task)
    monkeypatch.setattr(tasks, 'load_approval_directory', lambda _: directory())
    monkeypatch.setattr(tasks, '_find_user_by_employee_id', lambda *a: None)
    monkeypatch.setattr(tasks, '_safe_log_task_audit', MagicMock())
    cursor = MagicMock()
    tasks.approve_task(uuid4(), TaskApprovalAction(expected_version=3),
                       cursor=cursor, current_user={'role': 'admin', 'user_id': 'wang-user'})
    sql = cursor.execute.call_args.args[0]
    assert "status = 'planned'" in sql
    assert 'approval_version = approval_version + 1' in sql
    cursor.commit.assert_called_once()


def test_matching_request_routes_by_engineer_not_requester_or_location(monkeypatch):
    monkeypatch.setattr(matching, 'load_approval_directory', lambda _: directory())
    notify = MagicMock()
    monkeypatch.setattr(matching, 'notify_approver', notify)
    cursor = MagicMock()
    cursor.fetchone.return_value = ['new-task']
    result = matching.assign_task({'taskName': 'Test', 'employeeId': 'chen', 'location': 'SNa'},
                                  current_user={'user_id': 'wang-user', 'role': 'admin'}, cursor=cursor)
    assert result['status'] == 'pending_approval'
    assert notify.call_count == 1
    assert notify.call_args.args[1]['approver_user_id'] == 'tyler-user'


def test_admin_edit_endpoint_delegates_to_governed_update(monkeypatch):
    task_id, employee_id = uuid4(), uuid4()
    context = MagicMock()
    monkeypatch.setattr(admin_tasks.db, 'get_cursor', lambda: context)
    update = MagicMock()
    update.return_value.model_dump.return_value = {'status': 'pending_approval'}
    monkeypatch.setattr(admin_tasks, 'update_governed_task', update)
    user = {'role': 'admin', 'user_id': 'admin'}
    result = admin_tasks.update_task(str(task_id), admin_tasks.TaskUpdate(
        assigned_employee_id=str(employee_id), status='completed'), current_user=user)
    assert result['status'] == 'pending_approval'
    assert update.call_args.args[1].assigned_employee_id == employee_id
    assert update.call_args.kwargs['current_user'] == user


@pytest.mark.parametrize('employee,approver', [('wang', 'wang-user'), ('chen', 'tyler-user')])
def test_legacy_force_assignment_cannot_bypass_site_approval(monkeypatch, employee, approver):
    monkeypatch.setattr(matching, 'load_approval_directory', lambda _: directory())
    notify = MagicMock()
    monkeypatch.setattr(matching, 'notify_approver', notify)
    cursor = MagicMock()
    cursor.fetchone.return_value = ['new-task']
    result = matching.force_assign_task({'taskName': 'Test', 'employeeId': employee, 'location': 'Supplier'},
                                        current_user={'user_id': 'wang-user', 'role': 'admin'}, cursor=cursor)
    assert result['status'] == 'pending_approval'
    assert "'pending_approval'" in cursor.execute.call_args.args[0]
    assert notify.call_count == 1
    assert notify.call_args.args[1]['approver_user_id'] == approver


def test_legacy_force_assignment_missing_site_is_rejected_without_writes(monkeypatch):
    monkeypatch.setattr(matching, 'load_approval_directory', lambda _: {})
    cursor = MagicMock()
    with pytest.raises(HTTPException) as error:
        matching.force_assign_task({'employeeId': 'unknown'},
                                   current_user={'user_id': 'admin', 'role': 'admin'}, cursor=cursor)
    assert error.value.status_code == 422
    cursor.execute.assert_not_called()


def test_legacy_force_assignment_keeps_admin_access_requirement():
    cursor = MagicMock()
    with pytest.raises(HTTPException) as error:
        matching.force_assign_task({}, current_user={'role': 'user'}, cursor=cursor)
    assert error.value.status_code == 403
    cursor.execute.assert_not_called()


def test_deployment_migration_does_not_approve_reassignments_to_requester():
    from pathlib import Path
    sql = (Path(__file__).resolve().parents[1] / 'migrations/007_self_schedule_approval.sql').read_text(encoding='utf-8')
    assert "COL_LENGTH('dbo.tasks', 'approval_version') IS NOT NULL" in sql
    assert sql.index('RETURN;') < sql.index('UPDATE')
