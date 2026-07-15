from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

from models import CompetencyAssessmentCreate, CompetencyAssessmentSave, CompetencyAssessmentUpdate
from routers import competency_assessments


def test_matrix_route_returns_active_employees_and_all_active_skills():
    employee_id = uuid4()
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [(employee_id, "E1", "Self", "D", "self@bosch.com")],
        [(7, 1, "Module", "Skill", 1), (8, 1, "Module", "Missing", 2)],
        [(employee_id, 7, 0, 2, 2)],
    ]

    result = competency_assessments.get_assessment_matrix(
        cursor=cursor,
        current_user={"role": "user", "email": "self@bosch.com"},
    )

    assert len(result["columns"]) == 2
    assert result["rows"][0]["canEdit"] is True
    assert result["rows"][0]["skills"][7]["currentLevel"] == 0
    assert 8 not in result["rows"][0]["skills"]


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
            1,
            3,
            2,
            2026,
            3,
            "note",
            changed_at,
            None,
            "MIGRATION_BASELINE",
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


def test_static_routes_are_registered_before_uuid_route():
    paths = [route.path for route in competency_assessments.router.routes]

    assert paths.index("/matrix") < paths.index("/{assessment_id}")
    assert paths.index("/history") < paths.index("/{assessment_id}")
    assert "/employee/{employee_id}/skill/{skill_id}" in paths


def test_save_route_uses_unified_domain_operation(monkeypatch):
    employee_id = uuid4()
    assessment_id = uuid4()
    expected = {"id": str(assessment_id), "current_level": 0, "target_level": 2}
    save = MagicMock(return_value=str(assessment_id))
    read = MagicMock(return_value=expected)
    monkeypatch.setattr(competency_assessments, "save_latest_assessment", save)
    monkeypatch.setattr(competency_assessments, "get_competency_assessment", read)

    result = competency_assessments.save_assessment(
        employee_id=employee_id,
        skill_id=7,
        payload=CompetencyAssessmentSave(current_level=0, target_level=2),
        cursor=MagicMock(),
        current_user={"role": "admin", "email": "admin@bosch.com"},
    )

    assert result == expected
    save.assert_called_once()
    read.assert_called_once()


def test_legacy_create_uses_history_preserving_domain_operation(monkeypatch):
    employee_id = uuid4()
    assessment_id = uuid4()
    save = MagicMock(return_value=str(assessment_id))
    expected = MagicMock(id=assessment_id)
    monkeypatch.setattr(competency_assessments, "save_latest_assessment", save)
    monkeypatch.setattr(competency_assessments, "get_competency_assessment", MagicMock(return_value=expected))
    cursor = MagicMock()
    user = {"role": "user", "email": "self@bosch.com"}

    result = competency_assessments.create_competency_assessment(
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

    assert result is expected
    payload = save.call_args.args[3]
    assert (payload.current_level, payload.target_level, payload.notes) == (0, 2, "created")
    assert save.call_args.args[4] == user


def test_legacy_partial_update_merges_values_then_appends_history(monkeypatch):
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

    result = competency_assessments.update_competency_assessment(
        assessment_id=assessment_id,
        assessment=CompetencyAssessmentUpdate(target_level=3),
        cursor=MagicMock(),
        current_user={"role": "admin", "email": "admin@bosch.com"},
    )

    assert result is updated
    payload = save.call_args.args[3]
    assert (payload.current_level, payload.target_level, payload.notes) == (3, 3, "old")
