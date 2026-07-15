"""Domain operations for current competency values and append-only history."""

from datetime import datetime
from typing import Any, Dict, Iterable, List, Sequence

from fastapi import HTTPException


def current_timestamp() -> datetime:
    """Return the server timestamp used by both projection and history."""

    return datetime.now()


def quarter_for(value: datetime) -> int:
    return ((value.month - 1) // 3) + 1


def normalize_email(value: Any) -> str:
    return str(value or "").strip().lower()


def resolve_employee_scope(
    cursor,
    current_user: dict,
    employee_id,
    allow_all_admin: bool = True,
) -> None:
    cursor.execute(
        """
        SELECT id, LOWER(LTRIM(RTRIM(email)))
        FROM dbo.employees
        WHERE id = ? AND ISNULL(is_active, 1) = 1
        """,
        str(employee_id),
    )
    employee = cursor.fetchone()
    if not employee:
        raise HTTPException(status_code=404, detail="员工不存在")

    role = normalize_email(current_user.get("role"))
    if allow_all_admin and role == "admin":
        return

    if not employee[1] or normalize_email(employee[1]) != normalize_email(
        current_user.get("email")
    ):
        raise HTTPException(status_code=403, detail="只能访问本人的能力评估")


def save_latest_assessment(
    cursor,
    employee_id,
    skill_id: int,
    payload,
    current_user: dict,
) -> str:
    """Upsert the latest projection and append one history row without committing."""

    resolve_employee_scope(cursor, current_user, employee_id)
    cursor.execute(
        "SELECT id FROM dbo.skills WHERE id = ? AND ISNULL(is_active, 1) = 1",
        skill_id,
    )
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="技能不存在")

    now = current_timestamp()
    cursor.execute(
        """
        SELECT id
        FROM dbo.competency_assessments WITH (UPDLOCK, HOLDLOCK)
        WHERE employee_id = ? AND skill_id = ?
        """,
        str(employee_id),
        skill_id,
    )
    row = cursor.fetchone()

    if row:
        assessment_id = str(row[0])
        cursor.execute(
            """
            UPDATE dbo.competency_assessments
            SET current_level = ?,
                target_level = ?,
                assessment_year = ?,
                assessment_date = ?,
                notes = ?,
                updated_at = ?
            WHERE id = ?
            """,
            payload.current_level,
            payload.target_level,
            now.year,
            now,
            payload.notes,
            now,
            assessment_id,
        )
    else:
        cursor.execute("SELECT NEWID()")
        assessment_id = str(cursor.fetchone()[0])
        cursor.execute(
            """
            INSERT INTO dbo.competency_assessments (
                id,
                employee_id,
                skill_id,
                current_level,
                target_level,
                assessment_year,
                assessment_date,
                notes,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            assessment_id,
            str(employee_id),
            skill_id,
            payload.current_level,
            payload.target_level,
            now.year,
            now,
            payload.notes,
            now,
            now,
        )

    cursor.execute(
        """
        INSERT INTO dbo.competency_assessment_history (
            assessment_id,
            employee_id,
            skill_id,
            current_level,
            target_level,
            assessment_date,
            assessment_year,
            assessment_quarter,
            notes,
            changed_at,
            changed_by_user_id,
            change_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEB_EDIT')
        """,
        assessment_id,
        str(employee_id),
        skill_id,
        payload.current_level,
        payload.target_level,
        now,
        now.year,
        quarter_for(now),
        payload.notes,
        now,
        current_user.get("user_id"),
    )
    return assessment_id


def validate_gap_trend_scope(cursor, module_id=None, skill_id=None) -> None:
    """Validate active module/skill filters and their relationship."""

    if module_id is not None:
        cursor.execute(
            """SELECT TOP 1 module_id FROM dbo.skills
               WHERE module_id = ? AND ISNULL(is_active, 1) = 1""",
            module_id,
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=422, detail="能力模块不存在或未启用")

    if skill_id is not None:
        cursor.execute(
            """SELECT module_id FROM dbo.skills
               WHERE id = ? AND ISNULL(is_active, 1) = 1""",
            skill_id,
        )
        skill = cursor.fetchone()
        if not skill:
            raise HTTPException(status_code=422, detail="技能不存在或未启用")
        if module_id is not None and int(skill[0]) != module_id:
            raise HTTPException(status_code=422, detail="技能不属于所选能力模块")


def build_gap_trend(cursor, year: int, module_id=None, skill_id=None) -> List[Dict[str, Any]]:
    """Build four quarter-end GAP snapshots with cross-year carry-forward."""

    filters = []
    params = [year, year, year, year]
    if module_id is not None:
        filters.append("s.module_id = ?")
        params.append(module_id)
    if skill_id is not None:
        filters.append("s.id = ?")
        params.append(skill_id)
    filter_sql = "".join(f" AND {item}" for item in filters)

    cursor.execute(
        f"""
        WITH quarters AS (
            SELECT 1 AS quarter_number, DATEFROMPARTS(?, 3, 31) AS quarter_end
            UNION ALL SELECT 2, DATEFROMPARTS(?, 6, 30)
            UNION ALL SELECT 3, DATEFROMPARTS(?, 9, 30)
            UNION ALL SELECT 4, DATEFROMPARTS(?, 12, 31)
        )
        SELECT
            q.quarter_number,
            ISNULL(t.total_gap, 0) AS total_gap,
            ISNULL(t.data_count, 0) AS data_count
        FROM quarters q
        OUTER APPLY (
            SELECT
                SUM(latest.gap) AS total_gap,
                COUNT(latest.gap) AS data_count
            FROM dbo.employees e
            CROSS JOIN dbo.skills s
            OUTER APPLY (
                SELECT TOP 1 h.target_level - h.current_level AS gap
                FROM dbo.competency_assessment_history h
                WHERE h.employee_id = e.id
                  AND h.skill_id = s.id
                  AND h.changed_at < DATEADD(day, 1, q.quarter_end)
                ORDER BY h.changed_at DESC, h.id DESC
            ) latest
            WHERE ISNULL(e.is_active, 1) = 1
              AND ISNULL(s.is_active, 1) = 1
              {filter_sql}
        ) t
        ORDER BY q.quarter_number
        """,
        params,
    )

    return [
        {
            "quarter": int(row[0]),
            "label": f"Q{int(row[0])}",
            "totalGap": int(row[1] or 0),
            "hasData": int(row[2] or 0) > 0,
        }
        for row in cursor.fetchall()
    ]


def build_matrix_payload(
    employees: Sequence,
    skills: Sequence,
    assessments: Iterable,
    current_user: dict,
) -> Dict[str, Any]:
    cells = {(str(row[0]).lower(), row[1]): row for row in assessments}
    is_admin = normalize_email(current_user.get("role")) == "admin"
    user_email = normalize_email(current_user.get("email"))
    rows: List[Dict[str, Any]] = []

    for employee in employees:
        employee_id = str(employee[0])
        employee_skills = {}
        for skill in skills:
            cell = cells.get((employee_id.lower(), skill[0]))
            if cell:
                employee_skills[skill[0]] = {
                    "skillId": skill[0],
                    "currentLevel": cell[2],
                    "targetLevel": cell[3],
                    "gap": cell[4],
                }
        rows.append(
            {
                "employeeId": employee_id,
                "employeeCode": employee[1] or "",
                "employeeName": employee[2] or "",
                "departmentName": employee[3],
                "canEdit": is_admin
                or bool(employee[4] and normalize_email(employee[4]) == user_email),
                "skills": employee_skills,
            }
        )

    columns = [
        {
            "skillId": skill[0],
            "moduleId": skill[1],
            "moduleName": skill[2] or "",
            "skillName": skill[3] or "",
            "displayOrder": skill[4] or 0,
        }
        for skill in skills
    ]
    values = list(cells.values())
    total_gap = sum(row[4] for row in values)
    count = len(values)
    return {
        "rows": rows,
        "columns": columns,
        "stats": {
            "totalEmployees": len(rows),
            "totalSkills": len(columns),
            "totalAssessments": count,
            "avgCurrentLevel": round(sum(row[2] for row in values) / count, 1)
            if count
            else 0,
            "avgTargetLevel": round(sum(row[3] for row in values) / count, 1)
            if count
            else 0,
            "avgGap": round(total_gap / count, 1) if count else 0,
            "totalGapScore": total_gap,
        },
    }
