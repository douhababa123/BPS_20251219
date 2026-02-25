"""
部门路由
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Department, DepartmentCreate, DepartmentUpdate, MessageResponse
from database import get_db
import routers.auth as auth_router

def get_current_user(credentials=Depends(auth_router.security)):
    return auth_router.get_current_user(credentials)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[Department])
def get_departments(cursor=Depends(get_db)):
    """获取所有部门列表"""
    cursor.execute("""
        SELECT id, name, code, description, created_at, updated_at
        FROM dbo.departments
        ORDER BY id
    """)
    
    departments = []
    for row in cursor.fetchall():
        departments.append(Department(
            id=row[0],
            name=row[1],
            code=row[2],
            description=row[3],
            created_at=row[4],
            updated_at=row[5]
        ))
    
    return departments


@router.get("/{department_id}", response_model=Department)
def get_department(department_id: int, cursor=Depends(get_db)):
    """获取指定部门"""
    cursor.execute("""
        SELECT id, name, code, description, created_at, updated_at
        FROM dbo.departments
        WHERE id = ?
    """, department_id)
    
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="部门不存在")
    
    return Department(
        id=row[0],
        name=row[1],
        code=row[2],
        description=row[3],
        created_at=row[4],
        updated_at=row[5]
    )


@router.post("/", response_model=Department, status_code=201)
def create_department(
    department: DepartmentCreate,
    cursor=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """创建新部门"""
    cursor.execute("""
        INSERT INTO dbo.departments (name, code, description, created_at, updated_at)
        VALUES (?, ?, ?, GETDATE(), GETDATE())
    """, department.name, department.code, department.description)
    
    # 获取插入的 ID
    cursor.execute("SELECT @@IDENTITY")
    new_id = cursor.fetchone()[0]
    
    logger.info(f"✅ 创建部门: {department.name} (ID: {new_id})")
    
    # 返回创建的部门
    return get_department(new_id, cursor)


@router.put("/{department_id}", response_model=Department)
def update_department(
    department_id: int,
    department: DepartmentUpdate,
    cursor=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """更新部门信息"""
    # 检查部门是否存在
    cursor.execute("SELECT id FROM dbo.departments WHERE id = ?", department_id)
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="部门不存在")
    
    # 构建更新语句
    update_fields = []
    params = []
    
    if department.name is not None:
        update_fields.append("name = ?")
        params.append(department.name)
    if department.code is not None:
        update_fields.append("code = ?")
        params.append(department.code)
    if department.description is not None:
        update_fields.append("description = ?")
        params.append(department.description)
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="没有提供更新字段")
    
    update_fields.append("updated_at = GETDATE()")
    params.append(department_id)
    
    cursor.execute(f"""
        UPDATE dbo.departments
        SET {', '.join(update_fields)}
        WHERE id = ?
    """, *params)
    
    logger.info(f"✅ 更新部门: ID {department_id}")
    
    # 返回更新后的部门
    return get_department(department_id, cursor)


@router.delete("/{department_id}", response_model=MessageResponse)
def delete_department(
    department_id: int,
    cursor=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """删除部门"""
    # 检查部门是否存在
    cursor.execute("SELECT name FROM dbo.departments WHERE id = ?", department_id)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="部门不存在")
    
    dept_name = row[0]
    
    # 检查是否有关联的员工
    cursor.execute("SELECT COUNT(*) FROM dbo.employees WHERE department_id = ?", department_id)
    employee_count = cursor.fetchone()[0]
    
    if employee_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"无法删除部门，该部门下还有 {employee_count} 名员工"
        )
    
    # 删除部门
    cursor.execute("DELETE FROM dbo.departments WHERE id = ?", department_id)
    
    logger.info(f"✅ 删除部门: {dept_name} (ID: {department_id})")
    
    return MessageResponse(
        message="部门删除成功",
        detail=f"已删除部门: {dept_name}"
    )
