"""
资源任务类型路由
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    ResourceTaskType, 
    ResourceTaskTypeCreate, 
    ResourceTaskTypeUpdate, 
    MessageResponse
)
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[ResourceTaskType])
def get_resource_task_types(cursor=Depends(get_db)):
    """获取所有资源任务类型列表"""
    cursor.execute("""
        SELECT id, code, name, color_hex, description, is_active, created_at, updated_at
        FROM dbo.resource_task_types
        ORDER BY code
    """)
    
    task_types = []
    for row in cursor.fetchall():
        task_types.append(ResourceTaskType(
            id=row[0],
            code=row[1],
            name=row[2],
            color_hex=row[3],
            description=row[4],
            is_active=row[5],
            created_at=row[6],
            updated_at=row[7]
        ))
    
    return task_types


@router.get("/{task_type_id}", response_model=ResourceTaskType)
def get_resource_task_type(task_type_id: int, cursor=Depends(get_db)):
    """获取指定资源任务类型"""
    cursor.execute("""
        SELECT id, code, name, color_hex, description, is_active, created_at, updated_at
        FROM dbo.resource_task_types
        WHERE id = ?
    """, task_type_id)
    
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="资源任务类型不存在")
    
    return ResourceTaskType(
        id=row[0],
        code=row[1],
        name=row[2],
        color_hex=row[3],
        description=row[4],
        is_active=row[5],
        created_at=row[6],
        updated_at=row[7]
    )


@router.post("/", response_model=ResourceTaskType)
def create_resource_task_type(
    task_type: ResourceTaskTypeCreate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """创建资源任务类型"""
    try:
        cursor.execute("""
            INSERT INTO dbo.resource_task_types 
            (code, name, color_hex, description, is_active)
            VALUES (?, ?, ?, ?, ?)
        """, (
            task_type.code,
            task_type.name,
            task_type.color_hex,
            task_type.description,
            task_type.is_active
        ))
        
        cursor.execute("SELECT @@IDENTITY")
        new_id = cursor.fetchone()[0]
        cursor.commit()
        
        return get_resource_task_type(new_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"创建资源任务类型失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.put("/{task_type_id}", response_model=ResourceTaskType)
def update_resource_task_type(
    task_type_id: int,
    task_type: ResourceTaskTypeUpdate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """更新资源任务类型"""
    # 检查是否存在
    existing = get_resource_task_type(task_type_id, cursor)
    
    # 构建更新字段
    update_fields = []
    params = []
    
    if task_type.code is not None:
        update_fields.append("code = ?")
        params.append(task_type.code)
    if task_type.name is not None:
        update_fields.append("name = ?")
        params.append(task_type.name)
    if task_type.color_hex is not None:
        update_fields.append("color_hex = ?")
        params.append(task_type.color_hex)
    if task_type.description is not None:
        update_fields.append("description = ?")
        params.append(task_type.description)
    if task_type.is_active is not None:
        update_fields.append("is_active = ?")
        params.append(task_type.is_active)
    
    if not update_fields:
        return existing
    
    update_fields.append("updated_at = GETDATE()")
    params.append(task_type_id)
    
    try:
        sql = f"UPDATE dbo.resource_task_types SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, params)
        cursor.commit()
        
        return get_resource_task_type(task_type_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"更新资源任务类型失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/{task_type_id}", response_model=MessageResponse)
def delete_resource_task_type(
    task_type_id: int,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """删除资源任务类型"""
    # 检查是否存在
    get_resource_task_type(task_type_id, cursor)
    
    try:
        cursor.execute("DELETE FROM dbo.resource_task_types WHERE id = ?", task_type_id)
        cursor.commit()
        
        return MessageResponse(message="删除成功")
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"删除资源任务类型失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
