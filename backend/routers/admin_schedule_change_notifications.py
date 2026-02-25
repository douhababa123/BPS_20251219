"""
计划变更通知管理路由 - Admin Only
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from database import db
from auth import get_current_user, verify_admin
from utils.db_utils import row_to_dict, rows_to_list

router = APIRouter()


class ScheduleChangeNotificationCreate(BaseModel):
    """创建计划变更通知的请求模型"""
    task_id: Optional[UUID] = Field(None, description="任务 ID")
    affected_employee_id: UUID = Field(..., description="受影响的员工 ID")
    modified_by_employee_id: UUID = Field(..., description="修改者员工 ID")
    notification_type: str = Field(..., max_length=50, description="通知类型 (CREATED/UPDATED/DELETED)")
    change_description: Optional[str] = Field(None, description="变更描述")
    is_read: Optional[bool] = Field(False, description="是否已读")


class ScheduleChangeNotificationUpdate(BaseModel):
    """更新计划变更通知的请求模型"""
    task_id: Optional[UUID] = Field(None, description="任务 ID")
    affected_employee_id: Optional[UUID] = Field(None, description="受影响的员工 ID")
    modified_by_employee_id: Optional[UUID] = Field(None, description="修改者员工 ID")
    notification_type: Optional[str] = Field(None, max_length=50, description="通知类型")
    change_description: Optional[str] = Field(None, description="变更描述")
    is_read: Optional[bool] = Field(None, description="是否已读")


class ScheduleChangeNotificationResponse(BaseModel):
    """计划变更通知响应模型"""
    id: UUID
    task_id: Optional[UUID]
    affected_employee_id: UUID
    modified_by_employee_id: UUID
    notification_type: str
    change_description: Optional[str]
    is_read: Optional[bool]
    created_at: Optional[datetime]


@router.post("/admin/schedule-change-notifications", response_model=ScheduleChangeNotificationResponse)
async def create_schedule_change_notification(
    notification: ScheduleChangeNotificationCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    创建新的计划变更通知（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        # 验证受影响的员工是否存在
        cursor.execute(
            "SELECT id FROM employees WHERE id = ?",
            (str(notification.affected_employee_id),)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="受影响的员工不存在")
        
        # 验证修改者员工是否存在
        cursor.execute(
            "SELECT id FROM employees WHERE id = ?",
            (str(notification.modified_by_employee_id),)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="修改者员工不存在")
        
        # 如果提供了任务 ID，验证任务是否存在
        if notification.task_id:
            cursor.execute(
                "SELECT id FROM tasks WHERE id = ?",
                (str(notification.task_id),)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="任务不存在")
        
        # 插入通知
        cursor.execute("""
            INSERT INTO schedule_change_notifications (
                id, task_id, affected_employee_id, modified_by_employee_id,
                notification_type, change_description, is_read, created_at
            )
            OUTPUT INSERTED.*
            VALUES (NEWID(), ?, ?, ?, ?, ?, ?, GETDATE())
        """, (
            str(notification.task_id) if notification.task_id else None,
            str(notification.affected_employee_id),
            str(notification.modified_by_employee_id),
            notification.notification_type,
            notification.change_description,
            notification.is_read
        ))
        
        result = cursor.fetchone()
        cursor.commit()
        
        return row_to_dict(cursor, result)


@router.get("/admin/schedule-change-notifications", response_model=List[ScheduleChangeNotificationResponse])
async def list_schedule_change_notifications(
    affected_employee_id: Optional[str] = Query(None, description="按受影响员工 ID 筛选"),
    modified_by_employee_id: Optional[str] = Query(None, description="按修改者员工 ID 筛选"),
    notification_type: Optional[str] = Query(None, description="按通知类型筛选"),
    is_read: Optional[bool] = Query(None, description="按已读状态筛选"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数量限制"),
    current_user: dict = Depends(get_current_user)
):
    """
    获取计划变更通知列表（仅管理员）
    支持按员工、通知类型、已读状态筛选
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        query = "SELECT TOP (?) * FROM schedule_change_notifications WHERE 1=1"
        params = [limit]
        
        if affected_employee_id:
            query += " AND affected_employee_id = ?"
            params.append(affected_employee_id)
        
        if modified_by_employee_id:
            query += " AND modified_by_employee_id = ?"
            params.append(modified_by_employee_id)
        
        if notification_type:
            query += " AND notification_type = ?"
            params.append(notification_type)
        
        if is_read is not None:
            query += " AND is_read = ?"
            params.append(is_read)
        
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return rows_to_list(cursor, rows)


