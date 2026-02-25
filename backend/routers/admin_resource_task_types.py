"""
资源任务类型管理 API
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict

from database import db
from auth import get_current_user, verify_admin

router = APIRouter()


class ResourceTaskTypeCreate(BaseModel):
    code: str
    name: str
    color_hex: str
    description: Optional[str] = None


class ResourceTaskTypeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    color_hex: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ResourceTaskTypeResponse(BaseModel):
    id: int
    code: str
    name: str
    color_hex: str
    description: Optional[str]
    is_active: Optional[bool]
    created_at: Optional[str]
    updated_at: Optional[str]


@router.post("/resource-task-types", response_model=ResourceTaskTypeResponse, dependencies=[Depends(verify_admin)])
def create_resource_task_type(data: ResourceTaskTypeCreate, current_user: Dict = Depends(get_current_user)):
    """创建资源任务类型"""
    try:
        with db.get_cursor() as cursor:
            # 检查 code 是否已存在
            cursor.execute("SELECT id FROM resource_task_types WHERE code = ?", (data.code,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Code '{data.code}' already exists")
            
            # 插入新类型
            cursor.execute("""
                INSERT INTO resource_task_types (code, name, color_hex, description, is_active, created_at, updated_at)
                OUTPUT INSERTED.*
                VALUES (?, ?, ?, ?, 1, GETDATE(), GETDATE())
            """, (data.code, data.name, data.color_hex, data.description))
            
            row = cursor.fetchone()
            
            return {
                "id": row.id,
                "code": row.code,
                "name": row.name,
                "color_hex": row.color_hex,
                "description": row.description,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resource-task-types", response_model=List[ResourceTaskTypeResponse])
def list_resource_task_types(
    is_active: Optional[bool] = None,
    current_user: Dict = Depends(get_current_user)
):
    """获取资源任务类型列表"""
    try:
        with db.get_cursor() as cursor:
            query = "SELECT * FROM resource_task_types WHERE 1=1"
            params = []
            
            if is_active is not None:
                query += " AND is_active = ?"
                params.append(is_active)
            
            query += " ORDER BY id"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            return [{
                "id": row.id,
                "code": row.code,
                "name": row.name,
                "color_hex": row.color_hex,
                "description": row.description,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            } for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resource-task-types/{type_id}", response_model=ResourceTaskTypeResponse)
def get_resource_task_type(type_id: int, current_user: Dict = Depends(get_current_user)):
    """通过 ID 获取资源任务类型"""
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT * FROM resource_task_types WHERE id = ?", (type_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Resource task type not found")
            
            return {
                "id": row.id,
                "code": row.code,
                "name": row.name,
                "color_hex": row.color_hex,
                "description": row.description,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/resource-task-types/{type_id}", response_model=ResourceTaskTypeResponse, dependencies=[Depends(verify_admin)])
def update_resource_task_type(
    type_id: int,
    data: ResourceTaskTypeUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """更新资源任务类型"""
    try:
        with db.get_cursor() as cursor:
            # 检查类型是否存在
            cursor.execute("SELECT id FROM resource_task_types WHERE id = ?", (type_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Resource task type not found")
            
            # 构建更新 SQL
            update_fields = []
            params = []
            
            if data.code is not None:
                # 检查新 code 是否与其他记录冲突
                cursor.execute("SELECT id FROM resource_task_types WHERE code = ? AND id != ?", (data.code, type_id))
                if cursor.fetchone():
                    raise HTTPException(status_code=400, detail=f"Code '{data.code}' already exists")
                update_fields.append("code = ?")
                params.append(data.code)
            
            if data.name is not None:
                update_fields.append("name = ?")
                params.append(data.name)
            
            if data.color_hex is not None:
                update_fields.append("color_hex = ?")
                params.append(data.color_hex)
            
            if data.description is not None:
                update_fields.append("description = ?")
                params.append(data.description)
            
            if data.is_active is not None:
                update_fields.append("is_active = ?")
                params.append(data.is_active)
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="No fields to update")
            
            update_fields.append("updated_at = GETDATE()")
            params.append(type_id)
            
            query = f"UPDATE resource_task_types SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(query, params)
            
            # 返回更新后的记录
            cursor.execute("SELECT * FROM resource_task_types WHERE id = ?", (type_id,))
            row = cursor.fetchone()
            
            return {
                "id": row.id,
                "code": row.code,
                "name": row.name,
                "color_hex": row.color_hex,
                "description": row.description,
                "is_active": row.is_active,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/resource-task-types/{type_id}", dependencies=[Depends(verify_admin)])
def delete_resource_task_type(type_id: int, current_user: Dict = Depends(get_current_user)):
    """删除资源任务类型（软删除）"""
    try:
        with db.get_cursor() as cursor:
            # 检查类型是否存在
            cursor.execute("SELECT id FROM resource_task_types WHERE id = ?", (type_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Resource task type not found")
            
            # 软删除
            cursor.execute(
                "UPDATE resource_task_types SET is_active = 0, updated_at = GETDATE() WHERE id = ?",
                (type_id,)
            )
            
            return {"message": "Resource task type deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
