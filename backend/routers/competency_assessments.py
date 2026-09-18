"""
能力评估路由
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from uuid import UUID
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    CompetencyAssessment, 
    CompetencyAssessmentCreate, 
    CompetencyAssessmentUpdate, 
    CompetencyAssessmentSave,
    CompetencyAssessmentBatchSave,
    CompetencyAssessmentHistoryResponse,
    MessageResponse
)
from database import get_db
from .auth import get_current_user
from competency_assessment_history import (
    build_gap_trend,
    build_matrix_payload,
    owner_configuration_warnings,
    resolve_employee_scope,
    resolve_editable_module_ids,
    save_assessment_batch,
    save_latest_assessment,
    validate_gap_trend_scope,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/full")
def get_competency_assessments_full(
    department_id: Optional[int] = None,
    cursor=Depends(get_db)
):
    """
    获取完整能力评估数据（含员工、技能、部门关联信息）
    单次 SQL JOIN 返回，避免前端多请求合并
    """
    query = """
        SELECT
            ca.id,
            CAST(ca.employee_id AS NVARCHAR(36)) AS employee_id,
            e.employee_id AS employee_code,
            e.name AS employee_name,
            d.name AS department_name,
            d.code AS department_code,
            ca.skill_id,
            s.module_id,
            s.module_name,
            s.skill_name,
            COALESCE(s.display_order, 0) AS display_order,
            ca.current_level,
            ca.target_level,
            ca.target_level - ca.current_level AS gap,
            COALESCE(ca.assessment_year, YEAR(ca.assessment_date)) AS assessment_year,
            ca.assessment_date,
            ca.notes,
            ca.created_at,
            ca.updated_at
        FROM dbo.competency_assessments ca
        JOIN dbo.employees e ON ca.employee_id = e.id
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        JOIN dbo.skills s ON ca.skill_id = s.id
        WHERE e.is_active = 1
          AND ISNULL(s.is_active, 1) = 1
    """
    params = []
    if department_id is not None:
        query += " AND e.department_id = ?"
        params.append(department_id)
    query += " ORDER BY e.name, s.module_id, s.display_order"

    cursor.execute(query, params) if params else cursor.execute(query)

    results = []
    for row in cursor.fetchall():
        assessment_date = row[15]
        results.append({
            "id": str(row[0]),
            "employee_id": str(row[1]),
            "employee_code": row[2] or "",
            "employee_name": row[3] or "",
            "department_name": row[4],
            "department_code": row[5],
            "skill_id": row[6],
            "module_id": row[7],
            "module_name": row[8] or "",
            "skill_name": row[9] or "",
            "display_order": row[10] or 0,
            "current_level": row[11],
            "target_level": row[12],
            "gap": row[13],
            "assessment_year": row[14],
            "assessment_date": assessment_date.isoformat() if assessment_date else None,
            "notes": row[16],
            "created_at": row[17].isoformat() if row[17] else None,
            "updated_at": row[18].isoformat() if row[18] else None,
        })

    return results


@router.get("/", response_model=List[CompetencyAssessment])
def get_competency_assessments(cursor=Depends(get_db)):
    """获取所有能力评估列表"""
    cursor.execute("""
        SELECT id, employee_id, skill_id, current_level, target_level, 
               target_level - current_level AS gap, assessment_date, notes,
               created_at, updated_at
        FROM dbo.competency_assessments WITH (NOLOCK)
        ORDER BY assessment_date DESC
    """)
    
    assessments = []
    for row in cursor.fetchall():
        assessments.append(CompetencyAssessment(
            id=row[0],
            employee_id=row[1],
            skill_id=row[2],
            current_level=row[3],
            target_level=row[4],
            gap=row[5],
            assessment_date=row[6],
            assessor_notes=row[7],  # 映射 notes -> assessor_notes
            last_assessment_date=row[6],  # 使用 assessment_date
            created_at=row[8],
            updated_at=row[9]
        ))
    
    return assessments


@router.get("/employee/{employee_id}", response_model=List[CompetencyAssessment])
def get_employee_assessments(employee_id: UUID, cursor=Depends(get_db)):
    """获取指定员工的所有能力评估"""
    cursor.execute("""
        SELECT id, employee_id, skill_id, current_level, target_level, 
               target_level - current_level AS gap, assessment_date, notes,
               created_at, updated_at
        FROM dbo.competency_assessments WITH (NOLOCK)
        WHERE employee_id = ?
        ORDER BY assessment_date DESC
    """, str(employee_id))
    
    assessments = []
    for row in cursor.fetchall():
        assessments.append(CompetencyAssessment(
            id=row[0],
            employee_id=row[1],
            skill_id=row[2],
            current_level=row[3],
            target_level=row[4],
            gap=row[5],
            assessment_date=row[6],
            assessor_notes=row[7],  # 映射 notes -> assessor_notes
            last_assessment_date=row[6],  # 使用 assessment_date
            created_at=row[8],
            updated_at=row[9]
        ))
    
    return assessments


@router.get("/matrix")
def get_assessment_matrix(
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the complete editable matrix without polluting analytics reads."""

    cursor.execute(
        """
        SELECT
            e.id,
            e.employee_id,
            e.name,
            d.name,
            LOWER(LTRIM(RTRIM(e.email)))
        FROM dbo.employees e
        LEFT JOIN dbo.departments d ON d.id = e.department_id
        WHERE ISNULL(e.is_active, 1) = 1
        ORDER BY e.name
        """
    )
    employees = cursor.fetchall()

    cursor.execute(
        """
        SELECT
            id,
            module_id,
            module_name,
            skill_name,
            COALESCE(display_order, 0)
        FROM dbo.skills
        WHERE ISNULL(is_active, 1) = 1
        ORDER BY module_id, display_order, id
        """
    )
    skills = cursor.fetchall()

    cursor.execute(
        """
        SELECT
            employee_id,
            skill_id,
            current_level,
            target_level,
            target_level - current_level AS gap,
            updated_at
        FROM dbo.competency_assessments
        """
    )
    assessments = cursor.fetchall()
    permission_user = dict(current_user)
    permission_user["editable_module_ids"] = resolve_editable_module_ids(cursor, current_user)
    payload = build_matrix_payload(employees, skills, assessments, permission_user)
    payload["permissionWarnings"] = (
        owner_configuration_warnings(cursor)
        if str(current_user.get("role") or "").strip().lower() == "admin"
        else []
    )
    return payload


