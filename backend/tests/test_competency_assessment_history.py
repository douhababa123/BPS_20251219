from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from competency_assessment_history import (
    build_matrix_payload,
    quarter_for,
    resolve_employee_scope,
    save_latest_assessment,
)
from models import CompetencyAssessmentSave


@pytest.mark.parametrize(
    ("month", "quarter"),
    [(1, 1), (3, 1), (4, 2), (6, 2), (7, 3), (9, 3), (10, 4), (12, 4)],
)
def test_quarter_for_calendar_boundaries(month, quarter):
    value = datetime(2026, month, 1, tzinfo=timezone.utc)

    assert quarter_for(value) == quarter


def test_save_model_rejects_target_below_current():
    with pytest.raises(ValidationError):
        CompetencyAssessmentSave(current_level=4, target_level=3)


def test_save_model_accepts_zero():
    value = CompetencyAssessmentSave(current_level=0, target_level=0)

    assert value.current_level == 0
    assert value.target_level == 0


def test_normal_user_cannot_access_other_employee():
    cursor = MagicMock()
    cursor.fetchone.return_value = (str(uuid4()), "other@bosch.com")

    with pytest.raises(HTTPException) as exc_info:
        resolve_employee_scope(
            cursor,
            {"role": "user", "email": "self@bosch.com"},
            uuid4(),
        )

    assert exc_info.value.status_code == 403


def test_admin_can_access_any_existing_employee():
    cursor = MagicMock()
    cursor.fetchone.return_value = (str(uuid4()), "other@bosch.com")

    resolve_employee_scope(
        cursor,
        {"role": "admin", "email": "admin@bosch.com"},
        uuid4(),
    )


def test_existing_save_updates_projection_and_appends_one_history(monkeypatch):
    employee_id = uuid4()
    assessment_id = uuid4()
    user_id = uuid4()
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        (str(employee_id), "self@bosch.com"),
        (7,),
        (str(assessment_id),),
    ]
    now = datetime(2026, 7, 15, 9, 30, tzinfo=timezone.utc)
    monkeypatch.setattr(
        "competency_assessment_history.current_timestamp",
        lambda: now,
    )

    saved_id = save_latest_assessment(
        cursor,
        employee_id,
        7,
        CompetencyAssessmentSave(current_level=0, target_level=3, notes="Q3"),
        {"user_id": str(user_id), "role": "user", "email": "self@bosch.com"},
    )

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert saved_id == str(assessment_id)
    assert sum("UPDATE dbo.competency_assessments" in sql for sql in statements) == 1
    assert sum("INSERT INTO dbo.competency_assessment_history" in sql for sql in statements) == 1
    assert not cursor.commit.called


def test_first_save_creates_projection_and_appends_one_history(monkeypatch):
    employee_id = uuid4()
    assessment_id = uuid4()
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        (str(employee_id), "self@bosch.com"),
        (9,),
        None,
        (str(assessment_id),),
    ]
    monkeypatch.setattr(
        "competency_assessment_history.current_timestamp",
        lambda: datetime(2026, 10, 1, 8, 0, tzinfo=timezone.utc),
    )

    saved_id = save_latest_assessment(
        cursor,
        employee_id,
        9,
        CompetencyAssessmentSave(current_level=2, target_level=2),
        {"user_id": str(uuid4()), "role": "user", "email": "self@bosch.com"},
    )

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert saved_id == str(assessment_id)
    assert sum("INSERT INTO dbo.competency_assessments" in sql for sql in statements) == 1
    assert sum("INSERT INTO dbo.competency_assessment_history" in sql for sql in statements) == 1
    assert not cursor.commit.called


def test_matrix_contains_missing_cells_as_absent_and_scopes_edit_permission():
    employees = [
        (uuid4(), "E1", "Self", "D", "self@bosch.com"),
        (uuid4(), "E2", "Other", "D", "other@bosch.com"),
    ]
    skills = [(7, 1, "Module", "Skill", 1)]
    assessments = [(employees[0][0], 7, 0, 2, 2)]

    payload = build_matrix_payload(
        employees,
        skills,
        assessments,
        {"role": "user", "email": "SELF@BOSCH.COM"},
    )

    assert payload["rows"][0]["canEdit"] is True
    assert payload["rows"][1]["canEdit"] is False
    assert payload["rows"][0]["skills"][7]["currentLevel"] == 0
    assert payload["rows"][1]["skills"] == {}
    assert payload["stats"]["avgCurrentLevel"] == 0
