# 审计日志系统使用指南

## 📖 概述

审计日志系统用于记录所有数据变更操作，包括新增、修改和删除，确保系统的可追溯性和合规性。

**核心功能**:
- ✅ 自动记录所有数据变更（INSERT/UPDATE/DELETE）
- ✅ 记录操作人信息（ID、姓名、邮箱）
- ✅ 记录字段级变更（旧值 → 新值）
- ✅ 支持多条件查询和筛选
- ✅ 提供统计分析功能
- ✅ 仅管理员可查询审计日志

---

## 🚀 快速开始

### 1. 记录审计日志

#### 记录单条日志
```python
from audit import log_audit

# 记录新增操作
log_id = log_audit(
    table_name='employees',
    record_id='emp-12345',
    operation_type='INSERT',
    operator_id=current_user['id'],
    operator_name=current_user['name'],
    operator_email=current_user['email'],
    new_value='{"name": "张三", "department": "工程部"}'
)
print(f"审计日志已记录: {log_id}")

# 记录更新操作
log_audit(
    table_name='employees',
    record_id='emp-12345',
    operation_type='UPDATE',
    field_name='status',
    old_value='在职',
    new_value='离职',
    operator_id=current_user['id'],
    operator_name=current_user['name'],
    operator_email=current_user['email']
)

# 记录删除操作
log_audit(
    table_name='departments',
    record_id='dept-001',
    operation_type='DELETE',
    operator_id=current_user['id'],
    operator_name=current_user['name'],
    operator_email=current_user['email'],
    old_value='{"name": "研发部", "code": "RD"}'
)
```

#### 批量记录日志（多字段更新）
```python
from audit import log_audit_batch

# 记录多字段更新
logs = [
    {
        'table_name': 'employees',
        'record_id': 'emp-12345',
        'operation_type': 'UPDATE',
        'field_name': 'name',
        'old_value': '张三',
        'new_value': '张三丰',
        'operator_id': current_user['id'],
        'operator_name': current_user['name'],
        'operator_email': current_user['email']
    },
    {
        'table_name': 'employees',
        'record_id': 'emp-12345',
        'operation_type': 'UPDATE',
        'field_name': 'email',
        'old_value': 'zhangsan@bosch.com',
        'new_value': 'zhangsanfeng@bosch.com',
        'operator_id': current_user['id'],
        'operator_name': current_user['name'],
        'operator_email': current_user['email']
    }
]

log_ids = log_audit_batch(logs)
print(f"已记录 {len(log_ids)} 条审计日志")
```

---

### 2. 查询审计日志

#### 查询所有日志
```python
from audit import query_audit_logs

# 查询最近100条日志
logs = query_audit_logs(limit=100)
for log in logs:
    print(f"{log['operated_at']} - {log['operator_name']} {log['operation_type']} {log['table_name']}.{log['record_id']}")
```

#### 按表名筛选
```python
# 查询 employees 表的所有变更
logs = query_audit_logs(table_name='employees')
print(f"employees 表共有 {len(logs)} 条变更记录")
```

#### 按操作人筛选
```python
# 查询特定用户的所有操作
logs = query_audit_logs(operator_id='user-uuid-here')
print(f"该用户共操作 {len(logs)} 次")
```

#### 按操作类型筛选
```python
# 只查询删除操作
logs = query_audit_logs(operation_type='DELETE')
for log in logs:
    print(f"删除了 {log['table_name']}.{log['record_id']}")
```

#### 按时间范围筛选
```python
from datetime import datetime, timedelta

# 查询最近7天的日志
start_time = datetime.now() - timedelta(days=7)
logs = query_audit_logs(start_time=start_time)
print(f"最近7天共 {len(logs)} 条操作")

# 查询特定时间段
start_time = datetime(2024, 1, 1)
end_time = datetime(2024, 1, 31)
logs = query_audit_logs(start_time=start_time, end_time=end_time)
```

#### 组合筛选
```python
# 查询特定表在特定时间范围内的更新操作
logs = query_audit_logs(
    table_name='employees',
    operation_type='UPDATE',
    start_time=datetime.now() - timedelta(days=30),
    limit=50
)
```

---

### 3. 查询记录历史

