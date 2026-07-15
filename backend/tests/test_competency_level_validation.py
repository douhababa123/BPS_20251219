from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from models import (
    CompetencyAssessmentCreate,
    CompetencyAssessmentUpdate,
)
from routers import admin_competency_assessments
from routers import competency_assessments


def test_legacy_create_payload_rejects_level_five():
    with pytest.raises(ValidationError):
        CompetencyAssessmentCreate(
            employee_id=uuid4(),
            skill_id=1,
            current_level=4,
            target_level=5,
        )


def test_legacy_create_payload_rejects_target_below_current():
    with pytest.raises(ValidationError):
        CompetencyAssessmentCreate(
            employee_id=uuid4(),
            skill_id=1,
            current_level=4,
            target_level=3,
        )


def test_admin_create_payload_rejects_level_five():
    with pytest.raises(ValidationError):
        admin_competency_assessments.CompetencyAssessmentCreate(
            employee_id=str(uuid4()),
            skill_id=1,
            current_level=4,
            target_level=5,
        )


def test_legacy_partial_update_rejects_current_above_stored_target(monkeypatch):
    assessment_id = uuid4()
    existing = SimpleNamespace(current_level=2, target_level=2)
    cursor = MagicMock()
    monkeypatch.setattr(
        competency_assessments,
        "get_competency_assessment",
        MagicMock(return_value=existing),
    )

    with pytest.raises(HTTPException) as error:
        competency_assessments.update_competency_assessment(
            assessment_id=assessment_id,
            assessment=CompetencyAssessmentUpdate(current_level=3),
            cursor=cursor,
            current_user={"role": "admin"},
        )

    assert error.value.status_code == 422
    cursor.execute.assert_not_called()


def test_admin_partial_update_rejects_current_above_stored_target(monkeypatch):
    assessment_id = str(uuid4())
    cursor = MagicMock()
    cursor.fetchone.return_value = SimpleNamespace(
        id=assessment_id,
        employee_id=str(uuid4()),
        skill_id=1,
        current_level=2,
        target_level=2,
        gap=0,
        assessment_year=2026,
        assessment_date=None,
        notes=None,
        created_at=None,
        updated_at=None,
    )

    @contextmanager
    def fake_cursor():
        yield cursor

    monkeypatch.setattr(admin_competency_assessments.db, "get_cursor", fake_cursor)

    with pytest.raises(HTTPException) as error:
        admin_competency_assessments.update_assessment(
            assessment_id=assessment_id,
            assessment=admin_competency_assessments.CompetencyAssessmentUpdate(
                current_level=3,
            ),
            current_user={"role": "admin"},
        )

    assert error.value.status_code == 422
    assert not any(
        "UPDATE competency_assessments" in call.args[0]
        for call in cursor.execute.call_args_list
    )


def _admin_row(assessment_id, employee_id, current=0, target=2, notes=None):
    return SimpleNamespace(
        id=assessment_id,
        employee_id=employee_id,
        skill_id=1,
        current_level=current,
        target_level=target,
        gap=target - current,
        assessment_year=2026,
        assessment_date=None,
        notes=notes,
        created_at=None,
        updated_at=None,
    )


def test_admin_create_uses_history_preserving_domain_operation(monkeypatch):
    assessment_id = str(uuid4())
    employee_id = str(uuid4())
    cursor = MagicMock()
    cursor.fetchone.return_value = _admin_row(assessment_id, employee_id)

    @contextmanager
    def fake_cursor():
        yield cursor

    save = MagicMock(return_value=assessment_id)
    monkeypatch.setattr(admin_competency_assessments.db, "get_cursor", fake_cursor)
    monkeypatch.setattr(admin_competency_assessments, "save_latest_assessment", save, raising=False)

    result = admin_competency_assessments.create_assessment(
        assessment=admin_competency_assessments.CompetencyAssessmentCreate(
            employee_id=employee_id,
            skill_id=1,
            current_level=0,
            target_level=2,
            notes="created",
        ),
        current_user={"role": "admin", "email": "admin@bosch.com"},
    )

    assert result["id"] == assessment_id
    payload = save.call_args.args[3]
    assert (payload.current_level, payload.target_level, payload.notes) == (0, 2, "created")


def test_admin_partial_update_merges_values_then_appends_history(monkeypatch):
    assessment_id = str(uuid4())
    employee_id = str(uuid4())
    existing = _admin_row(assessment_id, employee_id, current=3, target=4, notes="old")
    updated = _admin_row(assessment_id, employee_id, current=3, target=3, notes="old")
    cursor = MagicMock()
    cursor.fetchone.side_effect = [existing, updated]

    @contextmanager
    def fake_cursor():
        yield cursor

    save = MagicMock(return_value=assessment_id)
    monkeypatch.setattr(admin_competency_assessments.db, "get_cursor", fake_cursor)
    monkeypatch.setattr(admin_competency_assessments, "save_latest_assessment", save, raising=False)

    result = admin_competency_assessments.update_assessment(
        assessment_id=assessment_id,
        assessment=admin_competency_assessments.CompetencyAssessmentUpdate(target_level=3),
        current_user={"role": "admin", "email": "admin@bosch.com"},
    )

    assert result["target_level"] == 3
    payload = save.call_args.args[3]
    assert (payload.current_level, payload.target_level, payload.notes) == (3, 3, "old")
