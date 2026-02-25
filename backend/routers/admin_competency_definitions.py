"""能力定义管理 API - Phase 3.4.4"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict
from database import db
from auth import verify_admin
from audit import log_audit, log_audit_batch
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/competency-definitions")

class CompetencyDefinitionCreate(BaseModel):
    module_id: int
    module_name: str
    competency_type: str
    competency_code: str
    description: Optional[str] = None
    owner_engineer: Optional[str] = None
    is_key_competency: Optional[bool] = False

class CompetencyDefinitionUpdate(BaseModel):
    module_id: Optional[int] = None
    module_name: Optional[str] = None
    competency_type: Optional[str] = None
    competency_code: Optional[str] = None
    description: Optional[str] = None
    owner_engineer: Optional[str] = None
    is_key_competency: Optional[bool] = None

@router.post("", status_code=201)
def create_competency_definition(data: CompetencyDefinitionCreate, current_user: Dict = Depends(verify_admin)):
    try:
        # 检查 competency_code 是否已存在
        with db.get_cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM dbo.competency_definitions WHERE competency_code = ?", (data.competency_code,))
            if cursor.fetchone()[0] > 0:
                raise HTTPException(400, f"能力代码 '{data.competency_code}' 已存在")
        
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.competency_definitions (
                    module_id, module_name, competency_type, competency_code,
                    description, owner_engineer, is_key_competency, created_at, updated_at
                ) OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
            """, (
                data.module_id, data.module_name, data.competency_type, data.competency_code,
                data.description, data.owner_engineer, data.is_key_competency
            ))
            def_id = cursor.fetchone()[0]
        
        log_audit('competency_definitions', str(def_id), 'INSERT', current_user['user_id'], 
                 current_user['name'], current_user['email'], new_value=data.model_dump().__str__())
        logger.info(f"✅ 创建能力定义: {data.competency_code} (ID={def_id})")
        
        return {
            'id': def_id, 'module_id': data.module_id, 'module_name': data.module_name,
            'competency_type': data.competency_type, 'competency_code': data.competency_code,
            'owner_engineer': data.owner_engineer, 'is_key_competency': data.is_key_competency
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 创建能力定义失败: {e}")
        raise HTTPException(500, str(e))

@router.get("")
def list_competency_definitions(
    module_id: Optional[int] = Query(None),
    current_user: Dict = Depends(verify_admin)
):
    try:
        with db.get_cursor() as cursor:
            sql = """
                SELECT id, module_id, module_name, competency_type, competency_code, 
                       owner_engineer, is_key_competency
                FROM dbo.competency_definitions WHERE 1=1
            """
            params = []
            
            if module_id:
                sql += " AND module_id = ?"
                params.append(module_id)
            
            sql += " ORDER BY module_id, id"
            cursor.execute(sql, params)
            
            definitions = [{
                'id': r[0], 'module_id': r[1], 'module_name': r[2],
                'competency_type': r[3], 'competency_code': r[4],
                'owner_engineer': r[5], 'is_key_competency': r[6]
            } for r in cursor.fetchall()]
            
            return {'competency_definitions': definitions, 'count': len(definitions)}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/{def_id}")
def get_competency_definition(def_id: int, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, module_id, module_name, competency_type, competency_code,
                       description, owner_engineer, is_key_competency
                FROM dbo.competency_definitions WHERE id = ?
            """, (def_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(404, "能力定义不存在")
            
            return {
                'id': row[0], 'module_id': row[1], 'module_name': row[2],
                'competency_type': row[3], 'competency_code': row[4],
                'description': row[5], 'owner_engineer': row[6], 'is_key_competency': row[7]
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.put("/{def_id}")
def update_competency_definition(def_id: int, data: CompetencyDefinitionUpdate, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT module_id, module_name, competency_type, competency_code, owner_engineer, is_key_competency
                FROM dbo.competency_definitions WHERE id = ?
            """, (def_id,))
            old_row = cursor.fetchone()
            
            if not old_row:
                raise HTTPException(404, "能力定义不存在")
            
            old_data = {
                'module_id': old_row[0], 'module_name': old_row[1], 'competency_type': old_row[2],
                'competency_code': old_row[3], 'owner_engineer': old_row[4], 'is_key_competency': old_row[5]
            }
        
        # 如果更新 competency_code，检查是否重复
        if data.competency_code and data.competency_code != old_data['competency_code']:
            with db.get_cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM dbo.competency_definitions WHERE competency_code = ? AND id != ?", 
                             (data.competency_code, def_id))
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"能力代码 '{data.competency_code}' 已被使用")
        
        update_fields, params, logs = [], [], []
        for field, new_value in data.model_dump(exclude_none=True).items():
            if field in old_data and old_data[field] != new_value:
                update_fields.append(f"{field} = ?")
                params.append(new_value)
                logs.append({
                    'table_name': 'competency_definitions', 'record_id': str(def_id), 'operation_type': 'UPDATE',
                    'field_name': field, 'old_value': str(old_data[field]), 'new_value': str(new_value),
                    'operator_id': current_user['user_id'], 'operator_name': current_user['name'],
                    'operator_email': current_user['email']
                })
        
        if not update_fields:
            return {'message': '没有需要更新的字段'}
        
        update_fields.append("updated_at = GETDATE()")
        params.append(def_id)
        
        with db.get_cursor() as cursor:
            cursor.execute(f"UPDATE dbo.competency_definitions SET {', '.join(update_fields)} WHERE id = ?", params)
        
        if logs:
            log_audit_batch(logs)
        
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT id, module_id, module_name, competency_type, competency_code,
                       owner_engineer, is_key_competency
                FROM dbo.competency_definitions WHERE id = ?
            """, (def_id,))
            row = cursor.fetchone()
            
            return {
                'id': row[0], 'module_id': row[1], 'module_name': row[2],
                'competency_type': row[3], 'competency_code': row[4],
                'owner_engineer': row[5], 'is_key_competency': row[6]
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.delete("/{def_id}")
def delete_competency_definition(def_id: int, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT competency_code FROM dbo.competency_definitions WHERE id = ?", (def_id,))
            row = cursor.fetchone()
            
            if not row:
                raise HTTPException(404, "能力定义不存在")
            
            code = row[0]
            cursor.execute("DELETE FROM dbo.competency_definitions WHERE id = ?", (def_id,))
        
        log_audit('competency_definitions', str(def_id), 'DELETE', current_user['user_id'], 
                 current_user['name'], current_user['email'], old_value=f"competency_code={code}")
        logger.info(f"✅ 删除能力定义: {code} (ID={def_id})")
        
        return {'message': '能力定义已删除', 'id': def_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