```python
from audit import query_record_history

# 查询特定记录的完整变更历史
history = query_record_history('employees', 'emp-12345')

print(f"员工 emp-12345 的变更历史:")
for log in history:
    print(f"{log['operated_at']} - {log['operator_name']} {log['operation_type']}")
    if log['field_name']:
        print(f"  {log['field_name']}: {log['old_value']} → {log['new_value']}")
```

---

### 4. 获取统计信息

```python
from audit import get_audit_stats

# 获取最近7天的统计信息
stats = get_audit_stats(days=7)

print(f"最近7天共 {stats['total_logs']} 条日志")
print(f"按操作类型统计:")
for op_type, count in stats['by_operation'].items():
    print(f"  {op_type}: {count}")

print(f"按表统计:")
for table, count in stats['by_table'].items():
    print(f"  {table}: {count}")

print(f"最活跃的操作人:")
for operator in stats['top_operators']:
    print(f"  {operator['name']} ({operator['email']}): {operator['count']} 次操作")
```

---

## 🌐 API 使用指南

所有审计日志 API 端点都需要**管理员权限**。

### 1. 查询审计日志

**端点**: `GET /api/admin/audit-logs`

**Headers**:
```
Authorization: Bearer {admin_jwt_token}
```

**Query 参数**:
- `table_name` (可选): 表名筛选
- `record_id` (可选): 记录ID筛选
- `operation_type` (可选): 操作类型筛选 (INSERT/UPDATE/DELETE)
- `operator_id` (可选): 操作人ID筛选
- `start_time` (可选): 开始时间 (ISO 8601 格式)
- `end_time` (可选): 结束时间 (ISO 8601 格式)
- `limit` (可选): 返回数量限制，默认100，最大1000
- `offset` (可选): 偏移量（分页），默认0

**示例**:
```bash
# 查询所有日志
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs?limit=50"

# 按表名筛选
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs?table_name=employees"

# 按时间范围筛选
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs?start_time=2024-01-01T00:00:00&end_time=2024-01-31T23:59:59"

# 组合筛选
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs?table_name=employees&operation_type=UPDATE&limit=20"
```

**响应**:
```json
{
  "logs": [
    {
      "id": "uuid-here",
      "table_name": "employees",
      "record_id": "emp-12345",
      "operation_type": "UPDATE",
      "field_name": "status",
      "old_value": "在职",
      "new_value": "离职",
      "operator_id": "uuid-here",
      "operator_name": "管理员",
      "operator_email": "admin@bosch.com",
      "operated_at": "2024-01-15T10:30:00"
    }
  ],
  "count": 1,
  "filters": {
    "table_name": "employees",
    "operation_type": "UPDATE"
  },
  "pagination": {
    "limit": 100,
    "offset": 0
  }
}
```

---

### 2. 查询记录历史

**端点**: `GET /api/admin/audit-logs/record/{table_name}/{record_id}`

**Headers**:
```
Authorization: Bearer {admin_jwt_token}
```

**示例**:
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs/record/employees/emp-12345"
```

**响应**:
```json
{
  "table_name": "employees",
  "record_id": "emp-12345",
  "history": [
    {
      "id": "uuid-1",
      "operation_type": "UPDATE",
      "field_name": "status",
      "old_value": "在职",
      "new_value": "离职",
      "operator_name": "管理员",
      "operator_email": "admin@bosch.com",
      "operated_at": "2024-01-15T10:30:00"
    },
    {
      "id": "uuid-2",
      "operation_type": "INSERT",
      "new_value": "{...}",
      "operator_name": "HR专员",
      "operator_email": "hr@bosch.com",
      "operated_at": "2024-01-10T09:00:00"
    }
  ],
  "count": 2
}
```

---

### 3. 获取统计信息

**端点**: `GET /api/admin/audit-logs/stats`

**Headers**:
```
Authorization: Bearer {admin_jwt_token}
```

**Query 参数**:
- `days` (可选): 统计最近多少天，默认7，范围1-365

**示例**:
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs/stats?days=30"
```

**响应**:
```json
{
  "period_days": 30,
  "total_logs": 1523,
  "by_operation": {
    "INSERT": 456,
    "UPDATE": 987,
    "DELETE": 80
  },
  "by_table": {
    "employees": 890,
    "departments": 234,
    "tasks": 399
  },
  "top_operators": [
    {
      "name": "管理员",
      "email": "admin@bosch.com",
      "count": 567
    },
    {
      "name": "HR专员",
      "email": "hr@bosch.com",
      "count": 456
    }
  ]
}
```

