"""
资源规划任务管理路由 - Admin Only
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

from database import db
from auth import get_current_user, verify_admin
from utils.db_utils import row_to_dict, rows_to_list

router = APIRouter()


class ResourcePlanningTaskCreate(BaseModel):
    """创建资源规划任务的请求模型"""
    employee_id: UUID = Field(..., description="员工 ID")
    task_type_code: Optional[str] = Field(None, max_length=50, description="任务类型代码")
    start_week: Optional[str] = Field(None, max_length=10, description="开始周")
    end_week: Optional[str] = Field(None, max_length=10, description="结束周")
    start_date: Optional[date] = Field(None, description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期")
    topic: Optional[str] = Field(None, max_length=200, description="主题")
    location: Optional[str] = Field(None, max_length=100, description="地点")
    notes: Optional[str] = Field(None, description="备注")
    import_batch_id: Optional[UUID] = Field(None, description="导入批次 ID")
    source_file_name: Optional[str] = Field(None, max_length=255, description="源文件名")
    task_date: Optional[date] = Field(None, description="任务日期")
    year_month: Optional[str] = Field(None, max_length=7, description="年月 (YYYY-MM)")
    cw_week: Optional[str] = Field(None, max_length=10, description="日历周")
    day_of_month: Optional[int] = Field(None, description="月份中的日期")
    task_type: Optional[str] = Field(None, max_length=50, description="任务类型")


class ResourcePlanningTaskUpdate(BaseModel):
    """更新资源规划任务的请求模型"""
    employee_id: Optional[UUID] = Field(None, description="员工 ID")
    task_type_code: Optional[str] = Field(None, max_length=50, description="任务类型代码")
    start_week: Optional[str] = Field(None, max_length=10, description="开始周")
    end_week: Optional[str] = Field(None, max_length=10, description="结束周")
    start_date: Optional[date] = Field(None, description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期")
    topic: Optional[str] = Field(None, max_length=200, description="主题")
    location: Optional[str] = Field(None, max_length=100, description="地点")
    notes: Optional[str] = Field(None, description="备注")
    import_batch_id: Optional[UUID] = Field(None, description="导入批次 ID")
    source_file_name: Optional[str] = Field(None, max_length=255, description="源文件名")
    task_date: Optional[date] = Field(None, description="任务日期")
    year_month: Optional[str] = Field(None, max_length=7, description="年月 (YYYY-MM)")
    cw_week: Optional[str] = Field(None, max_length=10, description="日历周")
    day_of_month: Optional[int] = Field(None, description="月份中的日期")
    task_type: Optional[str] = Field(None, max_length=50, description="任务类型")


class ResourcePlanningTaskResponse(BaseModel):
    """资源规划任务响应模型"""
    id: int
    employee_id: UUID
    task_type_code: Optional[str]
    start_week: Optional[str]
    end_week: Optional[str]
    start_date: Optional[date]
    end_date: Optional[date]
    topic: Optional[str]
    location: Optional[str]
    notes: Optional[str]
    imported_at: Optional[datetime]
    import_batch_id: Optional[UUID]
    source_file_name: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    task_date: Optional[date]
    year_month: Optional[str]
    cw_week: Optional[str]
    day_of_month: Optional[int]
    task_type: Optional[str]


@router.post("/admin/resource-planning-tasks", response_model=ResourcePlanningTaskResponse)
async def create_resource_planning_task(
    task: ResourcePlanningTaskCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    创建新的资源规划任务（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        # 验证员工是否存在
        cursor.execute(
            "SELECT id FROM employees WHERE id = ?",
            (str(task.employee_id),)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="员工不存在")
        
        # 插入任务
        cursor.execute("""
            INSERT INTO resource_planning_tasks (
                employee_id, task_type_code, start_week, end_week, start_date, end_date,
                topic, location, notes, import_batch_id, source_file_name,
                task_date, year_month, cw_week, day_of_month, task_type,
                created_at, updated_at
            )
            OUTPUT INSERTED.*
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
        """, (
            str(task.employee_id),
            task.task_type_code,
            task.start_week,
            task.end_week,
            task.start_date,
            task.end_date,
            task.topic,
            task.location,
            task.notes,
            str(task.import_batch_id) if task.import_batch_id else None,
            task.source_file_name,
            task.task_date,
            task.year_month,
            task.cw_week,
            task.day_of_month,
            task.task_type
        ))
        
        result = cursor.fetchone()
        cursor.commit()
        
        return row_to_dict(cursor, result)


@router.get("/admin/resource-planning-tasks", response_model=List[ResourcePlanningTaskResponse])
async def list_resource_planning_tasks(
    employee_id: Optional[str] = Query(None, description="按员工 ID 筛选"),
    task_type_code: Optional[str] = Query(None, description="按任务类型代码筛选"),
    start_date: Optional[date] = Query(None, description="开始日期（含）"),
    end_date: Optional[date] = Query(None, description="结束日期（含）"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数量限制"),
    current_user: dict = Depends(get_current_user)
):
    """
    获取资源规划任务列表（仅管理员）
    支持按员工、任务类型、日期范围筛选
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        query = "SELECT TOP (?) * FROM resource_planning_tasks WHERE 1=1"
        params = [limit]
        
        if employee_id:
            query += " AND employee_id = ?"
            params.append(employee_id)
        
        if task_type_code:
            query += " AND task_type_code = ?"
            params.append(task_type_code)
        
        if start_date:
            query += " AND start_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND end_date <= ?"
            params.append(end_date)
        
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return rows_to_list(cursor, rows)


