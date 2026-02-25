# 管理员权限系统使用指南

## 快速开始

### 1. 管理员账户信息
```
邮箱: admin@bosch.com
密码: Admin1234
角色: admin
```

### 2. 启动服务
```powershell
# 后端服务
cd backend
python main.py
# 访问: http://localhost:8000

# 前端服务（如需要）
npm run dev
# 访问: http://localhost:5173
```

### 3. 测试权限系统
```powershell
# 方法1: 运行Python测试脚本
cd backend
python test_admin_permission.py

# 方法2: 运行单元测试
pytest tests/test_admin_auth.py -v

# 方法3: 使用Swagger UI
# 访问 http://localhost:8000/api/docs
# 点击 "Authorize" 按钮
# 输入格式: Bearer <your_jwt_token>
```

## 核心功能

### get_current_user() - 用户身份验证
**用途**: 从 JWT token 提取当前登录用户信息

**使用方式**:
```python
from fastapi import APIRouter, Depends
from auth import get_current_user
from typing import Dict

router = APIRouter()

@router.get("/api/profile")
def get_user_profile(current_user: Dict = Depends(get_current_user)):
    """
    获取当前用户资料
    任何登录用户都可以访问
    """
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"]
    }
```

**返回值**:
```python
{
    "user_id": "uuid-string",
    "email": "user@example.com",
    "name": "用户姓名",
    "role": "admin" | "user"
}
```

**错误处理**:
- **401 Unauthorized**: Token 无效、过期或缺失
- 错误信息: `{"detail": "Invalid token"}` 或 `{"detail": "Token 已过期"}`

### verify_admin() - 管理员权限验证
**用途**: 确保只有管理员角色可以访问特定端点

**使用方式**:
```python
from auth import verify_admin

@router.delete("/api/admin/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: Dict = Depends(verify_admin)
):
    """
    删除用户 - 仅管理员可操作
    """
    # verify_admin 已确保 current_user["role"] == "admin"
    return delete_user_from_db(user_id)
```

**工作流程**:
```
HTTP Request with JWT token
    ↓
HTTPBearer 提取 token
    ↓
get_current_user() 验证 token
    ↓
verify_admin() 检查 role
    ├─ ✅ role == "admin" → 执行路由函数
    └─ ❌ role != "admin" → 403 Forbidden
```

**错误处理**:
- **403 Forbidden**: 用户不是管理员
- 错误信息: `{"detail": "需要管理员权限"}`

### 组合使用
**场景1: 用户可以查看，但只有管理员可以修改**
```python
@router.get("/api/departments")
def list_departments(current_user: Dict = Depends(get_current_user)):
    """任何登录用户都可以查看部门列表"""
    return get_all_departments()

@router.post("/api/departments")
def create_department(
    data: DepartmentCreate,
    current_user: Dict = Depends(verify_admin)
):
    """仅管理员可以创建部门"""
    return create_department_in_db(data, current_user["user_id"])
```

**场景2: 用户可以修改自己的资料，管理员可以修改任何人的资料**
```python
@router.put("/api/users/{user_id}")
def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """用户修改资料"""
    # 检查权限：是本人或管理员
    if current_user["user_id"] != user_id and current_user["role"] != "admin":
        raise HTTPException(403, "只能修改自己的资料")
    
    return update_user_in_db(user_id, data)
```

## API 端点示例

### 测试端点
**GET /api/admin/test** (需要管理员权限)
```bash
# PowerShell
$token = "your_jwt_token_here"
$headers = @{"Authorization" = "Bearer $token"}
Invoke-RestMethod -Uri "http://localhost:8000/api/admin/test" -Headers $headers

# 成功响应 (200)
{
  "message": "✅ 管理员权限验证成功",
  "user_info": {
    "user_id": "...",
    "email": "admin@bosch.com",
    "name": "测试管理员",
    "role": "admin"
  },
  "access_level": "admin"
}

# 失败响应 (403)
{"detail": "需要管理员权限"}
```

**GET /api/admin/user-info** (任何登录用户)
```bash
Invoke-RestMethod -Uri "http://localhost:8000/api/admin/user-info" -Headers $headers

# 响应 (200)
{
  "message": "✅ 用户身份验证成功",
  "user_info": {
    "user_id": "...",
    "email": "...",
    "name": "...",
    "role": "..."
  }
}
```

