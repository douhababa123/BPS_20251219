"""
资源规划任务路由
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from uuid import UUID
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    ResourcePlanningTask, 
    ResourcePlanningTaskCreate, 
    ResourcePlanningTaskUpdate, 
    MessageResponse
)
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[ResourcePlanningTask])
def get_resource_planning_tasks(
    employee_id: Optional[UUID] = None,
    year: Optional[int] = None,
    week_number: Optional[int] = None,
    cursor=Depends(get_db)
):
    """获取资源规划任务列表，支持筛选"""
    query = """
        SELECT id, employee_id, task_type_code, start_week, end_week, 
               factory_code, hours, is_cross_factory, notes, 
               year, week_number, employee_name, department_id,
               created_at, updated_at
        FROM dbo.resource_planning_tasks
        WHERE 1=1
    """
    params = []
    
    if employee_id:
        query += " AND employee_id = ?"
        params.append(str(employee_id))
    if year:
        query += " AND year = ?"
        params.append(year)
    if week_number:
        query += " AND week_number = ?"
        params.append(week_number)
    
    query += " ORDER BY year DESC, week_number DESC"
    
    cursor.execute(query, params)
    
    tasks = []
    for row in cursor.fetchall():
        tasks.append(ResourcePlanningTask(
            id=row[0],
            employee_id=row[1],
            task_type_code=row[2],
            start_week=row[3],
            end_week=row[4],
            factory_code=row[5],
            hours=row[6],
            is_cross_factory=row[7],
            notes=row[8],
            year=row[9],
            week_number=row[10],
            employee_name=row[11],
            department_id=row[12],
            created_at=row[13],
            updated_at=row[14]
        ))
    
    return tasks


@router.get("/{task_id}", response_model=ResourcePlanningTask)
def get_resource_planning_task(task_id: int, cursor=Depends(get_db)):
    """获取指定资源规划任务"""
    cursor.execute("""
        SELECT id, employee_id, task_type_code, start_week, end_week, 
               factory_code, hours, is_cross_factory, notes, 
               year, week_number, employee_name, department_id,
               created_at, updated_at
        FROM dbo.resource_planning_tasks
        WHERE id = ?
    """, task_id)
    
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="资源规划任务不存在")
    
    return ResourcePlanningTask(
        id=row[0],
        employee_id=row[1],
        task_type_code=row[2],
        start_week=row[3],
        end_week=row[4],
        factory_code=row[5],
        hours=row[6],
        is_cross_factory=row[7],
        notes=row[8],
        year=row[9],
        week_number=row[10],
        employee_name=row[11],
        department_id=row[12],
        created_at=row[13],
        updated_at=row[14]
    )


@router.post("/", response_model=ResourcePlanningTask)
def create_resource_planning_task(
    task: ResourcePlanningTaskCreate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """创建资源规划任务"""
    try:
        cursor.execute("""
            INSERT INTO dbo.resource_planning_tasks 
            (employee_id, task_type_code, start_week, end_week, 
             factory_code, hours, is_cross_factory, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(task.employee_id),
            task.task_type_code,
            task.start_week,
            task.end_week,
            task.factory_code,
            task.hours,
            task.is_cross_factory,
            task.notes
        ))
        
        cursor.execute("SELECT @@IDENTITY")
        new_id = cursor.fetchone()[0]
        cursor.commit()
        
        return get_resource_planning_task(new_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"创建资源规划任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.put("/{task_id}", response_model=ResourcePlanningTask)
def update_resource_planning_task(
    task_id: int,
    task: ResourcePlanningTaskUpdate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """更新资源规划任务"""
    # 检查是否存在
    existing = get_resource_planning_task(task_id, cursor)
    
    # 构建更新字段
    update_fields = []
    params = []
    
    if task.employee_id is not None:
        update_fields.append("employee_id = ?")
        params.append(str(task.employee_id))
    if task.task_type_code is not None:
        update_fields.append("task_type_code = ?")
        params.append(task.task_type_code)
    if task.start_week is not None:
        update_fields.append("start_week = ?")
        params.append(task.start_week)
    if task.end_week is not None:
        update_fields.append("end_week = ?")
        params.append(task.end_week)
    if task.factory_code is not None:
        update_fields.append("factory_code = ?")
        params.append(task.factory_code)
    if task.hours is not None:
        update_fields.append("hours = ?")
        params.append(task.hours)
    if task.is_cross_factory is not None:
        update_fields.append("is_cross_factory = ?")
        params.append(task.is_cross_factory)
    if task.notes is not None:
        update_fields.append("notes = ?")
        params.append(task.notes)
    
    if not update_fields:
        return existing
    
    update_fields.append("updated_at = GETDATE()")
    params.append(task_id)
    
    try:
        sql = f"UPDATE dbo.resource_planning_tasks SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, params)
        cursor.commit()
        
        return get_resource_planning_task(task_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"更新资源规划任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/{task_id}", response_model=MessageResponse)
def delete_resource_planning_task(
    task_id: int,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """删除资源规划任务"""
    # 检查是否存在
    get_resource_planning_task(task_id, cursor)
    
    try:
        cursor.execute("DELETE FROM dbo.resource_planning_tasks WHERE id = ?", task_id)
        cursor.commit()
        
        return MessageResponse(message="删除成功")
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"删除资源规划任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
