from datetime import datetime
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from routers import dashboard_progress


def test_future_year_returns_not_started_without_querying_business_data(monkeypatch):
    cursor = MagicMock()
    monkeypatch.setattr(dashboard_progress, "_shanghai_now", lambda: datetime(2026, 9, 11, 12, 0))

    result = dashboard_progress.get_competency_progress(
        year=2027,
        month=12,
        module_id=None,
        cursor=cursor,
        current_user={"user_id": "user-1"},
    )

    assert result["status"] == "not_started"
    assert result["kpis"] is None
    assert result["monthly"] == []
    assert result["cutoff"] is None
    cursor.execute.assert_not_called()


def test_future_month_in_current_year_is_rejected_before_database_queries(monkeypatch):
    cursor = MagicMock()
    monkeypatch.setattr(dashboard_progress, "_shanghai_now", lambda: datetime(2026, 9, 11, 12, 0))

    with pytest.raises(HTTPException) as error:
        dashboard_progress.get_competency_progress(
            year=2026,
            month=10,
            module_id=None,
            cursor=cursor,
            current_user={"user_id": "user-1"},
        )

    assert error.value.status_code == 422
    cursor.execute.assert_not_called()


def test_missing_baseline_does_not_fall_back_to_migration_history(monkeypatch):
    cursor = MagicMock()
    cursor.fetchone.return_value = None
    monkeypatch.setattr(dashboard_progress, "_shanghai_now", lambda: datetime(2026, 9, 11, 12, 0))

    result = dashboard_progress.get_competency_progress(
        year=2026,
        month=6,
        module_id=None,
        cursor=cursor,
        current_user={"user_id": "user-1"},
    )

    assert result["status"] == "missing_baseline"
    assert result["kpis"] is None
    assert result["monthly"] == []
    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert len(statements) == 1
    assert "competency_annual_baselines" in statements[0]
    assert not any("competency_assessment_history" in statement for statement in statements)
