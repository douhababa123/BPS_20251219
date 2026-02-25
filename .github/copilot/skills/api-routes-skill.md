# FastAPI Routes Skill

**Description**: Design and implement RESTful API routes using FastAPI for the BPS backend.

**Usage**: Use this skill when creating or modifying API endpoints, understanding route patterns, or debugging API issues.

## Capabilities

### 1. Route Structure Pattern

**Standard Router Setup**:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from database import get_db_cursor
from pydantic import BaseModel

router = APIRouter()

# Response Model
class EmployeeResponse(BaseModel):
    id: str
    employee_id: str
    name: str
    department_id: int | None
    email: str | None
    is_active: bool
    
    class Config:
        from_attributes = True
```

### 2. CRUD Endpoints

**GET - List Resources**:
```python
@router.get("/", response_model=List[EmployeeResponse])
async def get_employees(
    department_id: int | None = None,
    is_active: bool = True,
    db_cursor = Depends(get_db_cursor)
):
    """获取员工列表"""
    query = "SELECT * FROM employees WHERE 1=1"
    params = []
    
    if department_id:
        query += " AND department_id = ?"
        params.append(department_id)
    
    if is_active is not None:
        query += " AND is_active = ?"
        params.append(1 if is_active else 0)
    
    db_cursor.execute(query, params)
    rows = db_cursor.fetchall()
    
    return [dict(zip([col[0] for col in db_cursor.description], row)) for row in rows]
```

**GET - Single Resource**:
```python
@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: str,
    db_cursor = Depends(get_db_cursor)
):
    """获取单个员工"""
    db_cursor.execute(
        "SELECT * FROM employees WHERE employee_id = ?",
        (employee_id,)
    )
    row = db_cursor.fetchone()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"员工未找到: {employee_id}"
        )
    
    return dict(zip([col[0] for col in db_cursor.description], row))
```

**POST - Create Resource**:
```python
class EmployeeCreate(BaseModel):
    employee_id: str
    name: str
    department_id: int | None = None
    email: str | None = None

@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee: EmployeeCreate,
    db_cursor = Depends(get_db_cursor)
):
    """创建员工"""
    # 检查是否已存在
    db_cursor.execute(
        "SELECT id FROM employees WHERE employee_id = ?",
        (employee.employee_id,)
    )
    if db_cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"员工ID已存在: {employee.employee_id}"
        )
    
    # 插入新记录
    db_cursor.execute("""
        INSERT INTO employees (employee_id, name, department_id, email, is_active)
        VALUES (?, ?, ?, ?, 1)
    """, (employee.employee_id, employee.name, employee.department_id, employee.email))
    
    db_cursor.connection.commit()
    
    # 返回创建的记录
    return await get_employee(employee.employee_id, db_cursor)
```

**PUT - Update Resource**:
```python
class EmployeeUpdate(BaseModel):
    name: str | None = None
    department_id: int | None = None
    email: str | None = None
    is_active: bool | None = None

@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    employee: EmployeeUpdate,
    db_cursor = Depends(get_db_cursor)
):
    """更新员工信息"""
    # 检查是否存在
    existing = await get_employee(employee_id, db_cursor)
    
    # 构建更新语句
    update_fields = []
    params = []
    
    if employee.name is not None:
        update_fields.append("name = ?")
        params.append(employee.name)
    if employee.department_id is not None:
        update_fields.append("department_id = ?")
        params.append(employee.department_id)
    if employee.email is not None:
        update_fields.append("email = ?")
        params.append(employee.email)
    if employee.is_active is not None:
        update_fields.append("is_active = ?")
        params.append(1 if employee.is_active else 0)
    
    if not update_fields:
        return existing
    
    params.append(employee_id)
    query = f"UPDATE employees SET {', '.join(update_fields)} WHERE employee_id = ?"
    
    db_cursor.execute(query, params)
    db_cursor.connection.commit()
    
    return await get_employee(employee_id, db_cursor)
```

**DELETE - Remove Resource**:
```python
class MessageResponse(BaseModel):
    message: str

@router.delete("/{employee_id}", response_model=MessageResponse)
async def delete_employee(
    employee_id: str,
    soft_delete: bool = True,
    db_cursor = Depends(get_db_cursor)
):
    """删除员工（默认软删除）"""
    # 检查是否存在
    await get_employee(employee_id, db_cursor)
    
    if soft_delete:
        # 软删除：设置 is_active = 0
        db_cursor.execute(
            "UPDATE employees SET is_active = 0 WHERE employee_id = ?",
            (employee_id,)
        )
        message = f"员工已停用: {employee_id}"
    else:
        # 硬删除：物理删除记录
        db_cursor.execute(
            "DELETE FROM employees WHERE employee_id = ?",
            (employee_id,)
        )
        message = f"员工已删除: {employee_id}"
    
    db_cursor.connection.commit()
    return {"message": message}
```

### 3. Dependency Injection

**Database Cursor Dependency**:
```python
# backend/database.py
from typing import Generator
import pyodbc