@router.get("/admin/schedule-change-notifications/{notification_id}", response_model=ScheduleChangeNotificationResponse)
async def get_schedule_change_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    根据 ID 获取计划变更通知详情（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        cursor.execute(
            "SELECT * FROM schedule_change_notifications WHERE id = ?",
            (notification_id,)
        )
        row = cursor.fetchone()
        
        if not row:
            raise HTTPException(status_code=404, detail="通知不存在")
        
        return row_to_dict(cursor, row)


@router.put("/admin/schedule-change-notifications/{notification_id}", response_model=ScheduleChangeNotificationResponse)
async def update_schedule_change_notification(
    notification_id: str,
    notification_update: ScheduleChangeNotificationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    更新计划变更通知（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        # 验证通知是否存在
        cursor.execute(
            "SELECT id FROM schedule_change_notifications WHERE id = ?",
            (notification_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="通知不存在")
        
        # 如果要更新受影响的员工 ID，验证员工是否存在
        if notification_update.affected_employee_id:
            cursor.execute(
                "SELECT id FROM employees WHERE id = ?",
                (str(notification_update.affected_employee_id),)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="受影响的员工不存在")
        
        # 如果要更新修改者员工 ID，验证员工是否存在
        if notification_update.modified_by_employee_id:
            cursor.execute(
                "SELECT id FROM employees WHERE id = ?",
                (str(notification_update.modified_by_employee_id),)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="修改者员工不存在")
        
        # 如果要更新任务 ID，验证任务是否存在
        if notification_update.task_id:
            cursor.execute(
                "SELECT id FROM tasks WHERE id = ?",
                (str(notification_update.task_id),)
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="任务不存在")
        
        # 构建 UPDATE 语句
        update_fields = []
        params = []
        
        if notification_update.task_id is not None:
            update_fields.append("task_id = ?")
            params.append(str(notification_update.task_id))
        
        if notification_update.affected_employee_id is not None:
            update_fields.append("affected_employee_id = ?")
            params.append(str(notification_update.affected_employee_id))
        
        if notification_update.modified_by_employee_id is not None:
            update_fields.append("modified_by_employee_id = ?")
            params.append(str(notification_update.modified_by_employee_id))
        
        if notification_update.notification_type is not None:
            update_fields.append("notification_type = ?")
            params.append(notification_update.notification_type)
        
        if notification_update.change_description is not None:
            update_fields.append("change_description = ?")
            params.append(notification_update.change_description)
        
        if notification_update.is_read is not None:
            update_fields.append("is_read = ?")
            params.append(notification_update.is_read)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="没有要更新的字段")
        
        params.append(notification_id)
        
        query = f"""
            UPDATE schedule_change_notifications
            SET {', '.join(update_fields)}
            OUTPUT INSERTED.*
            WHERE id = ?
        """
        
        cursor.execute(query, params)
        result = cursor.fetchone()
        cursor.commit()
        
        return row_to_dict(cursor, result)


@router.delete("/admin/schedule-change-notifications/{notification_id}")
async def delete_schedule_change_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    删除计划变更通知（仅管理员）
    """
    verify_admin(current_user)
    
    with db.get_cursor() as cursor:
        # 验证通知是否存在
        cursor.execute(
            "SELECT id FROM schedule_change_notifications WHERE id = ?",
            (notification_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="通知不存在")
        
        # 硬删除
        cursor.execute(
            "DELETE FROM schedule_change_notifications WHERE id = ?",
            (notification_id,)
        )
        cursor.commit()
        
        return {"message": "计划变更通知已删除"}
