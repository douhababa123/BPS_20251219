"""
能力评估路由
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from uuid import UUID
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    CompetencyAssessment, 
    CompetencyAssessmentCreate, 
    CompetencyAssessmentUpdate, 
    MessageResponse
)
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[CompetencyAssessment])
def get_competency_assessments(cursor=Depends(get_db)):
    """获取所有能力评估列表"""
    cursor.execute("""
        SELECT id, employee_id, skill_id, current_level, target_level, 
               gap, assessment_date, notes,
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
               gap, assessment_date, notes,
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


@router.get("/{assessment_id}", response_model=CompetencyAssessment)
def get_competency_assessment(assessment_id: UUID, cursor=Depends(get_db)):
    """获取指定能力评估"""
    cursor.execute("""
        SELECT id, employee_id, skill_id, current_level, target_level, 
               gap, assessment_year, assessment_date, notes,
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
    """创建能力评估"""
    try:
        cursor.execute("""
            INSERT INTO dbo.competency_assessments 
            (employee_id, skill_id, current_level, target_level, 
             assessment_date, assessor_notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            str(assessment.employee_id),
            assessment.skill_id,
            assessment.current_level,
            assessment.target_level,
            assessment.assessment_date,
            assessment.assessor_notes
        ))
        
        cursor.execute("SELECT CAST(@@IDENTITY AS VARCHAR(36))")
        new_id = cursor.fetchone()[0]
        cursor.commit()
        
        return get_competency_assessment(UUID(new_id), cursor)
    
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
    
    # 构建更新字段
    update_fields = []
    params = []
    
    if assessment.current_level is not None:
        update_fields.append("current_level = ?")
        params.append(assessment.current_level)
    if assessment.target_level is not None:
        update_fields.append("target_level = ?")
        params.append(assessment.target_level)
    if assessment.assessment_date is not None:
        update_fields.append("assessment_date = ?")
        params.append(assessment.assessment_date)
    if assessment.assessor_notes is not None:
        update_fields.append("assessor_notes = ?")
        params.append(assessment.assessor_notes)
    
    if not update_fields:
        return existing
    
    update_fields.append("updated_at = GETDATE()")
    params.append(str(assessment_id))
    
    try:
        sql = f"UPDATE dbo.competency_assessments SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, params)
        cursor.commit()
        
        return get_competency_assessment(assessment_id, cursor)
    
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
