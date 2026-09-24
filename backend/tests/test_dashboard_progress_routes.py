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


def test_baseline_employee_options_include_historical_inactive_employee():
    cursor = MagicMock()
    cursor.fetchone.return_value = ("baseline-1",)
    cursor.fetchall.return_value = [("e1", "Chen Jianjun"), ("e2", "Xue Ting")]

    result = dashboard_progress.get_progress_employees(
        year=2026, cursor=cursor, current_user={"user_id": "user-1"},
    )

    assert result == [{"id": "e1", "name": "Chen Jianjun"}, {"id": "e2", "name": "Xue Ting"}]
    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert "competency_annual_baseline_items" in statements[-1]
    assert "e.is_active" not in statements[-1]


def test_baseline_employee_options_are_empty_without_active_baseline():
    cursor = MagicMock()
    cursor.fetchone.return_value = None

    result = dashboard_progress.get_progress_employees(
        year=2027, cursor=cursor, current_user={"user_id": "user-1"},
    )

    assert result == []
    assert cursor.execute.call_count == 1


def test_all_people_scope_keeps_team_aggregate(monkeypatch):
    cursor = MagicMock()
    cursor.fetchone.side_effect = [("baseline-1", "EXCEL_IMPORT", None, None), (0,)]
    cursor.fetchall.side_effect = [
        [("e1", 1, 1, 3), ("e2", 1, 2, 3)],
        [("h1", "e1", 1, 2, datetime(2026, 3, 1))],
    ]
    monkeypatch.setattr(dashboard_progress, "_shanghai_now", lambda: datetime(2026, 9, 11))

    result = dashboard_progress.get_competency_progress(
        year=2026, month=6, module_id=None, employee_id=None,
        cursor=cursor, current_user={"user_id": "user-1"},
    )

    assert result["employeeId"] is None
    assert result["cellCount"] == 2
    assert result["kpis"]["initialGap"] == 3
    assert result["kpis"]["currentGap"] == result["monthly"][-1]["gap"] == 2
    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert " AND i.employee_id = ?" not in statements[-2]
    assert " AND i.employee_id = ?" not in statements[-1]


def test_employee_filter_restricts_all_kpis_trend_and_cell_count(monkeypatch):
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        (1,),
        ("baseline-1", "EXCEL_IMPORT", None, datetime(2026, 1, 1)),
        (0,),
    ]
    cursor.fetchall.side_effect = [
        [("e1", 1, 1, 3), ("e1", 2, 2, 3)],
        [("h1", "e1", 1, 2, datetime(2026, 3, 1))],
    ]
    monkeypatch.setattr(dashboard_progress, "_shanghai_now", lambda: datetime(2026, 9, 11, 12, 0))

    result = dashboard_progress.get_competency_progress(
        year=2026, month=6, module_id=4, employee_id="e1",
        cursor=cursor, current_user={"user_id": "user-1"},
    )

    assert result["employeeId"] == "e1"
    assert result["moduleId"] == 4
    assert result["cellCount"] == 2
    assert result["kpis"] == {
        "initialLevel": 1.5, "targetLevel": 3, "currentLevel": 2,
        "initialGap": 3, "currentGap": 2, "closeRate": pytest.approx(100 / 3),
    }
    assert [point["gap"] for point in result["monthly"]] == [3, 3, 2, 2, 2, 2]
    assert result["monthly"][-1]["closeRate"] == result["kpis"]["closeRate"]
    statements = [call.args[0] for call in cursor.execute.call_args_list]
    assert "i.employee_id = ?" in statements[-2]
    assert "i.employee_id = ?" in statements[-1]


def test_employee_module_intersection_without_cells_is_empty_scope(monkeypatch):
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(1,), ("baseline-1", "EXCEL_IMPORT", None, None), (0,)]
    cursor.fetchall.return_value = []
    monkeypatch.setattr(dashboard_progress, "_shanghai_now", lambda: datetime(2026, 9, 11))

    result = dashboard_progress.get_competency_progress(
        year=2026, month=6, module_id=4, employee_id="e1",
        cursor=cursor, current_user={"user_id": "user-1"},
    )

    assert result["status"] == "empty_scope"
    assert result["employeeId"] == "e1"
    assert result["cellCount"] == 0
    assert result["kpis"] is None
    assert result["monthly"] == []


def test_detail_mode_returns_named_cells_and_reconciles_with_monthly_gap(monkeypatch):
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(1,), ("baseline-1", "EXCEL_IMPORT", None, None), (0,)]
    cursor.fetchall.side_effect = [
        [("e1", 1, 1, 3, "Chen Jianjun", 4, "TPM", "Top idea")],
        [("h1", "e1", 1, 2, datetime(2026, 3, 1))],
    ]
    monkeypatch.setattr(dashboard_progress, "_shanghai_now", lambda: datetime(2026, 9, 11))

    result = dashboard_progress.get_competency_progress(
        year=2026, month=6, module_id=4, employee_id="e1", include_details=True,
        cursor=cursor, current_user={"user_id": "user-1"},
    )

    assert result["details"] == [{
        "employeeId": "e1", "employeeName": "Chen Jianjun", "moduleId": 4,
        "moduleName": "TPM", "skillId": 1, "skillName": "Top idea",
        "initialCurrent": 1, "currentLevel": 2, "annualTarget": 3, "gap": 1,
    }]
    assert sum(item["gap"] for item in result["details"]) == result["monthly"][-1]["gap"]
    assert "e.name" in cursor.execute.call_args_list[-2].args[0]
