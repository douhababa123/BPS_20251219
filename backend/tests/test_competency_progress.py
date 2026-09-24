from datetime import datetime

import pytest

from competency_progress import build_competency_progress


def test_selected_june_kpis_reuse_june_chart_values():
    cells = [
        {"employee_id": "e1", "skill_id": 1, "initial_current": 0, "annual_target": 4},
        {"employee_id": "e2", "skill_id": 1, "initial_current": 0, "annual_target": 4},
    ]
    history = [
        {"id": "h1", "employee_id": "e1", "skill_id": 1, "current_level": 2, "changed_at": datetime(2026, 3, 2)},
        {"id": "h2", "employee_id": "e2", "skill_id": 1, "current_level": 2, "changed_at": datetime(2026, 7, 1)},
    ]
    result = build_competency_progress(
        year=2026,
        selected_month=6,
        baseline_id="b1",
        module_id=None,
        cells=cells,
        history=history,
        now=datetime(2026, 9, 11, 12, 0),
    )

    assert len(result["monthly"]) == 6
    assert result["kpis"]["currentGap"] == result["monthly"][-1]["gap"] == 6
    assert result["kpis"]["closeRate"] == result["monthly"][-1]["closeRate"] == 25
    assert result["kpis"]["currentLevel"] == 1
    assert result["kpis"]["initialLevel"] == 0
    assert result["kpis"]["targetLevel"] == 4


def test_documented_200_to_160_example_is_exactly_twenty_percent():
    cells = [
        {"employee_id": f"e{index}", "skill_id": 1, "initial_current": 0, "annual_target": 4}
        for index in range(50)
    ]
    history = [
        {"id": f"h{index}", "employee_id": f"e{index}", "skill_id": 1, "current_level": 4, "changed_at": datetime(2026, 6, 1)}
        for index in range(10)
    ]
    result = build_competency_progress(
        year=2026, selected_month=6, baseline_id="b1", module_id=None,
        cells=cells, history=history, now=datetime(2026, 9, 11),
    )
    assert result["kpis"]["initialGap"] == 200
    assert result["kpis"]["currentGap"] == result["monthly"][-1]["gap"] == 160
    assert result["kpis"]["closeRate"] == result["monthly"][-1]["closeRate"] == 20


def test_month_without_edit_carries_forward_and_later_edit_is_excluded():
    result = build_competency_progress(
        year=2026,
        selected_month=6,
        baseline_id="b1",
        module_id=2,
        cells=[{"employee_id": "e1", "skill_id": 1, "initial_current": 1, "annual_target": 4}],
        history=[
            {"id": "h1", "employee_id": "e1", "skill_id": 1, "current_level": 2, "changed_at": datetime(2026, 2, 1)},
            {"id": "h2", "employee_id": "e1", "skill_id": 1, "current_level": 4, "changed_at": datetime(2026, 7, 1)},
        ],
        now=datetime(2026, 9, 11),
    )
    assert [point["gap"] for point in result["monthly"]] == [3, 2, 2, 2, 2, 2]


def test_zero_initial_gap_has_unavailable_close_rate():
    result = build_competency_progress(
        year=2026,
        selected_month=2,
        baseline_id="b1",
        module_id=None,
        cells=[{"employee_id": "e1", "skill_id": 1, "initial_current": 4, "annual_target": 4}],
        history=[],
        now=datetime(2026, 9, 11),
    )
    assert result["kpis"]["closeRate"] is None
    assert [point["closeRate"] for point in result["monthly"]] == [None, None]


