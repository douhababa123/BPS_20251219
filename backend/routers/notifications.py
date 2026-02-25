"""
通知路由
Notifications Router - 系统内通知管理
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from uuid import UUID
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Notification, NotificationListResponse, MessageResponse
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


def create_notification(cursor, user_id: str, ntype: str, title: str, body: str, task_id: str = None):
    """
    内部辅助函数：写入一条通知记录
    不自动 commit，由调用方统一 commit
    """
    cursor.execute("""
        INSERT INTO dbo.notifications (user_id, type, title, body, task_id)
        VALUES (?, ?, ?, ?, ?)
    """, user_id, ntype, title, body, task_id)
    # TODO: send_email(user_id, title, body)  -- 邮箱到位后取消注释


def get_all_admin_ids(cursor) -> List[str]:
    """获取所有 admin 用户的 ID 列表"""
    cursor.execute("SELECT id FROM dbo.users WHERE role = 'admin' AND is_active = 1")
    return [str(row[0]) for row in cursor.fetchall()]


@router.get("/", response_model=NotificationListResponse)
def get_notifications(
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """获取当前用户的通知列表（最近 50 条）"""
    user_id = current_user['user_id']

    cursor.execute("""
        SELECT TOP 50
            id, user_id, type, title, body, task_id, is_read, created_at
        FROM dbo.notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
    """, user_id)

    rows = cursor.fetchall()
    notifications = []
    for row in rows:
        notifications.append(Notification(
            id=row[0],
            user_id=row[1],
            type=row[2],
            title=row[3],
            body=row[4],
            task_id=row[5],
            is_read=bool(row[6]),
            created_at=row[7]
        ))

    # 未读数
    cursor.execute("""
        SELECT COUNT(*) FROM dbo.notifications
        WHERE user_id = ? AND is_read = 0
    """, user_id)
    unread_count = cursor.fetchone()[0]

    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count
    )


@router.post("/{notification_id}/read", response_model=MessageResponse)
def mark_as_read(
    notification_id: UUID,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """标记单条通知为已读"""
    user_id = current_user['user_id']

    cursor.execute("""
        UPDATE dbo.notifications
        SET is_read = 1
        WHERE id = ? AND user_id = ?
    """, str(notification_id), user_id)

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="通知不存在或无权限")

    cursor.commit()
    return MessageResponse(message="已标记为已读")


@router.post("/read-all", response_model=MessageResponse)
def mark_all_as_read(
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """标记当前用户所有通知为已读"""
    user_id = current_user['user_id']

    cursor.execute("""
        UPDATE dbo.notifications
        SET is_read = 1
        WHERE user_id = ? AND is_read = 0
    """, user_id)

    cursor.commit()
    return MessageResponse(message="全部已读")
