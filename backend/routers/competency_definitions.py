"""
能力定义路由
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    CompetencyDefinition, 
    CompetencyDefinitionCreate, 
    CompetencyDefinitionUpdate, 
    MessageResponse
)
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[CompetencyDefinition])
def get_competency_definitions(cursor=Depends(get_db)):
    """获取所有能力定义列表"""
    cursor.execute("""
        SELECT id, module_id, module_name, competency_type, competency_code, 
               description, owner_engineer, is_key_competency, 
               created_at, updated_at
        FROM dbo.competency_definitions
        ORDER BY module_id, competency_type, competency_code
    """)
    
    definitions = []
    for row in cursor.fetchall():
        definitions.append(CompetencyDefinition(
            id=row[0],
            module_id=row[1],
            module_name=row[2],
            competency_type=row[3],
            competency_code=row[4],
            competency_name=row[3],  # 使用 competency_type 作为 competency_name（description字段全为NULL）
            level_1_description=row[5] if row[5] else None,  # description 可能为 NULL
            level_2_description=row[6] if row[6] else None,  # owner_engineer 作为 level_1 已经映射
            level_3_description=None,  # 数据库中不存在
            is_active=bool(row[7]) if row[7] is not None else True,  # 映射 is_key_competency -> is_active
            created_at=row[8],
            updated_at=row[9]
        ))
    
    return definitions


@router.get("/{definition_id}", response_model=CompetencyDefinition)
def get_competency_definition(definition_id: int, cursor=Depends(get_db)):
    """获取指定能力定义"""
    cursor.execute("""
        SELECT id, module_id, module_name, competency_type, competency_code, 
               competency_name, level_1_description, level_2_description, 
               level_3_description, is_active, created_at, updated_at
        FROM dbo.competency_definitions
        WHERE id = ?
    """, definition_id)
    
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="能力定义不存在")
    
    return CompetencyDefinition(
        id=row[0],
        module_id=row[1],
        module_name=row[2],
        competency_type=row[3],
        competency_code=row[4],
        competency_name=row[5],
        level_1_description=row[6],
        level_2_description=row[7],
        level_3_description=row[8],
        is_active=row[9],
        created_at=row[10],
        updated_at=row[11]
    )


@router.post("/", response_model=CompetencyDefinition)
def create_competency_definition(
    definition: CompetencyDefinitionCreate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """创建能力定义"""
    try:
        cursor.execute("""
            INSERT INTO dbo.competency_definitions 
            (module_id, module_name, competency_type, competency_code, 
             competency_name, level_1_description, level_2_description, 
             level_3_description, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            definition.module_id,
            definition.module_name,
            definition.competency_type,
            definition.competency_code,
            definition.competency_name,
            definition.level_1_description,
            definition.level_2_description,
            definition.level_3_description,
            definition.is_active
        ))
        
        cursor.execute("SELECT @@IDENTITY")
        new_id = cursor.fetchone()[0]
        cursor.commit()
        
        return get_competency_definition(new_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"创建能力定义失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.put("/{definition_id}", response_model=CompetencyDefinition)
def update_competency_definition(
    definition_id: int,
    definition: CompetencyDefinitionUpdate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """更新能力定义"""
    # 检查是否存在
    existing = get_competency_definition(definition_id, cursor)
    
    # 构建更新字段
    update_fields = []
    params = []
    
    if definition.module_id is not None:
        update_fields.append("module_id = ?")
        params.append(definition.module_id)
    if definition.module_name is not None:
        update_fields.append("module_name = ?")
        params.append(definition.module_name)
    if definition.competency_type is not None:
        update_fields.append("competency_type = ?")
        params.append(definition.competency_type)
    if definition.competency_code is not None:
        update_fields.append("competency_code = ?")
        params.append(definition.competency_code)
    if definition.competency_name is not None:
        update_fields.append("competency_name = ?")
        params.append(definition.competency_name)
    if definition.level_1_description is not None:
        update_fields.append("level_1_description = ?")
        params.append(definition.level_1_description)
    if definition.level_2_description is not None:
        update_fields.append("level_2_description = ?")
        params.append(definition.level_2_description)
    if definition.level_3_description is not None:
        update_fields.append("level_3_description = ?")
        params.append(definition.level_3_description)
    if definition.is_active is not None:
        update_fields.append("is_active = ?")
        params.append(definition.is_active)
    
    if not update_fields:
        return existing
    
    update_fields.append("updated_at = GETDATE()")
    params.append(definition_id)
    
    try:
        sql = f"UPDATE dbo.competency_definitions SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, params)
        cursor.commit()
        
        return get_competency_definition(definition_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"更新能力定义失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/{definition_id}", response_model=MessageResponse)
def delete_competency_definition(
    definition_id: int,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """删除能力定义"""
    # 检查是否存在
    get_competency_definition(definition_id, cursor)
    
    try:
        cursor.execute("DELETE FROM dbo.competency_definitions WHERE id = ?", definition_id)
        cursor.commit()
        
        return MessageResponse(message="删除成功")
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"删除能力定义失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
