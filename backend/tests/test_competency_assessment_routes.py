from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from models import CompetencyAssessmentCreate, CompetencyAssessmentSave, CompetencyAssessmentUpdate
from routers import competency_assessments


def test_matrix_route_returns_active_employees_and_all_active_skills():
    employee_id = uuid4()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [(employee_id, "E1", "Self", "D", "self@bosch.com")],
        [(7, 1, "Module", "Skill", 1), (8, 1, "Module", "Missing", 2)],
        [(employee_id, 7, 0, 2, 2, datetime(2026, 9, 11, 9, 0))],
        [(1, "Module")],
        [(1, "Owner")],
        [("Owner",)],
    ]

    result = competency_assessments.get_assessment_matrix(
        cursor=cursor,
        current_user={"role": "admin", "email": "admin@bosch.com"},
    )

    assert len(result["columns"]) == 2
    assert result["rows"][0]["canEdit"] is True
    assert result["rows"][0]["skills"][7]["currentLevel"] == 0
    assert 8 not in result["rows"][0]["skills"]
    assert result["permissionWarnings"] == []


def test_history_route_returns_latest_row_per_quarter_with_bound_filters():
    employee_id = uuid4()
    assessment_id = uuid4()
    history_id = uuid4()
    changed_at = datetime(2026, 7, 15, 10, 0)
    cursor = MagicMock()
    cursor.fetchone.return_value = (employee_id, "self@bosch.com")
    cursor.fetchall.return_value = [
        (
            history_id,
            assessment_id,
            employee_id,
            7,
            0,
            2,
            1,
            3,
            2,
            2026,
            3,
            "note",
            changed_at,
            None,
            "MIGRATION_BASELINE",
            None,
            None,
            None,
        )
    ]

    result = competency_assessments.get_assessment_history(
        employee_id=employee_id,
        skill_id=7,
        year=2026,
        quarter=3,
        latest_per_quarter=True,
        cursor=cursor,
        current_user={"role": "user", "email": "self@bosch.com"},
    )

    history_call = cursor.execute.call_args_list[-1]
    assert "ROW_NUMBER() OVER" in history_call.args[0]
    assert history_call.args[1] == [str(employee_id), 7, 2026, 3]
    assert result[0]["gap"] == 2
    assert result[0]["assessment_quarter"] == 3
    assert result[0]["previous_current_level"] == 0
    assert result[0]["previous_target_level"] == 2


def test_change_log_scopes_module_owner_and_returns_audit_details(monkeypatch):
    history_id, version_id, employee_id, user_id = uuid4(), uuid4(), uuid4(), uuid4()
    changed_at = datetime(2026, 9, 18, 11, 30)
    cursor = MagicMock()
    monkeypatch.setattr(
        competency_assessments,
        "resolve_editable_module_ids",
        lambda _cursor, _user: {4},
    )
    cursor.fetchall.return_value = [(
        history_id, version_id, changed_at, employee_id, "Chen Jianjun",
        4, "Waste-free, stable flow_TPM", 15, "TPM program management",
        1, 2, 3, 4, "Q3 update", user_id, "Admin", "admin@bosch.com",
    )]

    result = competency_assessments.get_competency_change_log(
        limit=100,
        cursor=cursor,
        current_user={"role": "user", "user_id": str(user_id)},
    )

    sql_call = cursor.execute.call_args
    assert "s.module_id IN (?)" in sql_call.args[0]
    assert sql_call.args[1] == [100, 4]
    assert result["records"][0]["previousCurrentLevel"] == 1
    assert result["records"][0]["currentLevel"] == 2
    assert result["records"][0]["changedByEmail"] == "admin@bosch.com"


def test_static_routes_are_registered_before_uuid_route():
    paths = [route.path for route in competency_assessments.router.routes]

    assert paths.index("/matrix") < paths.index("/{assessment_id}")
    assert paths.index("/history") < paths.index("/{assessment_id}")
    assert paths.index("/change-log") < paths.index("/{assessment_id}")
    assert "/employee/{employee_id}/skill/{skill_id}" in paths


def test_immediate_save_route_is_disabled(monkeypatch):
    employee_id = uuid4()
    assessment_id = uuid4()
    expected = {"id": str(assessment_id), "current_level": 0, "target_level": 2}
    save = MagicMock(return_value=str(assessment_id))
    read = MagicMock(return_value=expected)
    monkeypatch.setattr(competency_assessments, "save_latest_assessment", save)
    monkeypatch.setattr(competency_assessments, "get_competency_assessment", read)

    with pytest.raises(HTTPException) as error:
        competency_assessments.save_assessment(
            employee_id=employee_id,
            skill_id=7,
            payload=CompetencyAssessmentSave(current_level=0, target_level=2),
            cursor=MagicMock(),
            current_user={"role": "admin", "email": "admin@bosch.com"},
        )

    assert error.value.status_code == 410
    save.assert_not_called()
    read.assert_not_called()


def test_legacy_create_is_disabled(monkeypatch):
    employee_id = uuid4()
    assessment_id = uuid4()
    save = MagicMock(return_value=str(assessment_id))
    expected = MagicMock(id=assessment_id)
    monkeypatch.setattr(competency_assessments, "save_latest_assessment", save)
    monkeypatch.setattr(competency_assessments, "get_competency_assessment", MagicMock(return_value=expected))
    cursor = MagicMock()
    user = {"role": "user", "email": "self@bosch.com"}

    with pytest.raises(HTTPException) as error:
        competency_assessments.create_competency_assessment(
            assessment=CompetencyAssessmentCreate(
                employee_id=employee_id,
                skill_id=7,
                current_level=0,
                target_level=2,
                assessor_notes="created",
            ),
            cursor=cursor,
            current_user=user,
        )

    assert error.value.status_code == 410
    save.assert_not_called()


def test_legacy_partial_update_is_disabled(monkeypatch):
    employee_id = uuid4()
    assessment_id = uuid4()
    existing = MagicMock(
        employee_id=employee_id,
        skill_id=7,
        current_level=3,
        target_level=4,
        assessor_notes="old",
    )
    updated = MagicMock(id=assessment_id)
    read = MagicMock(side_effect=[existing, updated])
    save = MagicMock(return_value=str(assessment_id))
    monkeypatch.setattr(competency_assessments, "get_competency_assessment", read)
    monkeypatch.setattr(competency_assessments, "save_latest_assessment", save)

    with pytest.raises(HTTPException) as error:
        competency_assessments.update_competency_assessment(
            assessment_id=assessment_id,
            assessment=CompetencyAssessmentUpdate(target_level=3),
            cursor=MagicMock(),
            current_user={"role": "admin", "email": "admin@bosch.com"},
        )

    assert error.value.status_code == 410
    save.assert_not_called()
    read.assert_not_called()
