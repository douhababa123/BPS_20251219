from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import TaskTypeBase, TaskTypeCreate, TaskTypeUpdate, TaskTypeResponse, MessageResponse
from .auth import get_current_user
from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[TaskTypeResponse])
def get_task_types(cursor=Depends(get_db)):
    """获取所有任务类型列表"""
    cursor.execute("SELECT id, code, name, color_hex, description, is_active, created_at, updated_at FROM task_types ORDER BY id")
    rows = cursor.fetchall()
    
    task_types = []
    for row in rows:
        task_types.append(TaskTypeResponse(
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


@router.get("/{task_type_id}", response_model=TaskTypeResponse)
def get_task_type(task_type_id: int, cursor=Depends(get_db)):
    """根据ID获取任务类型详情"""
    cursor.execute(
        "SELECT id, code, name, color_hex, description, is_active, created_at, updated_at FROM task_types WHERE id = ?",
        task_type_id
    )
    row = cursor.fetchone()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task type with id {task_type_id} not found"
        )
    
    return TaskTypeResponse(
        id=row[0],
        code=row[1],
        name=row[2],
        color_hex=row[3],
        description=row[4],
        is_active=row[5],
        created_at=row[6],
        updated_at=row[7]
    )


@router.post("/", response_model=TaskTypeResponse, status_code=status.HTTP_201_CREATED)
def create_task_type(
    task_type: TaskTypeCreate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """创建新任务类型（需要认证）"""
    cursor.execute(
        """
        INSERT INTO task_types (name, description)
        VALUES (?, ?)
        """,
        task_type.name,
        task_type.description
    )
    
    cursor.execute("SELECT @@IDENTITY")
    new_id = cursor.fetchone()[0]
    
    cursor.execute(
        "SELECT id, name, description, created_at, updated_at FROM task_types WHERE id = ?",
        new_id
    )
    row = cursor.fetchone()
    
    logger.info(f"Task type created: id={new_id}, name={task_type.name}, by_user={current_user['email']}")
    
    return TaskTypeResponse(
        id=row[0],
        name=row[1],
        description=row[2],
        created_at=row[3],
        updated_at=row[4]
    )


@router.put("/{task_type_id}", response_model=TaskTypeResponse)
def update_task_type(
    task_type_id: int,
    task_type: TaskTypeUpdate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """更新任务类型信息（需要认证）"""
    cursor.execute("SELECT id FROM task_types WHERE id = ?", task_type_id)
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task type with id {task_type_id} not found"
        )
    
    update_fields = []
    params = []
    
    if task_type.name is not None:
        update_fields.append("name = ?")
        params.append(task_type.name)
    
    if task_type.description is not None:
        update_fields.append("description = ?")
        params.append(task_type.description)
    
    if update_fields:
        update_fields.append("updated_at = GETDATE()")
        params.append(task_type_id)
        
        sql = f"UPDATE task_types SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, *params)
        
        logger.info(f"Task type updated: id={task_type_id}, by_user={current_user['email']}")
    
    cursor.execute(
        "SELECT id, name, description, created_at, updated_at FROM task_types WHERE id = ?",
        task_type_id
    )
    row = cursor.fetchone()
    
    return TaskTypeResponse(
        id=row[0],
        name=row[1],
        description=row[2],
        created_at=row[3],
        updated_at=row[4]
    )


@router.delete("/{task_type_id}", response_model=MessageResponse)
def delete_task_type(
    task_type_id: int,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """删除任务类型（需要认证）"""
    cursor.execute("SELECT id FROM task_types WHERE id = ?", task_type_id)
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task type with id {task_type_id} not found"
        )
    
    # 检查是否有任务关联
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE task_type_id = ?", task_type_id)
    count = cursor.fetchone()[0]
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete task type: {count} tasks are associated with it"
        )
    
    cursor.execute("DELETE FROM task_types WHERE id = ?", task_type_id)
    
    logger.info(f"Task type deleted: id={task_type_id}, by_user={current_user['email']}")
    
    return MessageResponse(message=f"Task type {task_type_id} deleted successfully")
