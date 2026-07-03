from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import SkillBase, SkillCreate, SkillUpdate, SkillResponse, MessageResponse
from .auth import get_current_user
from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/modules")
def get_all_modules(cursor=Depends(get_db)):
    """获取所有不重复的模块列表（包括没有评估数据的模块）"""
    cursor.execute("""
        SELECT DISTINCT module_id, module_name 
        FROM skills 
        WHERE ISNULL(is_active, 1) = 1
        ORDER BY module_id
    """)
    rows = cursor.fetchall()
    
    modules = []
    for row in rows:
        modules.append({
            "module_id": row[0],
            "module_name": row[1]
        })
    
    logger.info(f"📊 返回 {len(modules)} 个模块")
    return modules


@router.get("/", response_model=List[SkillResponse])
def get_skills(cursor=Depends(get_db)):
    """获取所有技能列表"""
    cursor.execute("SELECT id, skill_name, skill_category, skill_level, created_at, updated_at FROM skills ORDER BY id")
    rows = cursor.fetchall()
    
    skills = []
    for row in rows:
        skills.append(SkillResponse(
            id=row[0],
            skill_name=row[1],
            skill_category=row[2],
            skill_level=row[3],
            created_at=row[4],
            updated_at=row[5]
        ))
    
    return skills


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(skill_id: int, cursor=Depends(get_db)):
    """根据ID获取技能详情"""
    cursor.execute(
        "SELECT id, skill_name, skill_category, skill_level, created_at, updated_at FROM skills WHERE id = ?",
        skill_id
    )
    row = cursor.fetchone()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with id {skill_id} not found"
        )
    
    return SkillResponse(
        id=row[0],
        skill_name=row[1],
        skill_category=row[2],
        skill_level=row[3],
        created_at=row[4],
        updated_at=row[5]
    )


@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(
    skill: SkillCreate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """创建新技能（需要认证）"""
    sql = "INSERT INTO skills (skill_name, skill_category, skill_level) VALUES (?, ?, ?)"
    cursor.execute(sql, skill.skill_name, skill.skill_category, skill.skill_level)
    
    cursor.execute("SELECT @@IDENTITY")
    new_id = cursor.fetchone()[0]
    
    cursor.execute(
        "SELECT id, skill_name, skill_category, skill_level, created_at, updated_at FROM skills WHERE id = ?",
        new_id
    )
    row = cursor.fetchone()
    
    logger.info(f"Skill created: id={new_id}, name={skill.skill_name}, by_user={current_user['email']}")
    
    return SkillResponse(
        id=row[0],
        skill_name=row[1],
        skill_category=row[2],
        skill_level=row[3],
        created_at=row[4],
        updated_at=row[5]
    )


@router.put("/{skill_id}", response_model=SkillResponse)
def update_skill(
    skill_id: int,
    skill: SkillUpdate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """更新技能信息（需要认证）"""
    cursor.execute("SELECT id FROM skills WHERE id = ?", skill_id)
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with id {skill_id} not found"
        )
    
    update_fields = []
    params = []
    
    if skill.skill_name is not None:
        update_fields.append("skill_name = ?")
        params.append(skill.skill_name)
    
    if skill.skill_category is not None:
        update_fields.append("skill_category = ?")
        params.append(skill.skill_category)
    
    if skill.skill_level is not None:
        update_fields.append("skill_level = ?")
        params.append(skill.skill_level)
    
    if update_fields:
        update_fields.append("updated_at = GETDATE()")
        params.append(skill_id)
        
        sql = f"UPDATE skills SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, *params)
        
        logger.info(f"Skill updated: id={skill_id}, by_user={current_user['email']}")
    
    cursor.execute(
        "SELECT id, skill_name, skill_category, skill_level, created_at, updated_at FROM skills WHERE id = ?",
        skill_id
    )
    row = cursor.fetchone()
    
    return SkillResponse(
        id=row[0],
        skill_name=row[1],
        skill_category=row[2],
        skill_level=row[3],
        created_at=row[4],
        updated_at=row[5]
    )


@router.delete("/{skill_id}", response_model=MessageResponse)
def delete_skill(
    skill_id: int,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """删除技能（需要认证）"""
    cursor.execute("SELECT id FROM skills WHERE id = ?", skill_id)
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with id {skill_id} not found"
        )
    
    cursor.execute("DELETE FROM skills WHERE id = ?", skill_id)
    
    logger.info(f"Skill deleted: id={skill_id}, by_user={current_user['email']}")
    
    return MessageResponse(message=f"Skill {skill_id} deleted successfully")
