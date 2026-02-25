"""
工厂管理 API 路由
Phase 3.4.1: factories 表 CRUD + 审计日志集成
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict
from database import db
from auth import verify_admin
from audit import log_audit, log_audit_batch
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/factories")


class FactoryCreate(BaseModel):
    code: str
    name: str
    region: Optional[str] = None


class FactoryUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    region: Optional[str] = None


class FactoryResponse(BaseModel):
    id: int
    code: str
    name: str
    region: Optional[str]
    is_active: bool


@router.post("", status_code=201)
def create_factory(factory_data: FactoryCreate, current_user: Dict = Depends(verify_admin)):
    try:
        # 检查 code 是否重复
        with db.get_cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM dbo.factories WHERE code = ? AND is_active = 1", (factory_data.code,))
            if cursor.fetchone()[0] > 0:
                raise HTTPException(400, f"工厂代码 '{factory_data.code}' 已存在")
        
        # 插入新工厂
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO dbo.factories (code, name, region, is_active)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, 1)
            """, (factory_data.code, factory_data.name, factory_data.region))
            factory_id = cursor.fetchone()[0]
        
        # 记录审计日志
        log_audit(
            table_name='factories',
            record_id=str(factory_id),
            operation_type='INSERT',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            new_value=factory_data.dict().__str__()
        )
        
        logger.info(f"✅ 创建工厂: {factory_data.name} (ID={factory_id}) by {current_user['name']}")
        
        return {
            'id': factory_id,
            'code': factory_data.code,
            'name': factory_data.name,
            'region': factory_data.region,
            'is_active': True
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 创建工厂失败: {e}")
        raise HTTPException(500, f"创建工厂失败: {str(e)}")


@router.get("")
def list_factories(
    include_inactive: bool = Query(False),
    current_user: Dict = Depends(verify_admin)
):
    try:
        with db.get_cursor() as cursor:
            if include_inactive:
                sql = "SELECT id, code, name, region, is_active FROM dbo.factories ORDER BY name"
            else:
                sql = "SELECT id, code, name, region, is_active FROM dbo.factories WHERE is_active = 1 ORDER BY name"
            
            cursor.execute(sql)
            factories = []
            for row in cursor.fetchall():
                factories.append({
                    'id': row[0],
                    'code': row[1],
                    'name': row[2],
                    'region': row[3],
                    'is_active': row[4]
                })
            
            logger.info(f"🔍 查询工厂列表: {len(factories)} 个, 操作人: {current_user['name']}")
            return {'factories': factories, 'count': len(factories)}
    except Exception as e:
        logger.error(f"❌ 查询工厂列表失败: {e}")
        raise HTTPException(500, f"查询工厂列表失败: {str(e)}")


@router.get("/{factory_id}")
def get_factory(factory_id: int, current_user: Dict = Depends(verify_admin)):
    try:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT id, code, name, region, is_active FROM dbo.factories WHERE id = ?", (factory_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(404, "工厂不存在")
            
            return {
                'id': row[0],
                'code': row[1],
                'name': row[2],
                'region': row[3],
                'is_active': row[4]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 查询工厂详情失败: {e}")
        raise HTTPException(500, f"查询工厂详情失败: {str(e)}")


@router.put("/{factory_id}")
def update_factory(factory_id: int, factory_data: FactoryUpdate, current_user: Dict = Depends(verify_admin)):
    try:
        # 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("SELECT code, name, region FROM dbo.factories WHERE id = ? AND is_active = 1", (factory_id,))
            old_row = cursor.fetchone()
            if not old_row:
                raise HTTPException(404, "工厂不存在")
            
            old_data = {'code': old_row[0], 'name': old_row[1], 'region': old_row[2]}
        
        # 构建更新语句
        update_fields = []
        params = []
        logs = []
        
        for field, new_value in factory_data.dict(exclude_none=True).items():
            old_value = old_data.get(field)
            if old_value != new_value:
                update_fields.append(f"{field} = ?")
                params.append(new_value)
                logs.append({
                    'table_name': 'factories',
                    'record_id': str(factory_id),
                    'operation_type': 'UPDATE',
                    'field_name': field,
                    'old_value': str(old_value) if old_value else None,
                    'new_value': str(new_value) if new_value else None,
                    'operator_id': current_user['user_id'],
                    'operator_name': current_user['name'],
                    'operator_email': current_user['email']
                })
        
        if not update_fields:
            return {'message': '没有需要更新的字段'}
        
        # 检查 code 重复
        if 'code' in factory_data.dict(exclude_none=True):
            with db.get_cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM dbo.factories WHERE code = ? AND id != ? AND is_active = 1", 
                             (factory_data.code, factory_id))
                if cursor.fetchone()[0] > 0:
                    raise HTTPException(400, f"工厂代码 '{factory_data.code}' 已被其他工厂使用")
        
        # 执行更新
        params.append(factory_id)
        sql = f"UPDATE dbo.factories SET {', '.join(update_fields)} WHERE id = ?"
        with db.get_cursor() as cursor:
            cursor.execute(sql, params)
        
        # 批量记录审计日志
        if logs:
            log_audit_batch(logs)
        
        logger.info(f"✅ 更新工厂: ID={factory_id}, {len(logs)} 个字段变更, 操作人: {current_user['name']}")
        
        # 返回更新后的数据
        with db.get_cursor() as cursor:
            cursor.execute("SELECT id, code, name, region, is_active FROM dbo.factories WHERE id = ?", (factory_id,))
            row = cursor.fetchone()
            return {
                'id': row[0],
                'code': row[1],
                'name': row[2],
                'region': row[3],
                'is_active': row[4]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 更新工厂失败: {e}")
        raise HTTPException(500, f"更新工厂失败: {str(e)}")


@router.delete("/{factory_id}")
def delete_factory(factory_id: int, current_user: Dict = Depends(verify_admin)):
    try:
        # 查询旧值
        with db.get_cursor() as cursor:
            cursor.execute("SELECT code, name FROM dbo.factories WHERE id = ? AND is_active = 1", (factory_id,))
            old_row = cursor.fetchone()
            if not old_row:
                raise HTTPException(404, "工厂不存在或已被删除")
        
        # 软删除
        with db.get_cursor() as cursor:
            cursor.execute("UPDATE dbo.factories SET is_active = 0 WHERE id = ?", (factory_id,))
        
        # 记录审计日志
        log_audit(
            table_name='factories',
            record_id=str(factory_id),
            operation_type='DELETE',
            operator_id=current_user['user_id'],
            operator_name=current_user['name'],
            operator_email=current_user['email'],
            old_value=f"code={old_row[0]}, name={old_row[1]}"
        )
        
        logger.info(f"✅ 删除工厂: {old_row[1]} (ID={factory_id}), 操作人: {current_user['name']}")
        return {'message': f'工厂 "{old_row[1]}" 已删除'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 删除工厂失败: {e}")
        raise HTTPException(500, f"删除工厂失败: {str(e)}")
