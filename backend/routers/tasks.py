"""
任务路由
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Task, TaskCreate, TaskUpdate, MessageResponse
from database import get_db
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[Task])
def get_tasks(
    employee_id: Optional[UUID] = None,
    status: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    cursor=Depends(get_db)
):
    """获取任务列表，支持筛选"""
    query = """
        SELECT id, task_name, task_type, task_location, assigned_employee_id,
               start_date, end_date,
               COALESCE(hours_per_day, CASE WHEN time_slot IN ('AM','PM') THEN 4 ELSE 8 END) AS hours_per_day,
               COALESCE(total_hours,
                 (DATEDIFF(day, start_date, end_date) + 1) *
                 CASE WHEN time_slot IN ('AM','PM') THEN 4 ELSE 8 END
               ) AS total_hours,
               status, notes, time_slot, created_at, updated_at,
               rejection_reason, requester_id, rejected_by, competence
        FROM dbo.tasks
        WHERE 1=1
    """
    params = []
    
    if employee_id:
        query += " AND assigned_employee_id = ?"
        params.append(str(employee_id))
    if status:
        query += " AND status = ?"
        params.append(status)
    if start_date:
        # 重叠逻辑：任务结束日期 >= 查询起始日期（任务在窗口开始前未结束）
        query += " AND end_date >= ?"
        params.append(start_date)
    if end_date:
        # 重叠逻辑：任务开始日期 <= 查询结束日期（任务在窗口结束后才开始）
        query += " AND start_date <= ?"
        params.append(end_date)
    
    query += " ORDER BY start_date DESC"
    
    cursor.execute(query, params)
    
    tasks = []
    for row in cursor.fetchall():
        tasks.append(Task(
            id=row[0],
            task_name=row[1],
            task_type=row[2],
            task_location=row[3],
            assigned_employee_id=row[4],
            start_date=row[5],
            end_date=row[6],
            hours_per_day=row[7],
            total_hours=row[8],
            status=row[9],
            notes=row[10],
            time_slot=row[11],
            created_at=row[12],
            updated_at=row[13],
            rejection_reason=row[14] if len(row) > 14 else None,
            requester_id=row[15] if len(row) > 15 else None,
            rejected_by=row[16] if len(row) > 16 else None,
            competence=row[17] if len(row) > 17 else None,
        ))

    return tasks


@router.get("/{task_id}", response_model=Task)
def get_task(task_id: UUID, cursor=Depends(get_db)):
    """获取指定任务"""
    cursor.execute("""
        SELECT id, task_name, task_type, task_location, assigned_employee_id,
               start_date, end_date,
               COALESCE(hours_per_day, CASE WHEN time_slot IN ('AM','PM') THEN 4 ELSE 8 END) AS hours_per_day,
               COALESCE(total_hours,
                 (DATEDIFF(day, start_date, end_date) + 1) *
                 CASE WHEN time_slot IN ('AM','PM') THEN 4 ELSE 8 END
               ) AS total_hours,
               status, notes, time_slot, created_at, updated_at,
               rejection_reason, requester_id, rejected_by, competence
        FROM dbo.tasks
        WHERE id = ?
    """, str(task_id))

    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="任务不存在")

    return Task(
        id=row[0],
        task_name=row[1],
        task_type=row[2],
        task_location=row[3],
        assigned_employee_id=row[4],
        start_date=row[5],
        end_date=row[6],
        hours_per_day=row[7],
        total_hours=row[8],
        status=row[9],
        notes=row[10],
        time_slot=row[11],
        created_at=row[12],
        updated_at=row[13],
        rejection_reason=row[14] if len(row) > 14 else None,
        requester_id=row[15] if len(row) > 15 else None,
        rejected_by=row[16] if len(row) > 16 else None,
        competence=row[17] if len(row) > 17 else None,
    )


@router.post("/", response_model=Task)
def create_task(
    task: TaskCreate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """创建任务"""
    try:
        # 自动计算 hours_per_day 和 total_hours（若未提供）
        from datetime import date as date_type
        hours_per_day = task.hours_per_day
        if hours_per_day is None:
            hours_per_day = 4 if task.time_slot in ('AM', 'PM') else 8

        total_hours = task.total_hours
        if total_hours is None and task.start_date and task.end_date:
            start = task.start_date if isinstance(task.start_date, date_type) else date_type.fromisoformat(str(task.start_date))
            end = task.end_date if isinstance(task.end_date, date_type) else date_type.fromisoformat(str(task.end_date))
            days_count = (end - start).days + 1
            total_hours = days_count * hours_per_day

        cursor.execute("""
            INSERT INTO dbo.tasks 
            (task_name, task_type, task_location, assigned_employee_id,
             start_date, end_date, hours_per_day, total_hours, status,
             notes, time_slot, competence)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            task.task_name,
            task.task_type,
            task.task_location,
            str(task.assigned_employee_id) if task.assigned_employee_id else None,
            task.start_date,
            task.end_date,
            hours_per_day,
            total_hours,
            task.status,
            task.notes,
            task.time_slot,
            task.competence
        ))
        
        new_id = str(cursor.fetchone()[0])
        cursor.commit()
        
        return get_task(UUID(new_id), cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"创建任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@router.put("/{task_id}", response_model=Task)
def update_task(
    task_id: UUID,
    task: TaskUpdate,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """更新任务"""
    # 检查是否存在
    existing = get_task(task_id, cursor)
    
    # 构建更新字段
    update_fields = []
    params = []
    
    if task.task_name is not None:
        update_fields.append("task_name = ?")
        params.append(task.task_name)
    if task.task_type is not None:
        update_fields.append("task_type = ?")
        params.append(task.task_type)
    if task.task_location is not None:
        update_fields.append("task_location = ?")
        params.append(task.task_location)
    if task.assigned_employee_id is not None:
        update_fields.append("assigned_employee_id = ?")
        params.append(str(task.assigned_employee_id))
    if task.start_date is not None:
        update_fields.append("start_date = ?")
        params.append(task.start_date)
    if task.end_date is not None:
        update_fields.append("end_date = ?")
        params.append(task.end_date)
    if task.hours_per_day is not None:
        update_fields.append("hours_per_day = ?")
        params.append(task.hours_per_day)
    if task.total_hours is not None:
        update_fields.append("total_hours = ?")
        params.append(task.total_hours)
    if task.status is not None:
        update_fields.append("status = ?")
        params.append(task.status)
    if task.notes is not None:
        update_fields.append("notes = ?")
        params.append(task.notes)
    if task.time_slot is not None:
        update_fields.append("time_slot = ?")
        params.append(task.time_slot)
    if task.competence is not None:
        update_fields.append("competence = ?")
        params.append(task.competence)
    
    if not update_fields:
        return existing
    
    update_fields.append("updated_at = GETDATE()")
    params.append(str(task_id))
    
    try:
        sql = f"UPDATE dbo.tasks SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, params)
        cursor.commit()
        
        return get_task(task_id, cursor)
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"更新任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")


@router.delete("/{task_id}", response_model=MessageResponse)
def delete_task(
    task_id: UUID,
    cursor=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """删除任务"""
    # 检查是否存在
    get_task(task_id, cursor)
    
    try:
        cursor.execute("DELETE FROM dbo.tasks WHERE id = ?", str(task_id))
        cursor.commit()
        
        return MessageResponse(message="删除成功")
    
    except Exception as e:
        cursor.rollback()
        logger.error(f"删除任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


# ============================================================================
# 审批工作流接口
# ============================================================================

def _get_task_or_404(cursor, task_id: str) -> dict:
    """获取任务基本信息，不存在则 404"""
    cursor.execute("""
        SELECT id, task_name, assigned_employee_id, requester_id, status
        FROM dbo.tasks WHERE id = ?
    """, task_id)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {
        'id': str(row[0]),
        'task_name': row[1],
        'assigned_employee_id': str(row[2]) if row[2] else None,
        'requester_id': str(row[3]) if row[3] else None,
        'status': row[4]
    }


def _find_user_by_employee_id(cursor, employee_id: str) -> Optional[str]:
    """通过员工 ID 找到对应的 user_id"""
    cursor.execute("""
        SELECT u.id FROM dbo.users u
        INNER JOIN dbo.employees e ON e.email = u.email
        WHERE e.id = ?
    """, employee_id)
    row = cursor.fetchone()
    return str(row[0]) if row else None


@router.post("/{task_id}/approve", response_model=MessageResponse)
def approve_task(
    task_id: UUID,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """
    审批通过（仅 admin）
    pending_approval → planned，通知被指派工程师
    """
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="仅 Site PS (admin) 可审批")

    task = _get_task_or_404(cursor, str(task_id))
    if task['status'] != 'pending_approval':
        raise HTTPException(status_code=400, detail=f"任务当前状态为 {task['status']}，无法审批")

    try:
        cursor.execute("""
            UPDATE dbo.tasks
            SET status = 'planned', updated_at = GETDATE()
            WHERE id = ?
        """, str(task_id))

        # 通知被指派工程师 + 申请人
        from .notifications import create_notification
        assignee_user_id = None
        if task['assigned_employee_id']:
            assignee_user_id = _find_user_by_employee_id(cursor, task['assigned_employee_id'])
            if assignee_user_id:
                create_notification(
                    cursor, assignee_user_id,
                    'task_approved',
                    f'您有新任务待确认：{task["task_name"]}',
                    f'您的任务申请已通过审批，任务：{task["task_name"]}，请前往日程页确认接受。',
                    str(task_id)
                )

        if task['requester_id'] and task['requester_id'] != assignee_user_id:
            create_notification(
                cursor, task['requester_id'],
                'task_approved',
                f'任务申请已通过审批：{task["task_name"]}',
                f'您的任务申请《{task["task_name"]}》已通过 Site PS 审批，当前正在等待工程师确认接受。',
                str(task_id)
            )

        cursor.commit()
        logger.info(f"✅ 任务审批通过: {task['task_name']} ({task_id})")
        return MessageResponse(message="审批通过，任务已写入日程")

    except HTTPException:
        raise
    except Exception as e:
        cursor.rollback()
        logger.error(f"审批通过失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{task_id}/reject", response_model=MessageResponse)
def reject_task(
    task_id: UUID,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """
    审批拒绝（仅 admin）
    pending_approval → rejected，需填写拒绝原因，通知申请人
    """
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="仅 Site PS (admin) 可拒绝审批")

    rejection_reason = (body.get('rejection_reason') or '').strip()
    if not rejection_reason:
        raise HTTPException(status_code=400, detail="拒绝时必须填写原因")

    task = _get_task_or_404(cursor, str(task_id))
    if task['status'] != 'pending_approval':
        raise HTTPException(status_code=400, detail=f"任务当前状态为 {task['status']}，无法拒绝")

    try:
        cursor.execute("""
            UPDATE dbo.tasks
            SET status = 'rejected',
                rejection_reason = ?,
                rejected_by = 'admin',
                updated_at = GETDATE()
            WHERE id = ?
        """, rejection_reason, str(task_id))

        # 通知申请人
        from .notifications import create_notification
        if task['requester_id']:
            create_notification(
                cursor, task['requester_id'],
                'task_rejected',
                f'任务申请被拒绝：{task["task_name"]}',
                f'您的任务申请《{task["task_name"]}》已被 Site PS 拒绝，原因：{rejection_reason}',
                str(task_id)
            )

        cursor.commit()
        logger.info(f"✅ 任务申请拒绝: {task['task_name']} ({task_id})")
        return MessageResponse(message="已拒绝任务申请")

    except HTTPException:
        raise
    except Exception as e:
        cursor.rollback()
        logger.error(f"拒绝任务失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{task_id}/confirm", response_model=MessageResponse)
def confirm_task(
    task_id: UUID,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """
    工程师确认接受任务（仅任务接收人本人）
    planned → confirmed，通知申请人 + 所有 admin
    """
    task = _get_task_or_404(cursor, str(task_id))
    if task['status'] != 'planned':
        raise HTTPException(status_code=400, detail=f"任务当前状态为 {task['status']}，无法确认")

    # 验证是否是本人（admin 可直接通过，普通用户需验证 employee 记录）
    current_user_id = current_user['user_id']
    is_admin = current_user.get('role') == 'admin'
    if not is_admin:
        cursor.execute("""
            SELECT e.id FROM dbo.employees e
            INNER JOIN dbo.users u ON u.email = e.email
            WHERE u.id = ?
        """, current_user_id)
        emp_row = cursor.fetchone()
        if not emp_row:
            raise HTTPException(status_code=403, detail="未找到对应员工记录")
        current_emp_id = str(emp_row[0])
        if task['assigned_employee_id'] != current_emp_id:
            raise HTTPException(status_code=403, detail="只能确认分配给自己的任务")

    try:
        cursor.execute("""
            UPDATE dbo.tasks
            SET status = 'confirmed', updated_at = GETDATE()
            WHERE id = ?
        """, str(task_id))

        # 通知申请人 + 所有 admin
        from .notifications import create_notification, get_all_admin_ids
        notify_ids = set()
        if task['requester_id']:
            notify_ids.add(task['requester_id'])
        for admin_id in get_all_admin_ids(cursor):
            notify_ids.add(admin_id)
        # 不重复通知自己
        notify_ids.discard(current_user_id)

        for uid in notify_ids:
            create_notification(
                cursor, uid,
                'task_confirmed',
                f'工程师已确认接受任务：{task["task_name"]}',
                f'工程师已确认接受任务《{task["task_name"]}》，任务流程完成。',
                str(task_id)
            )

        cursor.commit()
        logger.info(f"✅ 工程师确认任务: {task['task_name']} ({task_id})")
        return MessageResponse(message="已确认接受任务")

    except HTTPException:
        raise
    except Exception as e:
        cursor.rollback()
        logger.error(f"确认任务失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{task_id}/employee-reject", response_model=MessageResponse)
def employee_reject_task(
    task_id: UUID,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """
    工程师拒绝任务（仅任务接收人本人）
    planned → employee_rejected，需填写拒绝原因，通知申请人 + 所有 admin
    """
    rejection_reason = (body.get('rejection_reason') or '').strip()
    if not rejection_reason:
        raise HTTPException(status_code=400, detail="拒绝时必须填写原因")

    task = _get_task_or_404(cursor, str(task_id))
    if task['status'] != 'planned':
        raise HTTPException(status_code=400, detail=f"任务当前状态为 {task['status']}，无法拒绝")

    # 验证是否是本人（admin 可直接通过，普通用户需验证 employee 记录）
    current_user_id = current_user['user_id']
    is_admin = current_user.get('role') == 'admin'
    if not is_admin:
        cursor.execute("""
            SELECT e.id FROM dbo.employees e
            INNER JOIN dbo.users u ON u.email = e.email
            WHERE u.id = ?
        """, current_user_id)
        emp_row = cursor.fetchone()
        if not emp_row:
            raise HTTPException(status_code=403, detail="未找到对应员工记录")
        current_emp_id = str(emp_row[0])
        if task['assigned_employee_id'] != current_emp_id:
            raise HTTPException(status_code=403, detail="只能拒绝分配给自己的任务")

    try:
        cursor.execute("""
            UPDATE dbo.tasks
            SET status = 'employee_rejected',
                rejection_reason = ?,
                rejected_by = 'employee',
                updated_at = GETDATE()
            WHERE id = ?
        """, rejection_reason, str(task_id))

        # 通知申请人 + 所有 admin
        from .notifications import create_notification, get_all_admin_ids
        notify_ids = set()
        if task['requester_id']:
            notify_ids.add(task['requester_id'])
        for admin_id in get_all_admin_ids(cursor):
            notify_ids.add(admin_id)
        notify_ids.discard(current_user_id)

        for uid in notify_ids:
            create_notification(
                cursor, uid,
                'task_employee_rejected',
                f'工程师拒绝了任务：{task["task_name"]}',
                f'工程师拒绝了任务《{task["task_name"]}》，原因：{rejection_reason}，请 Site PS 重新协调资源。',
                str(task_id)
            )

        cursor.commit()
        logger.info(f"✅ 工程师拒绝任务: {task['task_name']} ({task_id})")
        return MessageResponse(message="已拒绝任务")

    except HTTPException:
        raise
    except Exception as e:
        cursor.rollback()
        logger.error(f"工程师拒绝任务失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
