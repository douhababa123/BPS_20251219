"""Annual competency Dashboard driven by immutable baseline cells."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from competency_progress import build_competency_progress
from database import get_db
from .auth import get_current_user


router = APIRouter()


def _shanghai_now() -> datetime:
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)


@router.get("/years")
def get_progress_years(
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    del current_user
    cursor.execute(
        "SELECT DISTINCT baseline_year FROM dbo.competency_annual_baselines ORDER BY baseline_year DESC"
    )
    years = [int(row[0]) for row in cursor.fetchall()]
    current_year = _shanghai_now().year
    if current_year not in years:
        years.insert(0, current_year)
    return {"years": years}


@router.get("/employees")
def get_progress_employees(
    year: int = Query(..., ge=2000, le=2100),
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    del current_user
    cursor.execute(
        """
        SELECT TOP 1 id FROM dbo.competency_annual_baselines
        WHERE baseline_year = ? AND is_active = 1
        ORDER BY selected_at DESC
        """,
        year,
    )
    baseline = cursor.fetchone()
    if not baseline:
        return []
    cursor.execute(
        """
        SELECT DISTINCT e.id, e.name
        FROM dbo.competency_annual_baseline_items i
        INNER JOIN dbo.employees e ON e.id = i.employee_id
        WHERE i.baseline_id = ?
        ORDER BY e.name, e.id
        """,
        str(baseline[0]),
    )
    return [{"id": str(row[0]), "name": row[1]} for row in cursor.fetchall()]


@router.get("")
def get_competency_progress(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    module_id: Optional[int] = Query(None, ge=1),
    employee_id: Optional[UUID] = None,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    del current_user
    employee_id = str(employee_id) if employee_id is not None else None
    now = _shanghai_now()
    if year > now.year:
        return {
            "year": year,
            "month": month,
            "moduleId": module_id,
            "employeeId": employee_id,
            "baselineId": None,
            "cutoff": None,
            "isPartial": False,
            "cellCount": 0,
            "kpis": None,
            "monthly": [],
            "status": "not_started",
            "dataQualityWarnings": [],
        }
    if year == now.year and month > now.month:
        raise HTTPException(status_code=422, detail="不能查询尚未到来的能力进度")

    if module_id is not None:
        cursor.execute(
            "SELECT TOP 1 1 FROM dbo.skills WHERE module_id = ? AND ISNULL(is_active, 1) = 1",
            module_id,
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=422, detail="能力模块不存在或未启用")

    cursor.execute(
        """
        SELECT TOP 1 id, source, source_filename, selected_at
        FROM dbo.competency_annual_baselines
        WHERE baseline_year = ? AND is_active = 1
        ORDER BY selected_at DESC
        """,
        year,
    )
    baseline = cursor.fetchone()
    if not baseline:
        return {
            "year": year,
            "month": month,
            "moduleId": module_id,
            "employeeId": employee_id,
            "baselineId": None,
            "cutoff": None,
            "isPartial": year == now.year and month == now.month,
            "cellCount": 0,
            "kpis": None,
            "monthly": [],
            "status": "missing_baseline",
            "dataQualityWarnings": [],
        }

    baseline_id = str(baseline[0])
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM dbo.competency_annual_baseline_items i
        LEFT JOIN dbo.employees e ON e.id = i.employee_id
        LEFT JOIN dbo.skills s ON s.id = i.skill_id
        WHERE i.baseline_id = ? AND (e.id IS NULL OR s.id IS NULL)
        """,
        baseline_id,
    )
    invalid_reference_count = int(cursor.fetchone()[0] or 0)
    if invalid_reference_count:
        return {
            "year": year,
            "month": month,
            "moduleId": module_id,
            "employeeId": employee_id,
            "baselineId": baseline_id,
            "cutoff": None,
            "isPartial": year == now.year and month == now.month,
            "cellCount": 0,
            "kpis": None,
            "monthly": [],
            "status": "data_quality_error",
            "dataQualityWarnings": [f"年度基线存在 {invalid_reference_count} 个无效员工或技能引用"],
        }
    module_filter = " AND s.module_id = ?" if module_id is not None else ""
    employee_filter = " AND i.employee_id = ?" if employee_id is not None else ""
    params = [baseline_id]
    if module_id is not None:
        params.append(module_id)
    if employee_id is not None:
        params.append(employee_id)
    cursor.execute(
        f"""
        SELECT i.employee_id, i.skill_id,
               i.initial_current_level, i.annual_target_level
        FROM dbo.competency_annual_baseline_items i
        INNER JOIN dbo.skills s ON s.id = i.skill_id
        WHERE i.baseline_id = ?{module_filter}{employee_filter}
        ORDER BY i.employee_id, i.skill_id
        """,
        params,
    )
    cells = [
        {
            "employee_id": str(row[0]),
            "skill_id": int(row[1]),
            "initial_current": int(row[2]),
            "annual_target": int(row[3]),
        }
        for row in cursor.fetchall()
    ]
    if not cells:
        return {
            "year": year,
            "month": month,
            "moduleId": module_id,
            "employeeId": employee_id,
            "baselineId": baseline_id,
            "cutoff": None,
            "isPartial": year == now.year and month == now.month,
            "cellCount": 0,
            "kpis": None,
            "monthly": [],
            "status": "empty_scope",
            "dataQualityWarnings": [],
        }

    # Query through the end of the selected month. The pure calculator applies
    # exact month-end and ongoing-month boundaries.
    query_end = now if year == now.year and month == now.month else datetime(year, month, 28)
    if not (year == now.year and month == now.month):
        from calendar import monthrange
        query_end = datetime(year, month, monthrange(year, month)[1], 23, 59, 59, 999999)
    cursor.execute(
        f"""
        SELECT h.id, h.employee_id, h.skill_id, h.current_level, h.changed_at
        FROM dbo.competency_assessment_history h
        INNER JOIN dbo.competency_annual_baseline_items i
            ON i.baseline_id = ?
           AND i.employee_id = h.employee_id
           AND i.skill_id = h.skill_id
        INNER JOIN dbo.skills s ON s.id = i.skill_id
        WHERE h.changed_at >= DATEFROMPARTS(?, 1, 1)
          AND h.changed_at <= ?{module_filter}{employee_filter}
        ORDER BY h.changed_at, h.id
        """,
        [baseline_id, year, query_end]
        + ([module_id] if module_id is not None else [])
        + ([employee_id] if employee_id is not None else []),
    )
    history = [
        {
            "id": str(row[0]),
            "employee_id": str(row[1]),
            "skill_id": int(row[2]),
            "current_level": int(row[3]),
            "changed_at": row[4],
        }
        for row in cursor.fetchall()
    ]
    result = build_competency_progress(
        year=year,
        selected_month=month,
        baseline_id=baseline_id,
        module_id=module_id,
        cells=cells,
        history=history,
        now=now,
    )
    result.update({
        "employeeId": employee_id,
        "status": "ready",
        "dataQualityWarnings": [],
        "baseline": {
            "source": baseline[1],
            "filename": baseline[2],
            "selectedAt": baseline[3].isoformat() if baseline[3] else None,
        },
    })
    return result
