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
    CompetencyAssessmentHistoryResponse,
    MessageResponse
)
from database import get_db
from .auth import get_current_user
from competency_assessment_history import (
    build_matrix_payload,
    resolve_employee_scope,
    save_latest_assessment,
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
            target_level - current_level AS gap
        FROM dbo.competency_assessments
        """
    )
    assessments = cursor.fetchall()
    return build_matrix_payload(employees, skills, assessments, current_user)


@router.put("/employee/{employee_id}/skill/{skill_id}")
def save_assessment(
    employee_id: UUID,
    skill_id: int,
    payload: CompetencyAssessmentSave,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Atomically update latest values and append one history snapshot."""

    assessment_id = save_latest_assessment(
        cursor,
        employee_id,
        skill_id,
        payload,
        current_user,
    )
    return get_competency_assessment(UUID(assessment_id), cursor)


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
    filters = ["employee_id = ?"]
    params = [str(employee_id)]
    if skill_id is not None:
        filters.append("skill_id = ?")
        params.append(skill_id)
    if year is not None:
        filters.append("assessment_year = ?")
        params.append(year)
    if quarter is not None:
        filters.append("assessment_quarter = ?")
        params.append(quarter)

    where_sql = " AND ".join(filters)
    columns = """
        id,
        assessment_id,
        employee_id,
        skill_id,
        current_level,
        target_level,
        gap,
        assessment_year,
        assessment_quarter,
        notes,
        changed_at,
        changed_by_user_id,
        change_source
    """
    if latest_per_quarter:
        sql = f"""
            WITH ranked AS (
                SELECT
                    {columns},
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            employee_id,
                            skill_id,
                            assessment_year,
                            assessment_quarter
                        ORDER BY changed_at DESC, id DESC
                    ) AS rn
                FROM dbo.competency_assessment_history
                WHERE {where_sql}
            )
            SELECT {columns}
            FROM ranked
            WHERE rn = 1
            ORDER BY changed_at DESC, id DESC
        """
    else:
        sql = f"""
            SELECT {columns}
            FROM dbo.competency_assessment_history
            WHERE {where_sql}
            ORDER BY changed_at DESC, id DESC
        """

    cursor.execute(sql, params)
    return [
        {
            "id": row[0],
            "assessment_id": row[1],
            "employee_id": row[2],
            "skill_id": row[3],
            "current_level": row[4],
            "target_level": row[5],
            "gap": row[6],
            "assessment_year": row[7],
            "assessment_quarter": row[8],
            "notes": row[9],
            "changed_at": row[10],
            "changed_by_user_id": row[11],
            "change_source": row[12],
        }
        for row in cursor.fetchall()
    ]


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
    """Compatibility create route using the canonical history-preserving save."""
    try:
        payload = CompetencyAssessmentSave(
            current_level=assessment.current_level,
            target_level=assessment.target_level,
            notes=assessment.assessor_notes,
        )
        assessment_id = save_latest_assessment(
            cursor,
            assessment.employee_id,
            assessment.skill_id,
            payload,
            current_user,
        )
        return get_competency_assessment(UUID(assessment_id), cursor)
    except HTTPException:
        raise
    except Exception as e:
        cursor.rollback()
        logger.error(f"创建能力评估失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.put("/{assessment_id}", response_model=CompetencyAssessment)
def update_competency_assessment(
    assessment_id: UUID,
    assessment: CompetencyAssessmentUpdate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """更新能力评估"""
    # 检查是否存在
    existing = get_competency_assessment(assessment_id, cursor)

    next_current = (
        assessment.current_level
        if assessment.current_level is not None
        else existing.current_level
    )
    next_target = (
        assessment.target_level
        if assessment.target_level is not None
        else existing.target_level
    )
    if next_target < next_current:
        raise HTTPException(
            status_code=422,
            detail="目标能力必须大于或等于能力现状",
        )
    
    if not assessment.model_fields_set:
        return existing

    try:
        payload = CompetencyAssessmentSave(
            current_level=next_current,
            target_level=next_target,
            notes=(
                assessment.assessor_notes
                if assessment.assessor_notes is not None
                else existing.assessor_notes
            ),
        )
        saved_id = save_latest_assessment(
            cursor,
            existing.employee_id,
            existing.skill_id,
            payload,
            current_user,
        )
        return get_competency_assessment(UUID(saved_id), cursor)
    except HTTPException:
        raise
    except Exception as e:
        cursor.rollback()
        logger.error(f"更新能力评估失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/{assessment_id}", response_model=MessageResponse)
def delete_competency_assessment(
    assessment_id: UUID,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """删除能力评估"""
    # 检查是否存在
    get_competency_assessment(assessment_id, cursor)
    
    try:
        cursor.execute("DELETE FROM dbo.competency_assessments WHERE id = ?", str(assessment_id))
        cursor.commit()
        
        return MessageResponse(message="删除成功")
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"删除能力评估失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
