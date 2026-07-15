from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from competency_assessment_history import build_gap_trend, validate_gap_trend_scope
from routers import competency_assessments


def test_gap_trend_uses_as_of_snapshots_and_returns_four_quarters():
    cursor = MagicMock()
    cursor.fetchall.return_value = [(1, 12, 3), (2, 10, 3), (3, 0, 1), (4, 0, 0)]

    result = build_gap_trend(cursor, year=2026, module_id=None, skill_id=None)

    sql = cursor.execute.call_args.args[0]
    assert "OUTER APPLY" in sql
    assert "changed_at < DATEADD(day, 1, q.quarter_end)" in sql
    assert "ORDER BY h.changed_at DESC, h.id DESC" in sql
    assert "ISNULL(e.is_active, 1) = 1" in sql
    assert "ISNULL(s.is_active, 1) = 1" in sql
    assert "h.changed_at >=" not in sql
    assert [point["label"] for point in result] == ["Q1", "Q2", "Q3", "Q4"]
    assert [point["hasData"] for point in result] == [True, True, True, False]
    assert result[2]["totalGap"] == 0


def test_gap_trend_applies_linked_module_and_skill_filters():
    cursor = MagicMock()
    cursor.fetchall.return_value = [(1, 2, 1), (2, 2, 1), (3, 2, 1), (4, 2, 1)]

    build_gap_trend(cursor, year=2026, module_id=7, skill_id=99)

    sql, params = cursor.execute.call_args.args
    assert "s.module_id = ?" in sql
    assert "s.id = ?" in sql
    assert params == [2026, 2026, 2026, 2026, 7, 99]


def test_gap_trend_rejects_skill_outside_selected_module():
    cursor = MagicMock()
    cursor.fetchone.side_effect = [(7,), (8,)]

    with pytest.raises(HTTPException) as error:
        validate_gap_trend_scope(cursor, module_id=7, skill_id=99)

    assert error.value.status_code == 422


def test_gap_trend_rejects_inactive_or_unknown_scope():
    cursor = MagicMock()
    cursor.fetchone.return_value = None

    with pytest.raises(HTTPException) as error:
        validate_gap_trend_scope(cursor, module_id=7, skill_id=None)

    assert error.value.status_code == 422


def test_gap_trend_static_route_precedes_uuid_route():
    paths = [route.path for route in competency_assessments.router.routes]

    assert paths.index("/gap-trend") < paths.index("/{assessment_id}")