---

### 4. 获取操作类型列表

**端点**: `GET /api/admin/audit-logs/operations`

**示例**:
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs/operations"
```

**响应**:
```json
{
  "operation_types": ["INSERT", "UPDATE", "DELETE"],
  "descriptions": {
    "INSERT": "新增记录",
    "UPDATE": "更新记录",
    "DELETE": "删除记录"
  }
}
```

---

### 5. 获取有审计记录的表列表

**端点**: `GET /api/admin/audit-logs/tables`

**示例**:
```bash
curl -H "Authorization: Bearer {token}" \
  "http://localhost:8000/api/admin/audit-logs/tables"
```

**响应**:
```json
{
  "tables": [
    "departments",
    "employees",
    "tasks",
    "skills"
  ],
  "count": 4
}
```

---

## 🔧 集成到 CRUD 操作

### 在 FastAPI 路由中集成

```python
from fastapi import APIRouter, Depends, HTTPException
from auth import verify_admin, get_current_user
from audit import log_audit
from database import db

router = APIRouter()

@router.post("/api/employees")
def create_employee(
    employee_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """创建员工（自动记录审计日志）"""
    
    # 1. 执行数据库插入
    with db.get_cursor() as cursor:
        cursor.execute("""
            INSERT INTO dbo.employees (name, email, department_id)
            OUTPUT INSERTED.id
            VALUES (?, ?, ?)
        """, (employee_data['name'], employee_data['email'], employee_data['department_id']))
        employee_id = cursor.fetchone()[0]
    
    # 2. 记录审计日志
    log_audit(
        table_name='employees',
        record_id=str(employee_id),
        operation_type='INSERT',
        operator_id=current_user['id'],
        operator_name=current_user['name'],
        operator_email=current_user['email'],
        new_value=str(employee_data)
    )
    
    return {'id': employee_id, 'message': '员工创建成功'}


@router.put("/api/employees/{employee_id}")
def update_employee(
    employee_id: str,
    update_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """更新员工（记录字段级审计日志）"""
    
    # 1. 查询旧值
    with db.get_cursor() as cursor:
        cursor.execute("""
            SELECT name, email, department_id
            FROM dbo.employees
            WHERE id = ?
        """, (employee_id,))
        old_data = cursor.fetchone()
        
        if not old_data:
            raise HTTPException(404, "员工不存在")
    
    # 2. 执行更新
    with db.get_cursor() as cursor:
        cursor.execute("""
            UPDATE dbo.employees
            SET name = ?, email = ?, department_id = ?
            WHERE id = ?
        """, (update_data['name'], update_data['email'], update_data['department_id'], employee_id))
    
    # 3. 记录字段级审计日志
    old_dict = {'name': old_data[0], 'email': old_data[1], 'department_id': old_data[2]}
    
    from audit import log_audit_batch
    logs = []
    
    for field, new_value in update_data.items():
        old_value = old_dict.get(field)
        if old_value != new_value:
            logs.append({
                'table_name': 'employees',
                'record_id': employee_id,
                'operation_type': 'UPDATE',
                'field_name': field,
                'old_value': str(old_value),
                'new_value': str(new_value),
                'operator_id': current_user['id'],
                'operator_name': current_user['name'],
                'operator_email': current_user['email']
            })
    
    if logs:
        log_audit_batch(logs)
    
    return {'message': f'员工更新成功，记录 {len(logs)} 条变更'}


@router.delete("/api/employees/{employee_id}")
def delete_employee(
    employee_id: str,
    current_user: dict = Depends(verify_admin)
):
    """删除员工（记录审计日志）"""
    
    # 1. 查询旧值
    with db.get_cursor() as cursor:
        cursor.execute("""
            SELECT name, email, department_id
            FROM dbo.employees
            WHERE id = ?
        """, (employee_id,))
        old_data = cursor.fetchone()
        
        if not old_data:
            raise HTTPException(404, "员工不存在")
    
    # 2. 执行软删除
    with db.get_cursor() as cursor:
        cursor.execute("""
            UPDATE dbo.employees
            SET deleted_at = GETDATE()
            WHERE id = ?
        """, (employee_id,))
    
    # 3. 记录审计日志
    log_audit(
        table_name='employees',
        record_id=employee_id,
        operation_type='DELETE',
        operator_id=current_user['id'],
        operator_name=current_user['name'],
        operator_email=current_user['email'],
        old_value=str({'name': old_data[0], 'email': old_data[1], 'department_id': old_data[2]})
    )
    
    return {'message': '员工删除成功'}
```

---

## 📋 最佳实践

### 1. 何时记录审计日志

✅ **应该记录**:
- 所有数据新增操作（INSERT）
- 所有数据修改操作（UPDATE）
- 所有数据删除操作（DELETE）
- 敏感数据访问（如查看工资、个人信息）
- 权限变更操作
- 系统配置修改

❌ **不需要记录**:
- 只读查询操作（SELECT）
- 临时数据操作（session、cache）
- 日志表本身的操作（避免循环）

### 2. 字段值记录建议

- **简单字段**: 直接记录字符串值
  ```python
  old_value='在职', new_value='离职'
  ```

- **复杂对象**: 使用 JSON 字符串
  ```python
  import json
  old_value=json.dumps({'name': '张三', 'email': 'zhangsan@bosch.com'}, ensure_ascii=False)
  ```

- **大字段**: 记录摘要而非全文
  ```python
  old_value=f"文档内容 (长度: {len(content)} 字符)"
  ```

### 3. 性能优化

- **批量操作使用 log_audit_batch()**:
  ```python
  # ✅ 推荐：批量记录
  log_audit_batch(logs)
  
  # ❌ 避免：循环单条记录
  for log in logs:
      log_audit(**log)
  ```

- **异步记录审计日志** (可选):
  ```python
  import asyncio
  
  async def log_audit_async(...):
      loop = asyncio.get_event_loop()
      await loop.run_in_executor(None, log_audit, ...)
  ```

- **定期归档旧日志**:
  ```sql
  -- 每月将3个月前的日志归档到历史表
  INSERT INTO dbo.data_audit_logs_archive
  SELECT * FROM dbo.data_audit_logs
  WHERE operated_at < DATEADD(month, -3, GETDATE())
  
  DELETE FROM dbo.data_audit_logs
  WHERE operated_at < DATEADD(month, -3, GETDATE())
  ```

### 4. 安全性建议

- **敏感数据脱敏**:
  ```python
  # 密码字段不记录明文
  old_value='[已隐藏]'
  new_value='[已隐藏]'
  
  # 邮箱部分隐藏
  email = 'zhangsan@bosch.com'
  masked_email = f"{email[:2]}***@bosch.com"
  ```

- **审计日志本身的保护**:
  - ✅ 仅管理员可查询审计日志
  - ✅ 审计日志不可修改或删除（只能归档）
  - ✅ 定期备份审计日志到离线存储

---

## 🐛 常见问题

### Q1: 审计日志会影响性能吗？

**A**: 影响很小。我们使用了4个索引优化查询性能，单次记录耗时 < 10ms。批量操作建议使用 `log_audit_batch()`。

### Q2: 审计日志会占用多少存储空间？

**A**: 每条日志约 500-1000 字节。假设每天1000次操作，一年约 365MB。建议定期归档旧日志。

### Q3: 如何查询某个记录的完整历史？

**A**: 使用 `query_record_history()` 函数或 API 端点:
```python
history = query_record_history('employees', 'emp-12345')
```

### Q4: 普通用户可以查看审计日志吗？

**A**: 不可以。所有审计日志 API 都需要管理员权限（`verify_admin` 中间件）。

### Q5: 如何删除或修改审计日志？

**A**: 审计日志是不可变的（immutable），不应该被修改或删除。如果需要清理，只能归档到历史表。

### Q6: 多字段更新如何记录？

**A**: 使用 `log_audit_batch()` 为每个字段记录一条日志:
```python
logs = [
    {'field_name': 'name', 'old_value': '张三', 'new_value': '李四', ...},
    {'field_name': 'email', 'old_value': 'zhangsan@bosch.com', 'new_value': 'lisi@bosch.com', ...}
]
log_audit_batch(logs)
```

---

## 📞 技术支持

如有问题，请联系：
- **技术支持**: dev-team@bosch.com
- **文档**: `AUDIT_LOG_TEST_REPORT.md`
- **API 文档**: http://localhost:8000/api/docs

---

**版本**: 1.0  
**最后更新**: 2024年  
**维护人**: 开发团队