@router.get("/admin/resource-planning-tasks/{task_id}", response_model=ResourcePlanningTaskResponse)
async def get_resource_planning_task(
    task_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    根据 ID 获取资源规划任务详情（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        cursor.execute(
            "SELECT * FROM resource_planning_tasks WHERE id = ?",
            (task_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        return row_to_dict(cursor, row)


@router.put("/admin/resource-planning-tasks/{task_id}", response_model=ResourcePlanningTaskResponse)
async def update_resource_planning_task(
    task_id: int,
    task_update: ResourcePlanningTaskUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    更新资源规划任务（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        # 验证任务是否存在
        cursor.execute(
            "SELECT id FROM resource_planning_tasks WHERE id = ?",
            (task_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 如果要更新员工 ID，验证员工是否存在
        if task_update.employee_id:
            cursor.execute(
                "SELECT id FROM employees WHERE id = ?",
                (str(task_update.employee_id),)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="员工不存在")
        
        # 构建 UPDATE 语句
        update_fields = []
        params = []
        
        if task_update.employee_id is not None:
            update_fields.append("employee_id = ?")
            params.append(str(task_update.employee_id))
        
        if task_update.task_type_code is not None:
            update_fields.append("task_type_code = ?")
            params.append(task_update.task_type_code)
        
        if task_update.start_week is not None:
            update_fields.append("start_week = ?")
            params.append(task_update.start_week)
        
        if task_update.end_week is not None:
            update_fields.append("end_week = ?")
            params.append(task_update.end_week)
        
        if task_update.start_date is not None:
            update_fields.append("start_date = ?")
            params.append(task_update.start_date)
        
        if task_update.end_date is not None:
            update_fields.append("end_date = ?")
            params.append(task_update.end_date)
        
        if task_update.topic is not None:
            update_fields.append("topic = ?")
            params.append(task_update.topic)
        
        if task_update.location is not None:
            update_fields.append("location = ?")
            params.append(task_update.location)
        
        if task_update.notes is not None:
            update_fields.append("notes = ?")
            params.append(task_update.notes)
        
        if task_update.import_batch_id is not None:
            update_fields.append("import_batch_id = ?")
            params.append(str(task_update.import_batch_id))
        
        if task_update.source_file_name is not None:
            update_fields.append("source_file_name = ?")
            params.append(task_update.source_file_name)
        
        if task_update.task_date is not None:
            update_fields.append("task_date = ?")
            params.append(task_update.task_date)
        
        if task_update.year_month is not None:
            update_fields.append("year_month = ?")
            params.append(task_update.year_month)
        
        if task_update.cw_week is not None:
            update_fields.append("cw_week = ?")
            params.append(task_update.cw_week)
        
        if task_update.day_of_month is not None:
            update_fields.append("day_of_month = ?")
            params.append(task_update.day_of_month)
        
        if task_update.task_type is not None:
            update_fields.append("task_type = ?")
            params.append(task_update.task_type)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="没有要更新的字段")
        
        update_fields.append("updated_at = GETDATE()")
        params.append(task_id)
        
        query = f"""
            UPDATE resource_planning_tasks
            SET {', '.join(update_fields)}
            OUTPUT INSERTED.*
            WHERE id = ?
        """
        
        cursor.execute(query, params)
        result = cursor.fetchone()
        cursor.commit()
        
        return row_to_dict(cursor, result)


@router.delete("/admin/resource-planning-tasks/{task_id}")
async def delete_resource_planning_task(
    task_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    删除资源规划任务（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        # 验证任务是否存在
        cursor.execute(
            "SELECT id FROM resource_planning_tasks WHERE id = ?",
            (task_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 硬删除
        cursor.execute(
            "DELETE FROM resource_planning_tasks WHERE id = ?",
            (task_id,)
        )
        cursor.commit()
        
        return {"message": "资源规划任务已删除"}