def test_switching_month_keeps_all_three_baseline_kpis_unchanged():
    cells = [{"employee_id": "e1", "skill_id": 1, "initial_current": 1, "annual_target": 4}]
    history = [{"id": "h1", "employee_id": "e1", "skill_id": 1, "current_level": 3, "changed_at": datetime(2026, 7, 1)}]
    june = build_competency_progress(
        year=2026, selected_month=6, baseline_id="b1", module_id=1,
        cells=cells, history=history, now=datetime(2026, 9, 11),
    )
    july = build_competency_progress(
        year=2026, selected_month=7, baseline_id="b1", module_id=1,
        cells=cells, history=history, now=datetime(2026, 9, 11),
    )

    for key in ("initialLevel", "targetLevel", "initialGap"):
        assert june["kpis"][key] == july["kpis"][key]
    assert june["kpis"]["currentGap"] == 3
    assert july["kpis"]["currentGap"] == 1


def test_module_filtered_scope_keeps_kpis_equal_to_its_final_chart_point():
    cells = [
        {"employee_id": "e1", "skill_id": 1, "initial_current": 0, "annual_target": 4},
        {"employee_id": "e2", "skill_id": 1, "initial_current": 2, "annual_target": 4},
    ]
    history = [
        {"id": "h1", "employee_id": "e1", "skill_id": 1, "current_level": 2, "changed_at": datetime(2026, 6, 1)},
    ]

    result = build_competency_progress(
        year=2026, selected_month=6, baseline_id="b1", module_id=4,
        cells=cells, history=history, now=datetime(2026, 9, 11),
    )

    assert result["moduleId"] == 4
    assert result["kpis"]["currentGap"] == result["monthly"][-1]["gap"] == 4
    assert result["kpis"]["closeRate"] == result["monthly"][-1]["closeRate"] == pytest.approx(100 / 3)


def test_monthly_details_use_same_history_replay_and_sum_to_bar():
    cells = [
        {"employee_id": "e1", "employee_name": "Chen Jianjun", "skill_id": 1,
         "skill_name": "BPS Basic", "module_id": 2, "module_name": "BPS elements",
         "initial_current": 0, "annual_target": 4},
        {"employee_id": "e2", "employee_name": "Xue Ting", "skill_id": 1,
         "skill_name": "BPS Basic", "module_id": 2, "module_name": "BPS elements",
         "initial_current": 2, "annual_target": 4},
    ]
    history = [
        {"id": "h1", "employee_id": "e1", "skill_id": 1, "current_level": 1,
         "changed_at": datetime(2026, 6, 1)},
        {"id": "h2", "employee_id": "e1", "skill_id": 1, "current_level": 3,
         "changed_at": datetime(2026, 7, 1)},
    ]
    june = build_competency_progress(
        year=2026, selected_month=6, baseline_id="b1", module_id=2,
        cells=cells, history=history, now=datetime(2026, 9, 11), include_details=True,
    )
    assert [item["currentLevel"] for item in june["details"]] == [1, 2]
    assert [item["gap"] for item in june["details"]] == [3, 2]
    assert sum(item["gap"] for item in june["details"]) == june["monthly"][-1]["gap"] == 5
    assert june["details"][0]["employeeName"] == "Chen Jianjun"
    july = build_competency_progress(
        year=2026, selected_month=7, baseline_id="b1", module_id=2,
        cells=cells, history=history, now=datetime(2026, 9, 11), include_details=True,
    )
    assert sum(item["gap"] for item in july["details"]) == july["monthly"][-1]["gap"] == 3


def test_current_month_details_use_partial_cutoff():
    result = build_competency_progress(
        year=2026, selected_month=9, baseline_id="b1", module_id=None,
        cells=[{"employee_id": "e1", "employee_name": "A", "skill_id": 1,
                "skill_name": "Skill", "module_id": 1, "module_name": "Module",
                "initial_current": 0, "annual_target": 4}],
        history=[{"id": "h1", "employee_id": "e1", "skill_id": 1,
                  "current_level": 2, "changed_at": datetime(2026, 9, 12)}],
        now=datetime(2026, 9, 11, 12), include_details=True,
    )
    assert result["isPartial"] is True
    assert result["details"][0]["currentLevel"] == 0
    assert result["details"][0]["gap"] == result["monthly"][-1]["gap"] == 4
