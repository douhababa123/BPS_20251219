"""Domain operations for current competency values and append-only history."""

from __future__ import annotations

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


def normalize_name(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _owner_configuration(cursor):
    cursor.execute(
        """
        SELECT DISTINCT module_id, module_name
        FROM dbo.skills
        WHERE ISNULL(is_active, 1) = 1
        ORDER BY module_id
        """
    )
    modules = {int(row[0]): str(row[1] or f"模块 {row[0]}") for row in cursor.fetchall()}
    cursor.execute(
        """
        SELECT module_id, owner_engineer
        FROM dbo.competency_definitions
        WHERE ISNULL(is_active, 1) = 1
        ORDER BY module_id
        """
    )
    owner_names: Dict[int, set[str]] = {module_id: set() for module_id in modules}
    for row in cursor.fetchall():
        owner_names.setdefault(int(row[0]), set()).add(normalize_name(row[1]))
    cursor.execute(
        """
        SELECT e.name
        FROM dbo.employees e
        WHERE ISNULL(e.is_active, 1) = 1
          AND EXISTS (
              SELECT 1 FROM dbo.users u
              WHERE ISNULL(u.is_active, 1) = 1
                AND (
                    u.id = e.auth_user_id
                    OR (u.email IS NOT NULL AND e.email IS NOT NULL AND LOWER(u.email) = LOWER(e.email))
                )
          )
        """
    )
    active_name_counts: Dict[str, int] = {}
    for row in cursor.fetchall():
        name = normalize_name(row[0])
        if name:
            active_name_counts[name] = active_name_counts.get(name, 0) + 1
    return modules, owner_names, active_name_counts


def owner_configuration_warnings(cursor) -> List[str]:
    modules, owner_names, active_name_counts = _owner_configuration(cursor)
    warnings: List[str] = []
    for module_id, module_name in modules.items():
        names = owner_names.get(module_id, set())
        valid_names = {name for name in names if name}
        if len(names) != 1 or len(valid_names) != 1:
            warnings.append(f"{module_name} 的模块 Owner 配置缺失或不一致")
            continue
        owner_name = next(iter(valid_names))
        if active_name_counts.get(owner_name, 0) != 1:
            warnings.append(f"{module_name} 的模块 Owner 无法唯一匹配启用员工和账号")
    return warnings


def resolve_editable_module_ids(cursor, current_user: dict) -> set[int] | None:
    """Return None for admin-all, otherwise the valid modules owned by the user."""

    if normalize_email(current_user.get("role")) == "admin":
        return None

    cursor.execute(
        """
        SELECT TOP 1 e.id, e.name
        FROM dbo.employees e
        INNER JOIN dbo.users u
            ON u.id = ?
           AND ISNULL(u.is_active, 1) = 1
        WHERE ISNULL(e.is_active, 1) = 1
          AND (
              e.auth_user_id = u.id
              OR (e.email IS NOT NULL AND u.email IS NOT NULL AND LOWER(e.email) = LOWER(u.email))
          )
        """,
        current_user.get("user_id"),
    )
    employee = cursor.fetchone()
    if not employee:
        return set()

    _, owner_names, active_name_counts = _owner_configuration(cursor)
    employee_name = normalize_name(employee[1])
    return {
        module_id
        for module_id, names in owner_names.items()
        if employee_name
        and len(names) == 1
        and employee_name in names
        and active_name_counts.get(employee_name, 0) == 1
    }


def ensure_module_editable(cursor, current_user: dict, skill_id: int, editable_module_ids=None) -> int:
    cursor.execute(
        "SELECT module_id FROM dbo.skills WHERE id = ? AND ISNULL(is_active, 1) = 1",
        skill_id,
    )
    skill = cursor.fetchone()
    if not skill:
        raise HTTPException(status_code=404, detail="技能不存在")
    module_id = int(skill[0])
    allowed = editable_module_ids
    if allowed is None and normalize_email(current_user.get("role")) != "admin":
        allowed = resolve_editable_module_ids(cursor, current_user)
    if allowed is not None and module_id not in allowed:
        raise HTTPException(status_code=403, detail="只能编辑本人负责的能力模块")
    return module_id


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

    ensure_module_editable(cursor, current_user, skill_id)
    cursor.execute(
        "SELECT id FROM dbo.employees WHERE id = ? AND ISNULL(is_active, 1) = 1",
        str(employee_id),
    )
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="员工不存在")

    now = current_timestamp()
    cursor.execute("SELECT NEWID()")
    version_id = str(cursor.fetchone()[0])
    cursor.execute(
        """
        INSERT INTO dbo.competency_assessment_versions (
            id, created_by_user_id, created_at, cell_count, source, notes
        ) VALUES (?, ?, ?, 1, 'WEB_BATCH_SAVE', ?)
        """,
        version_id,
        current_user.get("user_id"),
        now,
        payload.notes,
    )
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
            change_source,
            version_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEB_BATCH_SAVE', ?)
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
        version_id,
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
    editable_module_ids = current_user.get("editable_module_ids", [])
    can_edit_any = editable_module_ids is None or bool(editable_module_ids)
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
                    "updatedAt": cell[5].isoformat() if len(cell) > 5 and cell[5] else None,
                }
        rows.append(
            {
                "employeeId": employee_id,
                "employeeCode": employee[1] or "",
                "employeeName": employee[2] or "",
                "departmentName": employee[3],
                "canEdit": can_edit_any,
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
        "editableModuleIds": None if editable_module_ids is None else sorted(editable_module_ids),
    }


def _same_timestamp(expected, actual) -> bool:
    if expected is None or actual is None:
        return expected is None and actual is None
    if getattr(expected, "tzinfo", None):
        expected = expected.replace(tzinfo=None)
    if getattr(actual, "tzinfo", None):
        actual = actual.replace(tzinfo=None)
    return expected == actual


def save_assessment_batch(cursor, cells, notes: str | None, current_user: dict) -> Dict[str, Any]:
    """Validate and save one business version atomically on the caller transaction."""

    if not cells:
        raise HTTPException(status_code=422, detail="至少需要一个修改单元")
    pairs = [(str(cell.employee_id).lower(), int(cell.skill_id)) for cell in cells]
    if len(pairs) != len(set(pairs)):
        raise HTTPException(status_code=422, detail="同一员工和技能不能重复提交")

    editable_modules = resolve_editable_module_ids(cursor, current_user)
    now = current_timestamp()
    locked: Dict[tuple[str, int], Any] = {}
    for cell in sorted(cells, key=lambda item: (str(item.employee_id), item.skill_id)):
        ensure_module_editable(cursor, current_user, cell.skill_id, editable_modules)
        cursor.execute(
            "SELECT id FROM dbo.employees WHERE id = ? AND ISNULL(is_active, 1) = 1",
            str(cell.employee_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="员工不存在")
        cursor.execute(
            """
            SELECT id, updated_at
            FROM dbo.competency_assessments WITH (UPDLOCK, HOLDLOCK)
            WHERE employee_id = ? AND skill_id = ?
            """,
            str(cell.employee_id),
            cell.skill_id,
        )
        row = cursor.fetchone()
        actual_updated_at = row[1] if row else None
        if not _same_timestamp(cell.expected_updated_at, actual_updated_at):
            raise HTTPException(status_code=409, detail="能力数据已被其他人修改，请重新加载后比较")
        locked[(str(cell.employee_id).lower(), int(cell.skill_id))] = row

    cursor.execute("SELECT NEWID()")
    version_id = str(cursor.fetchone()[0])
    cursor.execute(
        """
        INSERT INTO dbo.competency_assessment_versions (
            id, created_by_user_id, created_at, cell_count, source, notes
        ) VALUES (?, ?, ?, ?, 'WEB_BATCH_SAVE', ?)
        """,
        version_id,
        current_user.get("user_id"),
        now,
        len(cells),
        notes,
    )

    for cell in cells:
        row = locked[(str(cell.employee_id).lower(), int(cell.skill_id))]
        if row:
            assessment_id = str(row[0])
            cursor.execute(
                """
                UPDATE dbo.competency_assessments
                SET current_level = ?, target_level = ?, assessment_year = ?,
                    assessment_date = ?, notes = ?, updated_at = ?
                WHERE id = ?
                """,
                cell.current_level, cell.target_level, now.year, now,
                cell.notes, now, assessment_id,
            )
        else:
            cursor.execute("SELECT NEWID()")
            assessment_id = str(cursor.fetchone()[0])
            cursor.execute(
                """
                INSERT INTO dbo.competency_assessments (
                    id, employee_id, skill_id, current_level, target_level,
                    assessment_year, assessment_date, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                assessment_id, str(cell.employee_id), cell.skill_id,
                cell.current_level, cell.target_level, now.year, now,
                cell.notes, now, now,
            )
        cursor.execute(
            """
            INSERT INTO dbo.competency_assessment_history (
                assessment_id, employee_id, skill_id, current_level, target_level,
                assessment_date, assessment_year, assessment_quarter, notes,
                changed_at, changed_by_user_id, change_source, version_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEB_BATCH_SAVE', ?)
            """,
            assessment_id, str(cell.employee_id), cell.skill_id,
            cell.current_level, cell.target_level, now, now.year,
            quarter_for(now), cell.notes, now, current_user.get("user_id"), version_id,
        )
    return {"versionId": version_id, "savedCount": len(cells), "savedAt": now.isoformat()}