## 常见问题

### Q1: 如何创建新的管理员账户？
```powershell
cd backend
python create_admin.py

# 或者通过 SQL 更新现有用户
UPDATE users SET role = 'admin' WHERE email = 'user@bosch.com';
```

### Q2: 如何在前端获取用户权限？
```typescript
// 登录后从 localStorage 获取 token
const token = localStorage.getItem('token');

// 解码 token（JWT payload 是 Base64 编码的）
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload.role); // "admin" or "user"

// 或者调用后端 API
const response = await fetch('http://localhost:8000/api/admin/user-info', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
console.log(data.user_info.role);
```

### Q3: 如何测试 403 权限拒绝？
```python
# 使用普通用户 token 访问管理员端点
normal_user_token = create_access_token({
    "user_id": "test-id",
    "email": "user@bosch.com",
    "name": "普通用户",
    "role": "user"
})

headers = {"Authorization": f"Bearer {normal_user_token}"}
response = requests.get("http://localhost:8000/api/admin/test", headers=headers)
assert response.status_code == 403
assert response.json() == {"detail": "需要管理员权限"}
```

### Q4: 如何在 Swagger UI 中测试？
1. 访问 http://localhost:8000/api/docs
2. 点击右上角 "Authorize" 按钮
3. 输入: `Bearer <your_token>`（注意 Bearer 后有空格）
4. 点击 "Authorize"，然后 "Close"
5. 现在可以测试需要认证的端点了

### Q5: Token 过期怎么办？
```python
# Token 默认有效期: 24小时（在 config.py 中配置）
# 过期后会返回 401 错误，需要重新登录

# 登录获取新 token
response = requests.post("http://localhost:8000/api/auth/login", json={
    "email": "admin@bosch.com",
    "password": "Admin1234"
})
new_token = response.json()["access_token"]
```

## 安全最佳实践

### ✅ 推荐做法
1. **永远不要在前端存储密码** - 只存储 JWT token
2. **使用 HTTPS** - 生产环境必须启用 SSL/TLS
3. **定期更换密码** - 管理员密码建议每90天更换
4. **限制管理员数量** - 遵循最小权限原则
5. **记录操作日志** - 所有管理员操作都应审计（Phase 2 将实现）

### ❌ 避免的做法
1. **不要在 URL 中传递 token** - 使用 Authorization header
2. **不要将 token 存储在 cookie** - 容易受到 CSRF 攻击
3. **不要禁用 CORS** - 保持 `allow_origins` 白名单
4. **不要暴露内部错误** - 生产环境设置 `debug=False`

## 下一步开发

### Phase 2: 审计日志系统
基于当前权限系统，实现完整的审计日志：
- 记录所有管理员操作
- 记录数据变更前后值
- 记录操作时间和操作人
- 支持按表、操作类型、时间范围查询

**示例审计记录**:
```json
{
  "table_name": "employees",
  "record_id": "uuid",
  "operation_type": "UPDATE",
  "field_name": "department_id",
  "old_value": "dept-001",
  "new_value": "dept-002",
  "operator_id": "admin-uuid",
  "operator_name": "测试管理员",
  "operated_at": "2026-02-13T10:30:00Z"
}
```

## 技术支持

### 文档索引
- 项目总览: `DATA_MANAGEMENT_ADMIN.md`
- 测试报告: `ADMIN_PERMISSION_TEST_REPORT.md`
- 数据库迁移: `backend/migrations/001_add_role_to_users.sql`
- 单元测试: `backend/tests/test_admin_auth.py`
- 集成测试: `backend/test_admin_permission.py`

### 快速命令
```powershell
# 查看所有用户及角色
python -c "from database import db; with db.get_cursor() as c: c.execute('SELECT email, name, role FROM users'); print(c.fetchall())"

# 创建管理员
python backend/create_admin.py

# 运行测试
cd backend
pytest tests/test_admin_auth.py -v

# 启动服务
python main.py
```

---
**文档版本**: 1.0  
**最后更新**: 2026-02-13  
**作者**: GitHub Copilot  
**项目**: BPS 数据管理后台系统
