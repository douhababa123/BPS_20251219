from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
import logging
from uuid import UUID
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import EmployeeBase, EmployeeCreate, EmployeeUpdate, EmployeeResponse, MessageResponse
from .auth import get_current_user
from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=List[EmployeeResponse])
def get_employees(
    department_id: Optional[int] = Query(None, description="Filter by department"),
    cursor=Depends(get_db)
):
    """获取所有员工列表，支持筛选"""
    sql = """
        SELECT e.id, e.employee_id, e.name, e.email, 
               e.department_id, e.position, e.role, e.is_active, 
               e.created_at, e.updated_at,
               d.name as department_name
        FROM dbo.employees e
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        WHERE ISNULL(e.is_active, 1) = 1
    """
    params = []
    
    if department_id is not None:
        sql += " AND e.department_id = ?"
        params.append(department_id)
    
    sql += " ORDER BY e.name"
    
    cursor.execute(sql, *params) if params else cursor.execute(sql)
    rows = cursor.fetchall()
    
    employees = []
    for row in rows:
        employees.append(EmployeeResponse(
            id=row[0],
            employee_id=row[1],
            name=row[2],
            email=row[3],
            department_id=row[4],
            position=row[5],
            role=row[6],
            is_active=row[7],
            created_at=row[8],
            updated_at=row[9],
            department_name=row[10]
        ))
    
    return employees


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: UUID, cursor=Depends(get_db)):
    """根据ID获取员工详情"""
    sql = """
        SELECT e.id, e.employee_id, e.name, e.email, 
               e.department_id, e.position, e.role, e.is_active, 
               e.created_at, e.updated_at,
               d.name as department_name
        FROM dbo.employees e
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        WHERE e.id = ?
    """
    cursor.execute(sql, str(employee_id))
    row = cursor.fetchone()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id {employee_id} not found"
        )
    
    return EmployeeResponse(
        id=row[0],
        employee_id=row[1],
        name=row[2],
        email=row[3],
        department_id=row[4],
        position=row[5],
        role=row[6],
        is_active=row[7],
        created_at=row[8],
        updated_at=row[9],
        department_name=row[10]
    )


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    employee: EmployeeCreate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """创建新员工（需要认证）"""
    # 检查 employee_id 是否已存在
    cursor.execute("SELECT id FROM dbo.employees WHERE employee_id = ?", employee.employee_id)
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with employee_id {employee.employee_id} already exists"
        )
    
    # 检查邮箱是否已存在
    cursor.execute("SELECT id FROM dbo.employees WHERE email = ?", employee.email)
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee with email {employee.email} already exists"
        )
    
    sql = """
        INSERT INTO dbo.employees 
        (employee_id, name, email, department_id, position, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    cursor.execute(
        sql,
        employee.employee_id,
        employee.name,
        employee.email,
        employee.department_id,
        employee.position,
        employee.role,
        employee.is_active if employee.is_active is not None else True
    )
    
    cursor.execute("SELECT @@IDENTITY")
    new_id = cursor.fetchone()[0]
    
    # 获取完整信息
    cursor.execute(
        """
        SELECT e.id, e.employee_id, e.name, e.email, 
               e.department_id, e.position, e.role, e.is_active, 
               e.created_at, e.updated_at,
               d.name as department_name
        FROM dbo.employees e
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        WHERE e.id = ?
        """,
        new_id
    )
    row = cursor.fetchone()
    
    logger.info(f"Employee created: id={new_id}, employee_id={employee.employee_id}, by_user={current_user['email']}")
    
    return EmployeeResponse(
        id=row[0],
        employee_id=row[1],
        name=row[2],
        email=row[3],
        department_id=row[4],
        position=row[5],
        role=row[6],
        is_active=row[7],
        created_at=row[8],
        updated_at=row[9],
        department_name=row[10]
    )


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: UUID,
    employee: EmployeeUpdate,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """更新员工信息（需要认证）"""
    cursor.execute("SELECT id FROM dbo.employees WHERE id = ?", str(employee_id))
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id {employee_id} not found"
        )
    
    update_fields = []
    params = []
    
    if employee.employee_id is not None:
        update_fields.append("employee_id = ?")
        params.append(employee.employee_id)
    
    if employee.name is not None:
        update_fields.append("name = ?")
        params.append(employee.name)
    
    if employee.email is not None:
        update_fields.append("email = ?")
        params.append(employee.email)
    
    if employee.department_id is not None:
        update_fields.append("department_id = ?")
        params.append(employee.department_id)
    
    if employee.position is not None:
        update_fields.append("position = ?")
        params.append(employee.position)
    
    if employee.role is not None:
        update_fields.append("role = ?")
        params.append(employee.role)
    
    if employee.is_active is not None:
        update_fields.append("is_active = ?")
        params.append(employee.is_active)
    
    if update_fields:
        update_fields.append("updated_at = GETDATE()")
        params.append(str(employee_id))
        
        sql = f"UPDATE dbo.employees SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, *params)
        
        logger.info(f"Employee updated: id={employee_id}, by_user={current_user['email']}")
    
    # 获取更新后的完整信息
    cursor.execute(
        """
        SELECT e.id, e.employee_id, e.name, e.email, 
               e.department_id, e.position, e.role, e.is_active, 
               e.created_at, e.updated_at,
               d.name as department_name
        FROM dbo.employees e
        LEFT JOIN dbo.departments d ON e.department_id = d.id
        WHERE e.id = ?
        """,
        str(employee_id)
    )
    row = cursor.fetchone()
    
    return EmployeeResponse(
        id=row[0],
        employee_id=row[1],
        name=row[2],
        email=row[3],
        department_id=row[4],
        position=row[5],
        role=row[6],
        is_active=row[7],
        created_at=row[8],
        updated_at=row[9],
        department_name=row[10]
    )


@router.delete("/{employee_id}", response_model=MessageResponse)
def delete_employee(
    employee_id: UUID,
    current_user: dict = Depends(get_current_user),
    cursor=Depends(get_db)
):
    """删除员工（需要认证）- 实际上是软删除，设置 is_active=False"""
    cursor.execute("SELECT id FROM dbo.employees WHERE id = ?", str(employee_id))
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with id {employee_id} not found"
        )
    
    # 软删除：设置 is_active = False
    cursor.execute(
        "UPDATE dbo.employees SET is_active = 0, updated_at = GETDATE() WHERE id = ?",
        str(employee_id)
    )
    
    logger.info(f"Employee deactivated: id={employee_id}, by_user={current_user['email']}")
    
    return MessageResponse(message=f"Employee {employee_id} deactivated successfully")
