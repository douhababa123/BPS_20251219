from unittest.mock import MagicMock
from uuid import uuid4

from routers.matching import (
    candidate_passes_hard_gates,
    matching_candidate_sort_key,
    meets_required_levels,
    preview_matching,
)


HUANG_LOGISTIC = [{"skill_id": 20, "current_level": 3, "target_level": 3}]


def requirement(level):
    return [{"skill_id": 20, "required_level": level, "is_key": True}]


def test_huang_logistic_l2_and_l3_pass_only_without_date_conflict():
    for level in (2, 3):
        assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(level), 0, "OK") is True
        assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(level), 1, "OK") is False


def test_huang_logistic_l4_fails_even_without_date_conflict():
    assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(4), 0, "OK") is False


def test_missing_assessment_is_not_treated_as_level_zero_candidate():
    assert meets_required_levels([], requirement(0)) is False


def test_suggested_candidate_only_wins_an_equal_score_tie():
    candidates = [
        {"name": "B", "finalScore": 0.9, "badges": ["suggested"]},
        {"name": "A", "finalScore": 1.0, "badges": []},
        {"name": "C", "finalScore": 0.9, "badges": []},
    ]
    ordered = sorted(candidates, key=matching_candidate_sort_key)
    assert [candidate["name"] for candidate in ordered] == ["A", "B", "C"]


def test_preview_returns_every_eligible_active_account_candidate_with_stable_order():
    cursor = MagicMock()
    employee_ids = [str(uuid4()) for _ in range(6)]
    names = ["Zulu", "Echo", "Delta", "Charlie", "Bravo", "Alpha"]
    cursor.fetchall.side_effect = [
        [(20, "Logistic index")],
        [(employee_ids[index], name, "BPS") for index, name in enumerate(names)],
        *[[(20, "Logistic index", 3, 3)] for _ in employee_ids],
    ]
    cursor.fetchone.side_effect = [(0,) for _ in employee_ids]

    result = preview_matching({
        "name": "Logistic task",
        "role": "Member",
        "moduleId": 1,
        "startDate": "2026-09-14",
        "endDate": "2026-09-14",
        "required": [{"skill_id": 20, "required_level": 2, "is_key": True}],
        "suggestedUserId": employee_ids[0],
    }, cursor=cursor)

    assert len(result) == 6
    assert [candidate["name"] for candidate in result] == [
        "Zulu", "Alpha", "Bravo", "Charlie", "Delta", "Echo",
    ]
    employee_query = cursor.execute.call_args_list[1].args[0]
    assert "ISNULL(e.is_active, 1) = 1" in employee_query
    assert "ISNULL(u.is_active, 1) = 1" in employee_query
