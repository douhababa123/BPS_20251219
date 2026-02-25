# BPS Backend API 路由总览

## 📋 已实现的 API 端点

### 🔐 认证模块 (`/api/auth`)
- `POST /api/auth/request-otp` - 请求 OTP 验证码
- `POST /api/auth/verify-otp` - 验证 OTP 登录
- `GET /api/auth/me` - 获取当前用户信息

### 🏢 部门管理 (`/api/departments`)
- `GET /api/departments` - 获取所有部门
- `GET /api/departments/{id}` - 获取指定部门
- `POST /api/departments` - 创建部门
- `PUT /api/departments/{id}` - 更新部门
- `DELETE /api/departments/{id}` - 删除部门

### 🏭 工厂管理 (`/api/factories`)
- `GET /api/factories` - 获取所有工厂
- `GET /api/factories/{id}` - 获取指定工厂
- `POST /api/factories` - 创建工厂
- `PUT /api/factories/{id}` - 更新工厂
- `DELETE /api/factories/{id}` - 删除工厂

### 📝 任务类型管理 (`/api/task-types`)
- `GET /api/task-types` - 获取所有任务类型
- `GET /api/task-types/{id}` - 获取指定任务类型
- `POST /api/task-types` - 创建任务类型
- `PUT /api/task-types/{id}` - 更新任务类型
- `DELETE /api/task-types/{id}` - 删除任务类型

### 💡 技能管理 (`/api/skills`)
- `GET /api/skills` - 获取所有技能
- `GET /api/skills/{id}` - 获取指定技能
- `POST /api/skills` - 创建技能
- `PUT /api/skills/{id}` - 更新技能
- `DELETE /api/skills/{id}` - 删除技能

### 👥 员工管理 (`/api/employees`)
- `GET /api/employees` - 获取所有员工
- `GET /api/employees/{id}` - 获取指定员工
- `POST /api/employees` - 创建员工
- `PUT /api/employees/{id}` - 更新员工
- `DELETE /api/employees/{id}` - 删除员工

### 🎯 能力定义 (`/api/competency-definitions`)
- `GET /api/competency-definitions` - 获取所有能力定义
- `GET /api/competency-definitions/{id}` - 获取指定能力定义
- `POST /api/competency-definitions` - 创建能力定义
- `PUT /api/competency-definitions/{id}` - 更新能力定义
- `DELETE /api/competency-definitions/{id}` - 删除能力定义

### 📊 能力评估 (`/api/competency-assessments`)
- `GET /api/competency-assessments` - 获取所有能力评估
- `GET /api/competency-assessments/employee/{employee_id}` - 获取指定员工的评估
- `GET /api/competency-assessments/{id}` - 获取指定能力评估
- `POST /api/competency-assessments` - 创建能力评估
- `PUT /api/competency-assessments/{id}` - 更新能力评估
- `DELETE /api/competency-assessments/{id}` - 删除能力评估

### 📅 任务管理 (`/api/tasks`)
- `GET /api/tasks` - 获取任务列表（支持筛选：employee_id, status, start_date, end_date）
- `GET /api/tasks/{id}` - 获取指定任务
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/{id}` - 更新任务
- `DELETE /api/tasks/{id}` - 删除任务

### 🏷️ 资源任务类型 (`/api/resource-task-types`)
- `GET /api/resource-task-types` - 获取所有资源任务类型
- `GET /api/resource-task-types/{id}` - 获取指定资源任务类型
- `POST /api/resource-task-types` - 创建资源任务类型
- `PUT /api/resource-task-types/{id}` - 更新资源任务类型
- `DELETE /api/resource-task-types/{id}` - 删除资源任务类型

### 📆 资源规划任务 (`/api/resource-planning-tasks`)
- `GET /api/resource-planning-tasks` - 获取资源规划任务（支持筛选：employee_id, year, week_number）
- `GET /api/resource-planning-tasks/{id}` - 获取指定资源规划任务
- `POST /api/resource-planning-tasks` - 创建资源规划任务
- `PUT /api/resource-planning-tasks/{id}` - 更新资源规划任务
- `DELETE /api/resource-planning-tasks/{id}` - 删除资源规划任务

### 🔔 计划变更通知 (`/api/notifications`)
- `GET /api/notifications` - 获取通知列表（支持筛选：employee_id, is_read）
- `GET /api/notifications/{id}` - 获取指定通知
- `POST /api/notifications` - 创建通知
- `PUT /api/notifications/{id}` - 更新通知（标记已读）
- `DELETE /api/notifications/{id}` - 删除通知

### 📈 视图查询 (`/api/views`)
- `GET /api/views/employee-competency-matrix` - 员工能力矩阵
  - 参数：`department_id` (可选)
  
- `GET /api/views/skill-gap-analysis` - 技能差距分析
  - 参数：`department_id` (可选), `min_gap` (可选)
  
- `GET /api/views/employee-workload` - 员工工作负载
  - 参数：`start_date` (可选), `end_date` (可选), `employee_id` (可选)
  
- `GET /api/views/resource-planning-overview` - 资源规划概览
  - 参数：`year` (可选), `week_number` (可选), `department_id` (可选)
  
- `GET /api/views/department-skill-distribution` - 部门技能分布
  - 参数：`department_id` (可选)
  
- `GET /api/views/task-timeline` - 任务时间线
  - 参数：`employee_id` (可选), `start_date` (可选), `end_date` (可选)

## 🔧 通用端点

- `GET /` - 根路径，返回 API 基本信息
- `GET /api/health` - 健康检查端点
- `GET /api/docs` - Swagger UI 文档
- `GET /api/redoc` - ReDoc 文档

## 📝 数据模型

所有 CRUD 端点都遵循以下模式：
- **Create**: 使用 `{Model}Create` schema
- **Update**: 使用 `{Model}Update` schema（所有字段可选）
- **Response**: 使用 `{Model}` schema（包含 ID 和时间戳）

## 🔒 认证

除了 `/api/auth/*` 端点外，所有端点都需要有效的 Bearer Token：
```
Authorization: Bearer <token>
```

## 📊 统计

- **总路由模块**: 13 个
- **CRUD 路由**: 12 个
- **视图查询**: 6 个
- **总 API 端点**: 80+ 个

## 🚀 启动服务器

```bash
cd backend
python main.py
```

服务器将在 http://localhost:8000 启动

访问 http://localhost:8000/api/docs 查看完整的 Swagger 文档
