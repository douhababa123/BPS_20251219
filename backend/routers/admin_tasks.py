"""任务管理 API - Phase 3.4.3"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import date
from database import db
from auth import verify_admin
from audit import log_audit, log_audit_batch
import logging
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/tasks")

class TaskCreate(BaseModel):
    task_name: str
    task_type: str
    task_location: str
    start_date: date
    end_date: date
    assigned_employee_id: Optional[str] = None
    days_count: Optional[int] = None
    hours_per_day: Optional[int] = None
    total_hours: Optional[int] = None
    source: Optional[str] = None
    status: Optional[str] = "active"
    is_cross_factory: Optional[bool] = None
    request_factory: Optional[str] = None
    required_skills: Optional[str] = None
    notes: Optional[str] = None
    time_slot: Optional[str] = None

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    task_type: Optional[str] = None
    task_location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    assigned_employee_id: Optional[str] = None
    days_count: Optional[int] = None
    hours_per_day: Optional[int] = None
    total_hours: Optional[int] = None
    source: Optional[str] = None
    status: Optional[str] = None
    is_cross_factory: Optional[bool] = None
    request_factory: Optional[str] = None
    required_skills: Optional[str] = None
    notes: Optional[str] = None
    time_slot: Optional[str] = None

@router.post("", status_code=201)
def create_task(data: TaskCreate, current_user: Dict = Depends(verify_admin)):
    try:
        task_id = str(uuid.uuid4())
        
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.tasks (
                    id, task_name, task_type, task_location, start_date, end_date,
                    assigned_employee_id, days_count, hours_per_day, total_hours,
                    source, status, is_cross_factory, request_factory, required_skills,
                    notes, time_slot, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
            """, (
                task_id, data.task_name, data.task_type, data.task_location, 
                data.start_date, data.end_date, data.assigned_employee_id,
                data.days_count, data.hours_per_day, data.total_hours,
                data.source, data.status, data.is_cross_factory, data.request_factory,
                data.required_skills, data.notes, data.time_slot
            ))
        
        log_audit('tasks', task_id, 'INSERT', current_user['user_id'], current_user['name'], 
                 current_user['email'], new_value=data.model_dump().__str__())
        logger.info(f"✅ 创建任务: {data.task_name} (ID={task_id})")
        
        return {
            'id': task_id, 'task_name': data.task_name, 'task_type': data.task_type,
            'task_location': data.task_location, 'start_date': str(data.start_date),
            'end_date': str(data.end_date), 'status': data.status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 创建任务失败: {e}")
        raise HTTPException(500, str(e))

@router.get("")
def list_tasks(
    status: Optional[str] = Query(None), 
    task_type: Optional[str] = Query(None),
    current_user: Dict = Depends(verify_admin)
):
    try:
        with db.get_cursor() as cursor:
            sql = "SELECT id, task_name, task_type, task_location, start_date, end_date, status FROM dbo.tasks WHERE 1=1"
            params = []
            
            if status:
                sql += " AND status = ?"
                params.append(status)
            if task_type:
                sql += " AND task_type = ?"
                params.append(task_type)
            
            sql += " ORDER BY start_date DESC"
            cursor.execute(sql, params)
            
            tasks = [{
                'id': str(r[0]), 'task_name': r[1], 'task_type': r[2],
                'task_location': r[3], 'start_date': str(r[4]), 'end_date': str(r[5]),
                'status': r[6]
            } for r in cursor.fetchall()]
            
            return {'tasks': tasks, 'count': len(tasks)}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/{task_id}")
def get_task(task_id: str, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, task_name, task_type, task_location, start_date, end_date,
                       assigned_employee_id, status, notes,
                       rejection_reason, requester_id, rejected_by
                FROM dbo.tasks WHERE id = ?
            """, (task_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(404, "任务不存在")
            
            return {
                'id': str(row[0]), 'task_name': row[1], 'task_type': row[2],
                'task_location': row[3], 'start_date': str(row[4]), 'end_date': str(row[5]),
                'assigned_employee_id': str(row[6]) if row[6] else None,
                'status': row[7], 'notes': row[8],
                'rejection_reason': row[9], 'requester_id': str(row[10]) if row[10] else None,
                'rejected_by': row[11]
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.put("/{task_id}")
def update_task(task_id: str, data: TaskUpdate, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT task_name, task_type, task_location, start_date, end_date, status
                FROM dbo.tasks WHERE id = ?
            """, (task_id,))
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "任务不存在")
            
            old_data = {
                'task_name': old_row[0], 'task_type': old_row[1], 'task_location': old_row[2],
                'start_date': old_row[3], 'end_date': old_row[4], 'status': old_row[5]
            }
        
        update_fields, params, logs = [], [], []
        for field, new_value in data.model_dump(exclude_none=True).items():
            if field in old_data and old_data[field] != new_value:
                update_fields.append(f"{field} = ?")
                params.append(new_value)
                logs.append({
                    'table_name': 'tasks', 'record_id': task_id, 'operation_type': 'UPDATE',
                    'field_name': field, 'old_value': str(old_data[field]), 'new_value': str(new_value),
                    'operator_id': current_user['user_id'], 'operator_name': current_user['name'],
                    'operator_email': current_user['email']
                })
        
        if not update_fields:
            return {'message': '没有需要更新的字段'}
        
        update_fields.append("updated_at = GETDATE()")
        params.append(task_id)
        
        with db.get_cursor() as cursor:
            cursor.execute(f"UPDATE dbo.tasks SET {', '.join(update_fields)} WHERE id = ?", params)
        
        if logs:
            log_audit_batch(logs)
        
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, task_name, task_type, task_location, start_date, end_date, status
                FROM dbo.tasks WHERE id = ?
            """, (task_id,))
            row = cursor.fetchone()
            
            return {
                'id': str(row[0]), 'task_name': row[1], 'task_type': row[2],
                'task_location': row[3], 'start_date': str(row[4]), 'end_date': str(row[5]),
                'status': row[6]
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/{task_id}")
def delete_task(task_id: str, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT task_name FROM dbo.tasks WHERE id = ?", (task_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(404, "任务不存在")
            
            task_name = row[0]
            cursor.execute("DELETE FROM dbo.tasks WHERE id = ?", (task_id,))
        
        log_audit('tasks', task_id, 'DELETE', current_user['user_id'], current_user['name'],
                 current_user['email'], old_value=f"task_name={task_name}")
        logger.info(f"✅ 删除任务: {task_name} (ID={task_id})")
        
        return {'message': '任务已删除', 'id': task_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
