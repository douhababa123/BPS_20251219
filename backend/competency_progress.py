"""Pure annual-baseline KPI and selected-month trend calculations."""

from __future__ import annotations

import calendar
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional


def month_cutoff(year: int, month: int, now: datetime) -> datetime:
    if year == now.year and month == now.month:
        return now
    last_day = calendar.monthrange(year, month)[1]
    return datetime(year, month, last_day, 23, 59, 59, 999999)


def build_competency_progress(
    *,
    year: int,
    selected_month: int,
    baseline_id: str,
    module_id: Optional[int],
    cells: Iterable[Dict[str, Any]],
    history: Iterable[Dict[str, Any]],
    now: datetime,
) -> Dict[str, Any]:
    cells_list = list(cells)
    values = {
        (str(cell["employee_id"]).lower(), int(cell["skill_id"])): int(cell["initial_current"])
        for cell in cells_list
    }
    targets = {
        (str(cell["employee_id"]).lower(), int(cell["skill_id"])): int(cell["annual_target"])
        for cell in cells_list
    }
    history_list = sorted(
        list(history),
        key=lambda row: (row["changed_at"], str(row.get("id") or "")),
    )
    count = len(cells_list)
    baseline_current_total = sum(values.values())
    baseline_target_total = sum(targets.values())
    initial_gap = sum(max(targets[key] - values[key], 0) for key in values)

    monthly: List[Dict[str, Any]] = []
    history_index = 0
    for month in range(1, selected_month + 1):
        cutoff = month_cutoff(year, month, now)
        while history_index < len(history_list) and history_list[history_index]["changed_at"] <= cutoff:
            row = history_list[history_index]
            key = (str(row["employee_id"]).lower(), int(row["skill_id"]))
            if key in values:
                values[key] = int(row["current_level"])
            history_index += 1
        current_gap = sum(max(targets[key] - values[key], 0) for key in values)
        close_rate = None if initial_gap == 0 else (initial_gap - current_gap) / initial_gap * 100
        monthly.append({
            "month": month,
            "label": f"{year}{month:02d}",
            "gap": current_gap,
            "closeRate": close_rate,
            "isPartial": year == now.year and month == now.month,
            "cutoff": cutoff.isoformat(),
        })

    final = monthly[-1]
    return {
        "year": year,
        "month": selected_month,
        "moduleId": module_id,
        "baselineId": baseline_id,
        "cutoff": final["cutoff"],
        "isPartial": final["isPartial"],
        "cellCount": count,
        "kpis": {
            "initialLevel": baseline_current_total / count if count else None,
            "targetLevel": baseline_target_total / count if count else None,
            "currentLevel": sum(values.values()) / count if count else None,
            "initialGap": initial_gap,
            "currentGap": final["gap"],
            "closeRate": final["closeRate"],
        },
        "monthly": monthly,
    }
