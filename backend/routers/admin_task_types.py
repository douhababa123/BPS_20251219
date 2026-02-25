"""任务类型管理 API - Phase 3.4.2"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict
from database import db
from auth import verify_admin
from audit import log_audit, log_audit_batch
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/task-types")

class TaskTypeCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    color_hex: str = "#808080"  # 默认灰色

class TaskTypeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    color_hex: Optional[str] = None

@router.post("", status_code=201)
def create_task_type(data: TaskTypeCreate, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM dbo.task_types WHERE code = ? AND is_active = 1", (data.code,))
            if cursor.fetchone()[0] > 0:
                raise HTTPException(400, f"任务类型代码 '{data.code}' 已存在")
        
        with db.get_cursor() as cursor:
            cursor.execute("INSERT INTO dbo.task_types (code, name, description, color_hex, is_active) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, 1)", 
                         (data.code, data.name, data.description, data.color_hex))
            task_id = cursor.fetchone()[0]
        
        log_audit('task_types', str(task_id), 'INSERT', current_user['user_id'], current_user['name'], current_user['email'], new_value=data.dict().__str__())
        logger.info(f"✅ 创建任务类型: {data.name} (ID={task_id})")
        return {'id': task_id, 'code': data.code, 'name': data.name, 'description': data.description, 'color_hex': data.color_hex, 'is_active': True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 创建任务类型失败: {e}")
        raise HTTPException(500, str(e))

@router.get("")
def list_task_types(include_inactive: bool = Query(False), current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            sql = "SELECT id, code, name, description, color_hex, is_active FROM dbo.task_types" + ("" if include_inactive else " WHERE is_active = 1") + " ORDER BY name"
            cursor.execute(sql)
            task_types = [{'id': r[0], 'code': r[1], 'name': r[2], 'description': r[3], 'color_hex': r[4], 'is_active': r[5]} for r in cursor.fetchall()]
            return {'task_types': task_types, 'count': len(task_types)}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/{task_id}")
def get_task_type(task_id: int, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT id, code, name, description, color_hex, is_active FROM dbo.task_types WHERE id = ?", (task_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(404, "任务类型不存在")
            return {'id': row[0], 'code': row[1], 'name': row[2], 'description': row[3], 'color_hex': row[4], 'is_active': row[5]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.put("/{task_id}")
def update_task_type(task_id: int, data: TaskTypeUpdate, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT code, name, description, color_hex FROM dbo.task_types WHERE id = ? AND is_active = 1", (task_id,))
            old_row = cursor.fetchone()
            if not old_row:
                raise HTTPException(404, "任务类型不存在")
            old_data = {'code': old_row[0], 'name': old_row[1], 'description': old_row[2], 'color_hex': old_row[3]}
        
        update_fields, params, logs = [], [], []
        for field, new_value in data.dict(exclude_none=True).items():
            if old_data.get(field) != new_value:
                update_fields.append(f"{field} = ?")
                params.append(new_value)
                logs.append({'table_name': 'task_types', 'record_id': str(task_id), 'operation_type': 'UPDATE', 'field_name': field,
                           'old_value': str(old_data.get(field)), 'new_value': str(new_value),
                           'operator_id': current_user['user_id'], 'operator_name': current_user['name'], 'operator_email': current_user['email']})
        
        if not update_fields:
            return {'message': '没有需要更新的字段'}
        
        if 'code' in data.dict(exclude_none=True):
            with db.get_cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM dbo.task_types WHERE code = ? AND id != ? AND is_active = 1", (data.code, task_id))
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"任务类型代码 '{data.code}' 已被使用")
        
        params.append(task_id)
        with db.get_cursor() as cursor:
            cursor.execute(f"UPDATE dbo.task_types SET {', '.join(update_fields)} WHERE id = ?", params)
        
        if logs:
            log_audit_batch(logs)
        
        with db.get_cursor() as cursor:
            cursor.execute("SELECT id, code, name, description, color_hex, is_active FROM dbo.task_types WHERE id = ?", (task_id,))
            row = cursor.fetchone()
            return {'id': row[0], 'code': row[1], 'name': row[2], 'description': row[3], 'color_hex': row[4], 'is_active': row[5]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/{task_id}")
def delete_task_type(task_id: int, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT code, name FROM dbo.task_types WHERE id = ? AND is_active = 1", (task_id,))
            old_row = cursor.fetchone()
            if not old_row:
                raise HTTPException(404, "任务类型不存在或已被删除")
        
        with db.get_cursor() as cursor:
            cursor.execute("UPDATE dbo.task_types SET is_active = 0 WHERE id = ?", (task_id,))
        
        log_audit('task_types', str(task_id), 'DELETE', current_user['user_id'], current_user['name'], current_user['email'],
                 old_value=f"code={old_row[0]}, name={old_row[1]}")
        return {'message': f'任务类型 "{old_row[1]}" 已删除'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
