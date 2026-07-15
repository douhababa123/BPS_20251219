"""
能力评估管理 API
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date
from uuid import UUID
import pyodbc

from database import db
from auth import get_current_user, verify_admin
from competency_assessment_history import save_latest_assessment
from models import CompetencyAssessmentSave as CanonicalAssessmentSave

router = APIRouter()


class CompetencyAssessmentCreate(BaseModel):
    employee_id: str
    skill_id: int
    current_level: int = Field(..., ge=0, le=4)
    target_level: int = Field(..., ge=0, le=4)
    assessment_year: Optional[int] = None
    assessment_date: Optional[date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_target(self):
        if self.target_level < self.current_level:
            raise ValueError("目标能力必须大于或等于能力现状")
        return self


class CompetencyAssessmentUpdate(BaseModel):
    current_level: Optional[int] = Field(None, ge=0, le=4)
    target_level: Optional[int] = Field(None, ge=0, le=4)
    assessment_year: Optional[int] = None
    assessment_date: Optional[date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_submitted_pair(self):
        if (
            self.current_level is not None
            and self.target_level is not None
            and self.target_level < self.current_level
        ):
            raise ValueError("目标能力必须大于或等于能力现状")
        return self


class CompetencyAssessmentResponse(BaseModel):
    id: str
    employee_id: str
    skill_id: int
    current_level: int
    target_level: int
    gap: int
    assessment_year: Optional[int]
    assessment_date: Optional[date]
    notes: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


@router.post("/competency-assessments", response_model=CompetencyAssessmentResponse, dependencies=[Depends(verify_admin)])
def create_assessment(assessment: CompetencyAssessmentCreate, current_user: dict = Depends(get_current_user)):
    """Create or replace current values and append one immutable history row."""
    try:
        with db.get_cursor() as cursor:
            assessment_id = save_latest_assessment(
                cursor,
                assessment.employee_id,
                assessment.skill_id,
                CanonicalAssessmentSave(
                    current_level=assessment.current_level,
                    target_level=assessment.target_level,
                    notes=assessment.notes,
                ),
                current_user,
            )
            cursor.execute(
                "SELECT * FROM competency_assessments WHERE id = ?",
                (assessment_id,),
            )
            row = cursor.fetchone()
            
            return {
                "id": str(row.id),
                "employee_id": str(row.employee_id),
                "skill_id": row.skill_id,
                "current_level": row.current_level,
                "target_level": row.target_level,
                "gap": row.gap,
                "assessment_year": row.assessment_year,
                "assessment_date": row.assessment_date.isoformat() if row.assessment_date else None,
                "notes": row.notes,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competency-assessments", response_model=List[CompetencyAssessmentResponse])
def list_assessments(
    employee_id: Optional[str] = None,
    skill_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """获取能力评估列表"""
    try:
        with db.get_cursor() as cursor:
            query = "SELECT * FROM competency_assessments WHERE 1=1"
            params = []
            
            if employee_id:
                query += " AND employee_id = ?"
                params.append(employee_id)
            
            if skill_id:
                query += " AND skill_id = ?"
                params.append(skill_id)
            
            query += " ORDER BY created_at DESC"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [{
                "id": str(row.id),
                "employee_id": str(row.employee_id),
                "skill_id": row.skill_id,
                "current_level": row.current_level,
                "target_level": row.target_level,
                "gap": row.gap,
                "assessment_year": row.assessment_year,
                "assessment_date": row.assessment_date.isoformat() if row.assessment_date else None,
                "notes": row.notes,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            } for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competency-assessments/{assessment_id}", response_model=CompetencyAssessmentResponse)
def get_assessment(assessment_id: str, current_user: dict = Depends(get_current_user)):
    """通过 ID 获取能力评估"""
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT * FROM competency_assessments WHERE id = ?", (assessment_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Assessment not found")
            
            return {
                "id": str(row.id),
                "employee_id": str(row.employee_id),
                "skill_id": row.skill_id,
                "current_level": row.current_level,
                "target_level": row.target_level,
                "gap": row.gap,
                "assessment_year": row.assessment_year,
                "assessment_date": row.assessment_date.isoformat() if row.assessment_date else None,
                "notes": row.notes,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/competency-assessments/{assessment_id}", response_model=CompetencyAssessmentResponse, dependencies=[Depends(verify_admin)])
def update_assessment(
    assessment_id: str,
    assessment: CompetencyAssessmentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """更新能力评估"""
    try:
        with db.get_cursor() as cursor:
            # 检查评估是否存在
            cursor.execute(
                """SELECT id, employee_id, skill_id, current_level, target_level, notes
                   FROM competency_assessments WHERE id = ?""",
                (assessment_id,),
            )
            existing = cursor.fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Assessment not found")

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
                raise HTTPException(status_code=400, detail="No fields to update")

            save_latest_assessment(
                cursor,
                existing.employee_id,
                existing.skill_id,
                CanonicalAssessmentSave(
                    current_level=next_current,
                    target_level=next_target,
                    notes=(assessment.notes if assessment.notes is not None else existing.notes),
                ),
                current_user,
            )

            cursor.execute("SELECT * FROM competency_assessments WHERE id = ?", (assessment_id,))
            row = cursor.fetchone()
            
            return {
                "id": str(row.id),
                "employee_id": str(row.employee_id),
                "skill_id": row.skill_id,
                "current_level": row.current_level,
                "target_level": row.target_level,
                "gap": row.gap,
                "assessment_year": row.assessment_year,
                "assessment_date": row.assessment_date.isoformat() if row.assessment_date else None,
                "notes": row.notes,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/competency-assessments/{assessment_id}", dependencies=[Depends(verify_admin)])
def delete_assessment(assessment_id: str, current_user: dict = Depends(get_current_user)):
    """删除能力评估"""
    try:
        with db.get_cursor() as cursor:
            # 检查评估是否存在
            cursor.execute("SELECT id FROM competency_assessments WHERE id = ?", (assessment_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Assessment not found")
            
            # 删除评估
            cursor.execute("DELETE FROM competency_assessments WHERE id = ?", (assessment_id,))
            
            return {"message": "Assessment deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