def get_db_cursor() -> Generator:
    """获取数据库游标（依赖注入）"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        yield cursor
    finally:
        cursor.close()
```

**Authentication Dependency**:
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth import verify_token

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """获取当前用户（需要 JWT token）"""
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token无效或已过期"
        )
    
    return payload

# 使用示例
@router.get("/protected")
async def protected_route(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}
```

### 4. Query Parameters

**Filtering & Pagination**:
```python
from typing import Optional
from fastapi import Query

@router.get("/")
async def get_assessments(
    employee_id: Optional[str] = None,
    year: int = Query(2025, ge=2020, le=2030),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db_cursor = Depends(get_db_cursor)
):
    """
    获取能力评估列表
    
    Args:
        employee_id: 员工ID（可选）
        year: 年份（2020-2030）
        skip: 跳过记录数
        limit: 返回记录数（1-1000）
    """
    query = "SELECT * FROM competency_assessments WHERE year = ?"
    params = [year]
    
    if employee_id:
        query += " AND employee_id = ?"
        params.append(employee_id)
    
    query += " ORDER BY created_at DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
    params.extend([skip, limit])
    
    db_cursor.execute(query, params)
    return db_cursor.fetchall()
```

### 5. Request/Response Models

**Nested Models**:
```python
from pydantic import BaseModel, Field, validator
from datetime import datetime

class SkillBase(BaseModel):
    module_name: str = Field(..., min_length=1, max_length=100)
    skill_name: str = Field(..., min_length=1, max_length=200)
    display_order: int = Field(0, ge=0)

class AssessmentCreate(BaseModel):
    employee_id: str
    skill_id: int
    current_level: int = Field(..., ge=1, le=5)
    target_level: int = Field(..., ge=1, le=5)
    year: int = Field(..., ge=2020, le=2030)
    
    @validator('target_level')
    def target_must_be_gte_current(cls, v, values):
        if 'current_level' in values and v < values['current_level']:
            raise ValueError('目标等级不能低于现状等级')
        return v

class AssessmentResponse(AssessmentCreate):
    id: int
    gap: int
    created_at: datetime
    updated_at: datetime
```

### 6. Error Handling Patterns

**Standard Error Responses**:
```python
# 404 Not Found
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="资源未找到"
)

# 400 Bad Request
raise HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="请求参数无效"
)

# 409 Conflict
raise HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="资源已存在"
)

# 500 Internal Server Error
raise HTTPException(
    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    detail="服务器内部错误"
)
```

**Custom Exception Handler**:
```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"message": "数据验证失败", "detail": str(exc)}
    )
```

### 7. Route Registration

**In main.py**:
```python
from routers import employees, skills, assessments

app.include_router(employees.router, prefix="/api/employees", tags=["员工"])
app.include_router(skills.router, prefix="/api/skills", tags=["技能"])
app.include_router(assessments.router, prefix="/api/assessments", tags=["评估"])
```

### 8. API Documentation

**OpenAPI Metadata**:
```python
@router.post(
    "/",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建员工",
    description="创建新的员工记录，员工ID必须唯一",
    response_description="创建成功的员工信息",
    responses={
        201: {"description": "创建成功"},
        409: {"description": "员工ID已存在"},
        422: {"description": "请求数据验证失败"}
    }
)
async def create_employee(employee: EmployeeCreate):
    ...
```

## Best Practices

### 1. Naming Conventions
- **Routes**: Plural nouns - `/employees`, `/skills`, `/assessments`
- **Path Parameters**: Singular - `/{employee_id}`, `/{skill_id}`
- **Query Parameters**: Descriptive - `?is_active=true`, `?year=2025`

### 2. Response Status Codes
- `200 OK`: Successful GET/PUT
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE (no body)
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Missing/invalid token
- `404 Not Found`: Resource not exists
- `409 Conflict`: Duplicate resource
- `500 Internal Server Error`: Server error

### 3. Database Operations
- Always use parameterized queries (`?` placeholders)
- Commit after write operations
- Close cursors in `finally` blocks (or use `Depends`)
- Handle database exceptions gracefully

### 4. Validation
- Use Pydantic models for automatic validation
- Add custom validators for business logic
- Return clear error messages

### 5. Security
- Never expose internal error details to clients
- Validate all user inputs
- Use dependencies for auth checks
- Sanitize SQL inputs (use parameters)

## Common Patterns

### Complex Query with Joins
```python
@router.get("/with-department")
async def get_employees_with_department(db_cursor = Depends(get_db_cursor)):
    db_cursor.execute("""
        SELECT 
            e.id,
            e.employee_id,
            e.name,
            d.name as department_name,
            e.email
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        WHERE e.is_active = 1
        ORDER BY e.name
    """)
    return db_cursor.fetchall()
```

### Bulk Operations
```python
@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def create_employees_bulk(
    employees: List[EmployeeCreate],
    db_cursor = Depends(get_db_cursor)
):
    """批量创建员工"""
    created = []
    for employee in employees:
        try:
            result = await create_employee(employee, db_cursor)
            created.append(result)
        except HTTPException as e:
            # 记录错误但继续处理
            logger.warning(f"跳过 {employee.employee_id}: {e.detail}")
    
    return {"created": len(created), "employees": created}
```

### Background Tasks
```python
from fastapi import BackgroundTasks

def send_notification(email: str, message: str):
    """后台发送通知"""
    # 发送邮件逻辑
    pass

@router.post("/with-notification")
async def create_and_notify(
    employee: EmployeeCreate,
    background_tasks: BackgroundTasks,
    db_cursor = Depends(get_db_cursor)
):
    result = await create_employee(employee, db_cursor)
    
    if employee.email:
        background_tasks.add_task(
            send_notification,
            employee.email,
            "欢迎加入 BPS 系统"
        )
    
    return result
```

## Testing Routes

### Using Swagger UI
Navigate to `http://localhost:8000/api/docs`

### Using curl
```bash
# GET request
curl http://localhost:8000/api/employees

# POST request
curl -X POST http://localhost:8000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "E001", "name": "Test User"}'

# With authentication
curl http://localhost:8000/api/protected \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using pytest
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_get_employees():
    response = client.get("/api/employees")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_employee():
    response = client.post("/api/employees", json={
        "employee_id": "E999",
        "name": "Test User"
    })
    assert response.status_code == 201
```
