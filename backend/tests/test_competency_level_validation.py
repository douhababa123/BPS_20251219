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
