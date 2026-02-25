# FastAPI 后端开发指南

## 📁 项目结构

```
backend/
├── main.py                 # FastAPI 主程序
├── config.py              # 配置管理
├── database.py            # 数据库连接
├── auth.py                # 认证模块
├── models.py              # Pydantic 数据模型
├── requirements.txt       # Python 依赖
├── .env.example          # 环境变量示例
├── start.ps1             # Windows 启动脚本
├── start.sh              # Linux/Mac 启动脚本
└── routers/              # 路由模块
    ├── __init__.py
    ├── auth.py           # 认证路由
    ├── departments.py    # 部门路由
    ├── factories.py      # 工厂路由（待实现）
    ├── task_types.py     # 任务类型路由（待实现）
    ├── skills.py         # 技能路由（待实现）
    ├── competency.py     # 能力评估路由（待实现）
    ├── employees.py      # 员工路由（待实现）
    ├── tasks.py          # 任务路由（待实现）
    ├── resource_planning.py  # 资源规划路由（待实现）
    ├── notifications.py  # 通知路由（待实现）
    └── views.py          # 视图查询路由（待实现）
```

## 🚀 快速开始

### 1. 安装依赖

```powershell
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```powershell
Copy-Item .env.example .env
```

编辑 `.env` 文件，配置数据库连接、JWT 密钥等。

### 3. 测试数据库连接

```powershell
python database.py
```

### 4. 测试认证模块

```powershell
python auth.py
```

### 5. 启动应用

**方式一：直接运行**
```powershell
python main.py
```

**方式二：使用脚本**
```powershell
.\start.ps1
```

**方式三：使用 uvicorn（开发模式）**
```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. 访问 API 文档

启动后访问：
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc
- 健康检查: http://localhost:8000/api/health

---

## 📚 API 接口说明

### 认证相关 (`/api/auth`)

| 方法 | 路径 | 说明 | 需要认证 |
|------|------|------|----------|
| POST | `/signup-otp` | 发送 OTP 到邮箱 | ❌ |
| POST | `/verify-otp` | 验证 OTP 并登录 | ❌ |
| GET | `/me` | 获取当前用户信息 | ✅ |
| POST | `/logout` | 登出 | ✅ |

### 部门管理 (`/api/departments`)

| 方法 | 路径 | 说明 | 需要认证 |
|------|------|------|----------|
| GET | `/` | 获取所有部门 | ❌ |
| GET | `/{id}` | 获取指定部门 | ❌ |
| POST | `/` | 创建新部门 | ✅ |
| PUT | `/{id}` | 更新部门信息 | ✅ |
| DELETE | `/{id}` | 删除部门 | ✅ |

### 其他模块（待实现）

- `/api/factories` - 工厂管理
- `/api/task-types` - 任务类型管理
- `/api/skills` - 技能管理
- `/api/competency` - 能力评估
- `/api/employees` - 员工管理
- `/api/tasks` - 任务管理
- `/api/resource-planning` - 资源规划
- `/api/notifications` - 通知管理
- `/api/views` - 视图查询

---

## 🔐 认证流程

### OTP 登录流程

1. **用户输入邮箱**
   - 前端调用 `POST /api/auth/signup-otp`
   - 后端生成 6 位 OTP 并发送邮件

2. **用户输入 OTP**
   - 前端调用 `POST /api/auth/verify-otp`
   - 后端验证 OTP，返回 JWT token

3. **使用 Token 访问受保护接口**
   - 前端在请求头中携带 `Authorization: Bearer <token>`
   - 后端验证 token，返回数据

### JWT Token 格式

```json
{
  "user_id": "uuid",
  "email": "user@bosch.com",
  "name": "User Name",
  "exp": 1640000000
}
```

---

## 🗄️ 数据库操作

### 使用依赖注入获取游标

```python
from database import get_db
from fastapi import Depends

@router.get("/example")
async def example_endpoint(cursor=Depends(get_db)):
    cursor.execute("SELECT * FROM table")
    rows = cursor.fetchall()
    return rows
```

### 事务处理

数据库连接默认启用事务，`get_db()` 会自动：
- 成功时：自动提交（commit）
- 失败时：自动回滚（rollback）

### 常用 SQL 模式

**查询单条记录**
```python
cursor.execute("SELECT * FROM table WHERE id = ?", id)
row = cursor.fetchone()
if not row:
    raise HTTPException(status_code=404, detail="记录不存在")
```

