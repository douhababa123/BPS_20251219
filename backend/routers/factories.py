from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import FactoryBase, FactoryCreate, FactoryUpdate, FactoryResponse, MessageResponse
from .auth import get_current_user
from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[FactoryResponse])
def get_factories(cursor=Depends(get_db)):
    """获取所有工厂列表"""
    cursor.execute("SELECT id, code, name, region, is_active, created_at, updated_at FROM factories ORDER BY id")
    rows = cursor.fetchall()
    
    factories = []
    for row in rows:
        factories.append(FactoryResponse(
            id=row[0],
            code=row[1],
            name=row[2],
            region=row[3],
            is_active=row[4],
            created_at=row[5],
            updated_at=row[6]
        ))
    
    return factories


@router.get("/{factory_id}", response_model=FactoryResponse)
def get_factory(factory_id: int, cursor=Depends(get_db)):
    """根据ID获取工厂详情"""
    cursor.execute(
        "SELECT id, code, name, region, is_active, created_at, updated_at FROM factories WHERE id = ?",
        factory_id
    )
    row = cursor.fetchone()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Factory with id {factory_id} not found"
        )
    
    return FactoryResponse(
        id=row[0],
        code=row[1],
        name=row[2],
        region=row[3],
        is_active=row[4],
        created_at=row[5],
        updated_at=row[6]
    )


@router.post("/", response_model=FactoryResponse, status_code=status.HTTP_201_CREATED)
def create_factory(
    factory: FactoryCreate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """创建新工厂（需要认证）"""
    cursor.execute(
        """
        INSERT INTO factories (name, location)
        VALUES (?, ?)
        """,
        factory.name,
        factory.location
    )
    
    cursor.execute("SELECT @@IDENTITY")
    new_id = cursor.fetchone()[0]
    
    cursor.execute(
        "SELECT id, name, location, created_at, updated_at FROM factories WHERE id = ?",
        new_id
    )
    row = cursor.fetchone()
    
    logger.info(f"Factory created: id={new_id}, name={factory.name}, by_user={current_user['email']}")
    
    return FactoryResponse(
        id=row[0],
        name=row[1],
        location=row[2],
        created_at=row[3],
        updated_at=row[4]
    )


@router.put("/{factory_id}", response_model=FactoryResponse)
def update_factory(
    factory_id: int,
    factory: FactoryUpdate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """更新工厂信息（需要认证）"""
    cursor.execute("SELECT id FROM factories WHERE id = ?", factory_id)
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Factory with id {factory_id} not found"
        )
    
    update_fields = []
    params = []
    
    if factory.name is not None:
        update_fields.append("name = ?")
        params.append(factory.name)
    
    if factory.location is not None:
        update_fields.append("location = ?")
        params.append(factory.location)
    
    if update_fields:
        update_fields.append("updated_at = GETDATE()")
        params.append(factory_id)
        
        sql = f"UPDATE factories SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, *params)
        
        logger.info(f"Factory updated: id={factory_id}, by_user={current_user['email']}")
    
    cursor.execute(
        "SELECT id, name, location, created_at, updated_at FROM factories WHERE id = ?",
        factory_id
    )
    row = cursor.fetchone()
    
    return FactoryResponse(
        id=row[0],
        name=row[1],
        location=row[2],
        created_at=row[3],
        updated_at=row[4]
    )


@router.delete("/{factory_id}", response_model=MessageResponse)
def delete_factory(
    factory_id: int,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """删除工厂（需要认证）"""
    cursor.execute("SELECT id FROM factories WHERE id = ?", factory_id)
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Factory with id {factory_id} not found"
        )
    
    # 检查是否有员工关联
    cursor.execute("SELECT COUNT(*) FROM employees WHERE factory_id = ?", factory_id)
    count = cursor.fetchone()[0]
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete factory: {count} employees are associated with it"
        )
    
    cursor.execute("DELETE FROM factories WHERE id = ?", factory_id)
    
    logger.info(f"Factory deleted: id={factory_id}, by_user={current_user['email']}")
    
    return MessageResponse(message=f"Factory {factory_id} deleted successfully")
