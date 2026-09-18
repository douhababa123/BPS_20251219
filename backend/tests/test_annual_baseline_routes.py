import asyncio
import hashlib
from datetime import datetime
from io import BytesIO
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile
from pydantic import ValidationError

from routers.annual_baselines import (
    SavedVersionActivation,
    _lock_active_baseline,
    _preview_token,
    activate_import,
    activate_saved_version,
    download_active_baseline,
    preview_import,
)
from test_annual_baseline import workbook_bytes
from routers.auth import verify_admin


def test_annual_baseline_admin_dependency_rejects_non_admin():
    with pytest.raises(HTTPException) as error:
        asyncio.run(verify_admin({"role": "user"}))

    assert error.value.status_code == 403


def test_annual_baseline_admin_dependency_accepts_admin():
    user = {"user_id": str(uuid4()), "role": "admin"}

    assert asyncio.run(verify_admin(user)) == user


def test_preview_validates_without_writing_any_business_table():
    cursor = MagicMock()
    cursor.fetchall.side_effect = [
        [(uuid4(), "E001", "Employee One")],
        [(7, 1, "Module", "Skill")],
    ]
    upload = UploadFile(file=BytesIO(workbook_bytes([["E001", 7, 0, 3]])), filename="baseline.xlsx")

    result = asyncio.run(preview_import(2026, upload, cursor, {"role": "admin"}))

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert result["valid"] is True
    assert result["previewToken"] == _preview_token(2026, result["sha256"])
    assert not any("competency_annual_baselines" in sql for sql in statements)
    assert not any("competency_assessment_history" in sql for sql in statements)
    assert not cursor.commit.called


def test_download_active_baseline_exports_only_the_selected_active_version():
    baseline_id = uuid4()
    cursor = MagicMock()
    cursor.fetchone.return_value = (baseline_id,)
    cursor.fetchall.return_value = [
        ("E001", "Employee One", 7, "Module", "Skill", 1, 3),
    ]

    response = download_active_baseline(
        year=2026,
        cursor=cursor,
        current_user={"role": "admin"},
    )

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert "filename=\"bps-2026-active-baseline.xlsx\"" in response.headers["content-disposition"]
    assert any("WHERE baseline_year = ? AND is_active = 1" in sql for sql in statements)
    assert any("WHERE i.baseline_id = ?" in sql for sql in statements)
    assert cursor.execute.call_args_list[-1].args[1] == str(baseline_id)


def test_download_active_baseline_rejects_year_without_active_version():
    cursor = MagicMock()
    cursor.fetchone.return_value = None

    with pytest.raises(HTTPException) as error:
        download_active_baseline(
            year=2026,
            cursor=cursor,
            current_user={"role": "admin"},
        )

    assert error.value.status_code == 404


def test_activation_rejects_a_preview_token_from_another_year_before_database_writes():
    cursor = MagicMock()
    contents = workbook_bytes([["E001", 7, 0, 3]])
    upload = UploadFile(file=BytesIO(contents), filename="baseline.xlsx")
    digest = hashlib.sha256(contents).hexdigest()

    with pytest.raises(HTTPException) as error:
        asyncio.run(activate_import(
            year=2026,
            preview_sha256=digest,
            preview_token=_preview_token(2027, digest),
            replace=False,
            expected_active_baseline_id=None,
            file=upload,
            cursor=cursor,
            current_user={"role": "admin"},
        ))

    assert error.value.status_code == 409
    cursor.execute.assert_not_called()
    cursor.commit.assert_not_called()


def test_existing_baseline_requires_explicit_replacement_before_any_update():
    cursor = MagicMock()
    active_id = uuid4()
    cursor.fetchone.return_value = (active_id,)

    with pytest.raises(HTTPException) as error:
        _lock_active_baseline(cursor, 2026, False, None)

    assert error.value.status_code == 409
    assert cursor.execute.call_count == 1


def test_stale_expected_active_baseline_is_rejected():
    cursor = MagicMock()
    cursor.fetchone.return_value = (uuid4(),)

    with pytest.raises(HTTPException) as error:
        _lock_active_baseline(cursor, 2026, True, uuid4())

    assert error.value.status_code == 409
    assert cursor.execute.call_count == 1


def test_2026_refuses_saved_version_as_a_baseline_source():
    with pytest.raises(ValidationError):
        SavedVersionActivation(year=2026, source_version_id=uuid4())


def test_later_year_saved_version_only_writes_independent_baseline_tables():
    cursor = MagicMock()
    source_version, baseline_id, employee_id = uuid4(), uuid4(), uuid4()
    cursor.fetchone.side_effect = [
        (datetime(2026, 12, 31, 17, 0),),
        None,
        (baseline_id,),
    ]
    cursor.fetchall.return_value = [(employee_id, 7, 2, 4)]

    result = activate_saved_version(
        SavedVersionActivation(year=2027, source_version_id=source_version),
        cursor,
        {"user_id": str(uuid4()), "role": "admin"},
    )

    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert result["source"] == "SAVED_VERSION"
    assert any("INSERT INTO dbo.competency_annual_baselines" in sql for sql in statements)
    assert any("INSERT INTO dbo.competency_annual_baseline_items" in sql for sql in statements)
    assert not any("UPDATE dbo.competency_assessments" in sql for sql in statements)
    assert not any("INSERT INTO dbo.competency_assessment_history" in sql for sql in statements)


def test_saved_version_item_failure_does_not_commit_partial_activation():
    cursor = MagicMock()
    source_version, baseline_id, employee_id = uuid4(), uuid4(), uuid4()
    cursor.fetchone.side_effect = [
        (datetime(2026, 12, 31, 17, 0),),
        None,
        (baseline_id,),
    ]
    cursor.fetchall.return_value = [(employee_id, 7, 2, 4)]

    def fail_item_insert(sql, *params):
        if "INSERT INTO dbo.competency_annual_baseline_items" in sql:
            raise RuntimeError("simulated insert failure")
        return cursor

    cursor.execute.side_effect = fail_item_insert

    with pytest.raises(RuntimeError, match="simulated insert failure"):
        activate_saved_version(
            SavedVersionActivation(year=2027, source_version_id=source_version),
            cursor,
            {"user_id": str(uuid4()), "role": "admin"},
        )

    assert not cursor.commit.called