@router.post("/batch-save")
def batch_save_assessments(
    payload: CompetencyAssessmentBatchSave,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Persist all drafted cells as one authorized, conflict-checked version."""

    return save_assessment_batch(cursor, payload.cells, payload.notes, current_user)


@router.put("/employee/{employee_id}/skill/{skill_id}")
def save_assessment(
    employee_id: UUID,
    skill_id: int,
    payload: CompetencyAssessmentSave,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Deprecated immediate-save route; callers must use the batch endpoint."""
    del employee_id, skill_id, payload, cursor, current_user
    raise HTTPException(status_code=410, detail="请使用草稿和 /batch-save 统一保存")


@router.get(
    "/history",
    response_model=List[CompetencyAssessmentHistoryResponse],
)
def get_assessment_history(
    employee_id: UUID,
    skill_id: Optional[int] = None,
    year: Optional[int] = None,
    quarter: Optional[int] = Query(None, ge=1, le=4),
    latest_per_quarter: bool = False,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return full or quarterly-final history within the caller's scope."""

    resolve_employee_scope(cursor, current_user, employee_id)
    filters = ["h.employee_id = ?"]
    params = [str(employee_id)]
    if skill_id is not None:
        filters.append("h.skill_id = ?")
        params.append(skill_id)
    if year is not None:
        filters.append("h.assessment_year = ?")
        params.append(year)
    if quarter is not None:
        filters.append("h.assessment_quarter = ?")
        params.append(quarter)

    where_sql = " AND ".join(filters)
    history_columns = """
        h.id,
        h.assessment_id,
        h.employee_id,
        h.skill_id,
        h.previous_current_level,
        h.previous_target_level,
        h.current_level,
        h.target_level,
        h.gap,
        h.assessment_year,
        h.assessment_quarter,
        h.notes,
        h.changed_at,
        h.changed_by_user_id,
        h.change_source,
        h.version_id
    """
    output_columns = f"""
        {history_columns},
        u.name AS changed_by_name,
        u.email AS changed_by_email
    """
    if latest_per_quarter:
        sql = f"""
            WITH ranked AS (
                SELECT
                    h.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            h.employee_id,
                            h.skill_id,
                            h.assessment_year,
                            h.assessment_quarter
                        ORDER BY h.changed_at DESC, h.id DESC
                    ) AS rn
                FROM dbo.competency_assessment_history h
                WHERE {where_sql}
            )
            SELECT {output_columns}
            FROM ranked h
            LEFT JOIN dbo.users u ON u.id = h.changed_by_user_id
            WHERE h.rn = 1
            ORDER BY h.changed_at DESC, h.id DESC
        """
    else:
        sql = f"""
            SELECT {output_columns}
            FROM dbo.competency_assessment_history h
            LEFT JOIN dbo.users u ON u.id = h.changed_by_user_id
            WHERE {where_sql}
            ORDER BY h.changed_at DESC, h.id DESC
        """

    cursor.execute(sql, params)
    return [
        {
            "id": row[0],
            "assessment_id": row[1],
            "employee_id": row[2],
            "skill_id": row[3],
            "previous_current_level": row[4],
            "previous_target_level": row[5],
            "current_level": row[6],
            "target_level": row[7],
            "gap": row[8],
            "assessment_year": row[9],
            "assessment_quarter": row[10],
            "notes": row[11],
            "changed_at": row[12],
            "changed_by_user_id": row[13],
            "change_source": row[14],
            "version_id": row[15],
            "changed_by_name": row[16],
            "changed_by_email": row[17],
        }
        for row in cursor.fetchall()
    ]


@router.get("/change-log")
def get_competency_change_log(
    limit: int = Query(100, ge=1, le=500),
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return recent competency edits within the caller's editable module scope."""

    editable_module_ids = resolve_editable_module_ids(cursor, current_user)
    if editable_module_ids == set():
        raise HTTPException(status_code=403, detail="没有查看能力修改记录的权限")

    filters = ["h.change_source = 'WEB_BATCH_SAVE'"]
    params = [limit]
    if editable_module_ids is not None:
        placeholders = ", ".join("?" for _ in editable_module_ids)
        filters.append(f"s.module_id IN ({placeholders})")
        params.extend(sorted(editable_module_ids))

    cursor.execute(
        f"""
        SELECT TOP (?)
            h.id,
            h.version_id,
            h.changed_at,
            h.employee_id,
            e.name AS employee_name,
            s.module_id,
            s.module_name,
            h.skill_id,
            s.skill_name,
            h.previous_current_level,
            h.current_level,
            h.previous_target_level,
            h.target_level,
            h.notes,
            h.changed_by_user_id,
            u.name AS changed_by_name,
            u.email AS changed_by_email
        FROM dbo.competency_assessment_history h
        INNER JOIN dbo.employees e ON e.id = h.employee_id
        INNER JOIN dbo.skills s ON s.id = h.skill_id
        LEFT JOIN dbo.users u ON u.id = h.changed_by_user_id
        WHERE {' AND '.join(filters)}
        ORDER BY h.changed_at DESC, h.id DESC
        """,
        params,
    )
    return {
        "records": [
            {
                "id": str(row[0]),
                "versionId": str(row[1]) if row[1] else None,
                "changedAt": row[2].isoformat() if row[2] else None,
                "employeeId": str(row[3]),
                "employeeName": row[4],
                "moduleId": int(row[5]),
                "moduleName": row[6],
                "skillId": int(row[7]),
                "skillName": row[8],
                "previousCurrentLevel": row[9],
                "currentLevel": row[10],
                "previousTargetLevel": row[11],
                "targetLevel": row[12],
                "notes": row[13],
                "changedByUserId": str(row[14]) if row[14] else None,
                "changedByName": row[15],
                "changedByEmail": row[16],
            }
            for row in cursor.fetchall()
        ]
    }


@router.get("/gap-trend")
def get_gap_trend(
    year: int = Query(..., ge=2000, le=2100),
    module_id: Optional[int] = Query(None, ge=1, le=9),
    skill_id: Optional[int] = Query(None, ge=1),
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return aggregate quarter-end GAP snapshots for the selected year."""

    del current_user
    validate_gap_trend_scope(cursor, module_id, skill_id)
    return {
        "year": year,
        "moduleId": module_id,
        "skillId": skill_id,
        "quarters": build_gap_trend(cursor, year, module_id, skill_id),
    }


@router.get("/{assessment_id}", response_model=CompetencyAssessment)
def get_competency_assessment(assessment_id: UUID, cursor=Depends(get_db)):
    """获取指定能力评估"""
    cursor.execute("""
        SELECT id, employee_id, skill_id, current_level, target_level, 
               target_level - current_level AS gap,
               assessment_year, assessment_date, notes,
               created_at, updated_at
        FROM dbo.competency_assessments WITH (NOLOCK)
        WHERE id = ?
    """, str(assessment_id))
    
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="能力评估不存在")
    
    return CompetencyAssessment(
        id=row[0],
        employee_id=row[1],
        skill_id=row[2],
        current_level=row[3],
        target_level=row[4],
        gap=row[5],
        assessment_year=row[6],
        assessment_date=row[7],
        assessor_notes=row[8],  # 映射 notes -> assessor_notes
        last_assessment_date=row[7],  # 使用 assessment_date
        created_at=row[9],
        updated_at=row[10]
    )


@router.post("/", response_model=CompetencyAssessment)
def create_competency_assessment(
    assessment: CompetencyAssessmentCreate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Deprecated immediate create; matrix edits must be one explicit batch."""
    del assessment, cursor, current_user
    raise HTTPException(status_code=410, detail="请使用草稿和 /batch-save 统一保存")


@router.put("/{assessment_id}", response_model=CompetencyAssessment)
def update_competency_assessment(
    assessment_id: UUID,
    assessment: CompetencyAssessmentUpdate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Deprecated immediate update; matrix edits must be one explicit batch."""
    del assessment_id, assessment, cursor, current_user
    raise HTTPException(status_code=410, detail="请使用草稿和 /batch-save 统一保存")


@router.delete("/{assessment_id}", response_model=MessageResponse)
def delete_competency_assessment(
    assessment_id: UUID,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Delete is not part of the governed assessment workflow."""
    del assessment_id, cursor, current_user
    raise HTTPException(status_code=410, detail="能力评估历史不可通过普通接口删除")