**查询多条记录**
```python
cursor.execute("SELECT * FROM table")
rows = cursor.fetchall()
```

**插入并获取 ID**
```python
cursor.execute("INSERT INTO table (col1, col2) VALUES (?, ?)", val1, val2)
cursor.execute("SELECT @@IDENTITY")
new_id = cursor.fetchone()[0]
```

**更新记录**
```python
cursor.execute("UPDATE table SET col1 = ? WHERE id = ?", val1, id)
cursor.execute("SELECT @@ROWCOUNT")
affected_rows = cursor.fetchone()[0]
```

---

## 📝 开发规范

### 路由文件结构

每个路由文件应包含：

```python
from fastapi import APIRouter, HTTPException, Depends
from models import ModelName, ModelCreate, ModelUpdate
from database import get_db
from routers.auth import get_current_user

router = APIRouter()

@router.get("/")  # 列表
async def get_list(cursor=Depends(get_db)):
    pass

@router.get("/{id}")  # 详情
async def get_detail(id: int, cursor=Depends(get_db)):
    pass

@router.post("/")  # 创建
async def create(data: ModelCreate, cursor=Depends(get_db), current_user=Depends(get_current_user)):
    pass

@router.put("/{id}")  # 更新
async def update(id: int, data: ModelUpdate, cursor=Depends(get_db), current_user=Depends(get_current_user)):
    pass

@router.delete("/{id}")  # 删除
async def delete(id: int, cursor=Depends(get_db), current_user=Depends(get_current_user)):
    pass
```

### 错误处理

```python
# 404 Not Found
if not record:
    raise HTTPException(status_code=404, detail="记录不存在")

# 400 Bad Request
if invalid_data:
    raise HTTPException(status_code=400, detail="数据无效")

# 403 Forbidden
if not has_permission:
    raise HTTPException(status_code=403, detail="权限不足")

# 500 Internal Server Error（自动处理）
```

### 日志记录

```python
import logging
logger = logging.getLogger(__name__)

logger.info("ℹ️ 信息日志")
logger.warning("⚠️ 警告日志")
logger.error("❌ 错误日志")
```

---

## 🧪 测试

### 测试单个模块

```powershell
# 测试数据库连接
python database.py

# 测试认证模块
python auth.py
```

### 使用 Postman/Insomnia

导入 API 文档：
1. 访问 http://localhost:8000/api/openapi.json
2. 下载 JSON 文件
3. 导入到 Postman/Insomnia

### 使用 curl

```bash
# 健康检查
curl http://localhost:8000/api/health

# 获取部门列表
curl http://localhost:8000/api/departments

# 发送 OTP
curl -X POST http://localhost:8000/api/auth/signup-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bosch.com"}'

# 验证 OTP
curl -X POST http://localhost:8000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@bosch.com","otp":"123456"}'
```

---

## 🔧 常见问题

### Q1: 数据库连接失败

**错误**: `pyodbc.InterfaceError: ('IM002', ...) Driver not found`

**解决**:
1. 检查是否安装 ODBC Driver 17 或 18
2. 修改 `config.py` 中的 `db_driver` 配置
3. 运行 `python database.py` 测试连接

### Q2: 导入模块失败

**错误**: `ModuleNotFoundError: No module named 'xxx'`

**解决**:
```powershell
pip install -r requirements.txt
```

### Q3: OTP 邮件发送失败

**原因**: 开发环境未配置 SMTP

**解决**: 
- 开发模式下，OTP 会打印在控制台日志中
- 生产环境需配置 `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`

### Q4: CORS 错误

**错误**: `Access-Control-Allow-Origin` header

**解决**:
1. 检查 `config.py` 中的 `allowed_origins`
2. 确保前端地址在允许列表中
3. 重启后端服务

---

## 📖 下一步

1. **完成所有 CRUD 路由**
   - 参考 `departments.py` 的实现
   - 为 11 个表创建完整的 CRUD 接口

2. **实现视图查询接口**
   - 5 个聚合视图的只读查询
   - 支持筛选和分页

3. **前端集成**
   - 修改 `src/lib/supabaseService.ts`
   - 使用 fetch/axios 调用 FastAPI 接口
   - 实现 JWT token 存储和自动刷新

4. **部署上线**
   - 使用 Docker 容器化
   - 配置 Nginx 反向代理
   - 设置 SSL 证书

---

**开发时间**: 2026-01-29  
**版本**: 1.0.0  
**维护**: BPS 开发团队
