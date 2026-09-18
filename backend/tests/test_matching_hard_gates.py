from unittest.mock import MagicMock
from uuid import uuid4

from routers.matching import (
    calculate_competency_fit,
    calculate_time_availability,
    candidate_passes_hard_gates,
    is_schedule_exempt_employee,
    matching_candidate_sort_key,
    meets_required_levels,
    preview_matching,
)


HUANG_LOGISTIC = [{"skill_id": 20, "current_level": 3, "target_level": 3}]


def requirement(level):
    return [{"skill_id": 20, "required_level": level, "is_key": True}]


def test_huang_logistic_l2_and_l3_pass_only_without_date_conflict():
    for level in (2, 3):
        assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(level), "OK") is True


def test_huang_logistic_l4_fails_even_without_date_conflict():
    assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(4), "OK") is False


def test_target_exact_candidate_can_be_recommended_for_development():
    assessments = [{"skill_id": 20, "current_level": 2, "target_level": 3}]
    assert candidate_passes_hard_gates(assessments, requirement(3), "OK") is True


def test_candidate_between_current_and_nonmatching_target_is_not_eligible():
    assessments = [{"skill_id": 20, "current_level": 2, "target_level": 4}]
    assert candidate_passes_hard_gates(assessments, requirement(3), "OK") is False


def test_only_resource_matching_employees_are_schedule_exempt():
    assert is_schedule_exempt_employee("SCh_Tyler_Tan") is True
    assert is_schedule_exempt_employee("15001437") is True
    assert is_schedule_exempt_employee("schn-me_huang_lanping") is False


def test_schedule_exemption_does_not_bypass_competency_or_role_gates():
    assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(3), "OK") is True
    assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(4), "OK") is False
    assert candidate_passes_hard_gates(HUANG_LOGISTIC, requirement(3), "FAIL") is False


def test_missing_assessment_is_not_treated_as_level_zero_candidate():
    assert meets_required_levels([], requirement(0)) is False


def test_time_fit_is_the_absolute_first_sort_priority():
    candidates = [
        {
            "name": "Target Match", "timeScore": 0.8, "targetMatchRate": 1.0,
            "currentMatchRate": 0.0, "overqualification": 0.0, "badges": ["suggested"],
        },
        {
            "name": "Available Overqualified", "timeScore": 1.0, "targetMatchRate": 0.0,
            "currentMatchRate": 0.0, "overqualification": 1.0, "badges": [],
        },
    ]
    ordered = sorted(candidates, key=matching_candidate_sort_key)
    assert [candidate["name"] for candidate in ordered] == [
        "Available Overqualified", "Target Match",
    ]


def test_equal_time_uses_target_then_current_then_smallest_overqualification():
    candidates = [
        {"name": "Over 2", "timeScore": 0.75, "targetMatchRate": 0.0, "currentMatchRate": 0.0, "overqualification": 2.0, "badges": []},
        {"name": "Current", "timeScore": 0.75, "targetMatchRate": 0.0, "currentMatchRate": 1.0, "overqualification": 0.0, "badges": []},
        {"name": "Target", "timeScore": 0.75, "targetMatchRate": 1.0, "currentMatchRate": 0.0, "overqualification": 0.0, "badges": []},
        {"name": "Over 1", "timeScore": 0.75, "targetMatchRate": 0.0, "currentMatchRate": 0.0, "overqualification": 1.0, "badges": []},
    ]
    ordered = sorted(candidates, key=matching_candidate_sort_key)
    assert [candidate["name"] for candidate in ordered] == [
        "Target", "Current", "Over 1", "Over 2",
    ]


def test_key_competencies_have_double_weight_in_fit_rates():
    assessments = [
        {"skill_id": 20, "current_level": 2, "target_level": 3},
        {"skill_id": 21, "current_level": 3, "target_level": 4},
    ]
    required = [
        {"skill_id": 20, "required_level": 3, "is_key": True},
        {"skill_id": 21, "required_level": 3, "is_key": False},
    ]
    fit = calculate_competency_fit(assessments, required)
    assert fit["eligible"] is True
    assert fit["target_match_rate"] == 0.67
    assert fit["current_match_rate"] == 0.33
    assert fit["category"] == "target_match"


def test_time_availability_uses_am_and_pm_hours_and_keeps_conflict_details():
    availability = calculate_time_availability(
        "2026-09-14",
        "2026-09-14",
        [("2026-09-14", "2026-09-14", "AM", "Morning task")],
    )
    assert availability["total_hours"] == 8.0
    assert availability["occupied_hours"] == 3.5
    assert availability["free_hours"] == 4.5
    assert availability["time_score"] == 0.5625
    assert availability["conflicts"] == [
        {"date": "2026-09-14", "slot": "AM", "taskName": "Morning task"}
    ]


def test_preview_returns_every_eligible_active_account_candidate_with_stable_order():
    cursor = MagicMock()
    employee_ids = [str(uuid4()) for _ in range(6)]
    names = ["Zulu", "Echo", "Delta", "Charlie", "Bravo", "Alpha"]
    cursor.fetchall.side_effect = [
        [(20, "Logistic index")],
        [(employee_ids[index], name, "BPS", f"E{index}") for index, name in enumerate(names)],
        *[entry for _ in employee_ids for entry in (
            [(20, "Logistic index", 3, 3)],
            [],
        )],
    ]

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


def test_preview_keeps_partially_available_candidates_and_orders_by_time_first():
    cursor = MagicMock()
    employee_ids = [str(uuid4()), str(uuid4())]
    cursor.fetchall.side_effect = [
        [(20, "Logistic index")],
        [
            (employee_ids[0], "More available", "BPS", "E1"),
            (employee_ids[1], "Better target", "BPS", "E2"),
        ],
        [(20, "Logistic index", 4, 4)],
        [("2026-09-14", "2026-09-14", "AM", "Morning task")],
        [(20, "Logistic index", 2, 3)],
        [("2026-09-14", "2026-09-14", "PM", "Afternoon task")],
    ]

    result = preview_matching({
        "name": "Logistic task",
        "role": "Member",
        "moduleId": 1,
        "startDate": "2026-09-14",
        "endDate": "2026-09-14",
        "required": [{"skill_id": 20, "required_level": 3, "is_key": True}],
    }, cursor=cursor)

    assert [candidate["name"] for candidate in result] == ["More available", "Better target"]
    assert result[0]["timeScore"] == 0.56
    assert result[1]["timeScore"] == 0.44
    assert all(candidate["qualified"] is True for candidate in result)
    assert all(candidate["fullyAvailable"] is False for candidate in result)


def test_preview_does_not_query_schedule_for_resource_only_employee():
    cursor = MagicMock()
    employee_id = str(uuid4())
    cursor.fetchall.side_effect = [
        [(20, "Logistic index")],
        [(employee_id, "Tyler Tan", "BPS", "SCh_Tyler_Tan")],
        [(20, "Logistic index", 3, 3)],
    ]

    result = preview_matching({
        "name": "Logistic task",
        "role": "Member",
        "moduleId": 1,
        "startDate": "2026-09-14",
        "endDate": "2026-09-14",
        "required": [{"skill_id": 20, "required_level": 2, "is_key": True}],
    }, cursor=cursor)

    assert [candidate["name"] for candidate in result] == ["Tyler Tan"]
    executed_sql = [call.args[0] for call in cursor.execute.call_args_list]
    assert not any("FROM dbo.tasks" in sql for sql in executed_sql)
    assert result[0]["timeScore"] == 1.0
