from datetime import datetime
from unittest.mock import MagicMock

from routers import departments


def test_get_departments_filters_inactive_departments():
    cursor = MagicMock()
    now = datetime(2026, 7, 16, 9, 0)
    cursor.fetchall.return_value = [
        (9, "FCLCh", "FCLCh", "Active department", now, now),
    ]

    result = departments.get_departments(cursor=cursor)

    query = " ".join(cursor.execute.call_args.args[0].split())
    assert "WHERE ISNULL(is_active, 1) = 1" in query
    assert [department.name for department in result] == ["FCLCh"]
