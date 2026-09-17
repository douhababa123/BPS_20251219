from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from competency_assessment_history import (
    build_matrix_payload,
    owner_configuration_warnings,
    quarter_for,
    resolve_editable_module_ids,
    resolve_employee_scope,
    save_assessment_batch,
    save_latest_assessment,
)
from models import CompetencyAssessmentBatchCell, CompetencyAssessmentSave


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


def test_save_model_rejects_level_five():
    with pytest.raises(ValidationError):
        CompetencyAssessmentSave(current_level=4, target_level=5)


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
        (1,),
        (str(employee_id),),
        (str(uuid4()),),
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
        {"user_id": str(user_id), "role": "admin", "email": "admin@bosch.com"},
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
        (1,),
        (str(employee_id),),
        (str(uuid4()),),
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
        {"user_id": str(uuid4()), "role": "admin", "email": "admin@bosch.com"},
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
        {"role": "user", "email": "SELF@BOSCH.COM", "editable_module_ids": [1]},
    )
    assert payload["rows"][0]["canEdit"] is True
    assert payload["rows"][1]["canEdit"] is True
    assert payload["rows"][0]["skills"][7]["currentLevel"] == 0
    assert payload["rows"][1]["skills"] == {}
    assert payload["stats"]["avgCurrentLevel"] == 0


def test_module_owner_permissions_are_resolved_from_active_account_and_unique_owner_name():
    cursor = MagicMock()
    cursor.fetchone.return_value = (str(uuid4()), "Chen Jianjun")
    cursor.fetchall.side_effect = [
        [(4, "TPM"), (5, "LBP")],
        [(4, " Chen   Jianjun "), (4, "chen jianjun"), (5, "Other Owner")],
        [("Chen Jianjun",), ("Other Owner",)],
    ]

    assert resolve_editable_module_ids(
        cursor,
        {"user_id": str(uuid4()), "role": "user"},
    ) == {4}


def test_missing_or_inconsistent_owner_configuration_fails_closed():
    cursor = MagicMock()
    cursor.fetchone.return_value = (str(uuid4()), "Chen Jianjun")
    cursor.fetchall.side_effect = [
        [(4, "TPM"), (5, "LBP")],
        [(4, "Chen Jianjun"), (4, None), (5, "Chen Jianjun"), (5, "Other")],
        [("Chen Jianjun",), ("Other",)],
    ]

    assert resolve_editable_module_ids(
        cursor,
        {"user_id": str(uuid4()), "role": "user"},
    ) == set()


def test_duplicate_active_employee_name_makes_owner_ambiguous_and_warns_admin():
    cursor = MagicMock()
    cursor.fetchone.return_value = (str(uuid4()), "Chen Jianjun")
    cursor.fetchall.side_effect = [
        [(4, "Waste-free, stable flow_TPM")],
        [(4, "Chen Jianjun")],
        [("Chen Jianjun",), (" chen  jianjun ",)],
    ]
    assert resolve_editable_module_ids(
        cursor,
        {"user_id": str(uuid4()), "role": "user"},
    ) == set()

    warning_cursor = MagicMock()
    warning_cursor.fetchall.side_effect = [
        [(4, "Waste-free, stable flow_TPM")],
        [(4, "Chen Jianjun")],
        [("Chen Jianjun",), (" chen  jianjun ",)],
    ]
    assert owner_configuration_warnings(warning_cursor) == [
        "Waste-free, stable flow_TPM 的模块 Owner 无法唯一匹配启用员工和账号"
    ]

def test_batch_save_creates_one_version_for_all_cells(monkeypatch):
    employee_one, employee_two = uuid4(), uuid4()
    assessment_one, new_assessment, version_id = uuid4(), uuid4(), uuid4()
    now = datetime(2026, 9, 11, 9, 30)
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        (1,), (str(employee_one),), (str(assessment_one), None),
        (1,), (str(employee_two),), None,
        (str(version_id),),
        (str(new_assessment),),
    ]
    monkeypatch.setattr("competency_assessment_history.current_timestamp", lambda: now)

    result = save_assessment_batch(
        cursor,
        [
            CompetencyAssessmentBatchCell(employee_id=employee_one, skill_id=7, current_level=1, target_level=3),
            CompetencyAssessmentBatchCell(employee_id=employee_two, skill_id=7, current_level=2, target_level=4),
        ],
        "Q3 save",
        {"user_id": str(uuid4()), "role": "admin"},
    )

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert result["versionId"] == str(version_id)
    assert result["savedCount"] == 2
    assert sum("INSERT INTO dbo.competency_assessment_versions" in sql for sql in statements) == 1
    assert sum("INSERT INTO dbo.competency_assessment_history" in sql for sql in statements) == 2
    assert not cursor.commit.called


def test_batch_conflict_rejects_before_any_version_or_update():
    employee_id = uuid4()
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        (1,),
        (str(employee_id),),
        (str(uuid4()), datetime(2026, 9, 11, 10, 0)),
    ]

    with pytest.raises(HTTPException) as error:
        save_assessment_batch(
            cursor,
            [CompetencyAssessmentBatchCell(
                employee_id=employee_id,
                skill_id=7,
                current_level=1,
                target_level=3,
                expected_updated_at=datetime(2026, 9, 11, 9, 0),
            )],
            None,
            {"user_id": str(uuid4()), "role": "admin"},
        )

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert error.value.status_code == 409
    assert not any("INSERT INTO dbo.competency_assessment_versions" in sql for sql in statements)
    assert not any("UPDATE dbo.competency_assessments" in sql for sql in statements)
