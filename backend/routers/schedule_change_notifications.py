"""
计划变更通知路由
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from uuid import UUID
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    ScheduleChangeNotification, 
    ScheduleChangeNotificationCreate, 
    ScheduleChangeNotificationUpdate, 
    MessageResponse
)
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def _resolve_modifier_employee_id(cursor, current_user: dict, requested_employee_id: str) -> str:
    """Resolve the modifier to a valid employees.id, tolerating stale client payloads."""
    cursor.execute(
        "SELECT id FROM dbo.employees WHERE id = ?",
        requested_employee_id
    )
    existing_employee = cursor.fetchone()
    if existing_employee:
        return str(existing_employee[0])

    cursor.execute("""
        SELECT e.id
        FROM dbo.employees e
        INNER JOIN dbo.users u ON u.email = e.email
        WHERE u.id = ?
    """, current_user.get("user_id"))
    current_employee = cursor.fetchone()
    if current_employee:
        return str(current_employee[0])

    raise HTTPException(
        status_code=400,
        detail="当前登录账号未绑定员工记录，无法创建计划变更通知"
    )


@router.get("/", response_model=List[ScheduleChangeNotification])
def get_notifications(
    employee_id: Optional[UUID] = None,
    is_read: Optional[bool] = None,
    cursor=Depends(get_db)
):
    """获取计划变更通知列表，支持筛选"""
    query = """
        SELECT id, task_id, affected_employee_id, modified_by_employee_id,
               notification_type, change_description, is_read, 
               created_at
        FROM dbo.schedule_change_notifications
        WHERE 1=1
    """
    params = []
    
    if employee_id:
        query += " AND affected_employee_id = ?"
        params.append(str(employee_id))
    if is_read is not None:
        query += " AND is_read = ?"
        params.append(is_read)
    
    query += " ORDER BY created_at DESC"
    
    cursor.execute(query, params)
    
    notifications = []
    for row in cursor.fetchall():
        notifications.append(ScheduleChangeNotification(
            id=row[0],
            task_id=row[1],
            affected_employee_id=row[2],
            modified_by_employee_id=row[3],
            notification_type=row[4],
            change_description=row[5],
            is_read=bool(row[6]) if row[6] is not None else False,
            notification_date=row[7],  # 使用 created_at 作为 notification_date
            created_at=row[7]
        ))
    
    return notifications


@router.get("/{notification_id}", response_model=ScheduleChangeNotification)
def get_notification(notification_id: UUID, cursor=Depends(get_db)):
    """获取指定通知"""
    cursor.execute("""
        SELECT id, task_id, affected_employee_id, modified_by_employee_id,
               notification_type, change_description, is_read, 
               created_at
        FROM dbo.schedule_change_notifications
        WHERE id = ?
    """, str(notification_id))
    
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    return ScheduleChangeNotification(
        id=row[0],
        task_id=row[1],
        affected_employee_id=row[2],
        modified_by_employee_id=row[3],
        notification_type=row[4],
        change_description=row[5],
        is_read=bool(row[6]) if row[6] is not None else False,
        notification_date=row[7],  # 使用 created_at 作为 notification_date
        created_at=row[7]
    )


@router.post("/", response_model=ScheduleChangeNotification)
def create_notification(
    notification: ScheduleChangeNotificationCreate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """创建计划变更通知"""
    try:
        modifier_employee_id = _resolve_modifier_employee_id(
            cursor,
            current_user,
            str(notification.modified_by_employee_id)
        )

        cursor.execute("""
            INSERT INTO dbo.schedule_change_notifications 
            (task_id, affected_employee_id, modified_by_employee_id,
             notification_type, change_description, is_read)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            str(notification.task_id),
            str(notification.affected_employee_id),
            modifier_employee_id,
            notification.notification_type,
            notification.change_description,
            notification.is_read
        ))
        
        new_id = str(cursor.fetchone()[0])
        cursor.commit()
        
        return get_notification(UUID(new_id), cursor)
    
    except HTTPException:
        cursor.rollback()
        raise
    except Exception as e:
        cursor.rollback()
        logger.error(f"创建通知失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.put("/{notification_id}", response_model=ScheduleChangeNotification)
def update_notification(
    notification_id: UUID,
    notification: ScheduleChangeNotificationUpdate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """更新通知（标记已读）"""
    # 检查是否存在
    existing = get_notification(notification_id, cursor)
    
    if notification.is_read is None:
        return existing
    
    try:
        cursor.execute("""
            UPDATE dbo.schedule_change_notifications 
            SET is_read = ? 
            WHERE id = ?
        """, (notification.is_read, str(notification_id)))
        cursor.commit()
        
        return get_notification(notification_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"更新通知失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/{notification_id}", response_model=MessageResponse)
def delete_notification(
    notification_id: UUID,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """删除通知"""
    # 检查是否存在
    get_notification(notification_id, cursor)
    
    try:
        cursor.execute("DELETE FROM dbo.schedule_change_notifications WHERE id = ?", str(notification_id))
        cursor.commit()
        
        return MessageResponse(message="删除成功")
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"删除通知失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")
