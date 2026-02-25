# BPS Backend API 测试指南

## 📋 测试准备

### 1. 启动后端服务器

```bash
cd backend
python main.py
```

服务器将在 `http://localhost:8000` 启动

### 2. 访问 API 文档

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## 🧪 测试流程

### 第一步：认证测试

#### 1. 请求 OTP

```bash
curl -X POST "http://localhost:8000/api/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

#### 2. 验证 OTP（使用收到的验证码）

```bash
curl -X POST "http://localhost:8000/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "otp": "123456"}'
```

响应将包含 access_token：
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user_id": "...",
  "email": "test@example.com"
}
```

#### 3. 获取当前用户信息

```bash
curl -X GET "http://localhost:8000/api/auth/me" \
  -H "Authorization: Bearer <your_token>"
```

### 第二步：基础数据测试

使用获得的 token 进行后续测试（将 `<TOKEN>` 替换为实际 token）

#### 1. 部门管理

**创建部门**
```bash
curl -X POST "http://localhost:8000/api/departments" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "IT部门",
    "code": "IT",
    "description": "信息技术部门"
  }'
```

**获取所有部门**
```bash
curl -X GET "http://localhost:8000/api/departments" \
  -H "Authorization: Bearer <TOKEN>"
```

**更新部门**
```bash
curl -X PUT "http://localhost:8000/api/departments/1" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "更新后的描述"
  }'
```

#### 2. 工厂管理

**创建工厂**
```bash
curl -X POST "http://localhost:8000/api/factories" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "FLCNa",
    "name": "南京工厂",
    "region": "华东",
    "is_active": true
  }'
```

**获取所有工厂**
```bash
curl -X GET "http://localhost:8000/api/factories" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 3. 任务类型

**创建任务类型**
```bash
curl -X POST "http://localhost:8000/api/task-types" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WS",
    "name": "Workshop",
    "color_hex": "#3B82F6",
    "description": "研讨会类型任务",
    "is_active": true
  }'
```

#### 4. 技能管理

**创建技能**
```bash
curl -X POST "http://localhost:8000/api/skills" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "module_id": 1,
    "module_name": "BPS基础",
    "skill_name": "精益生产",
    "skill_code": "BPS-001",
    "description": "精益生产基础知识",
    "display_order": 1,
    "is_active": true
  }'
```

#### 5. 员工管理

**创建员工**
```bash
curl -X POST "http://localhost:8000/api/employees" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "E001",
    "name": "张三",
    "email": "zhangsan@example.com",
    "department_id": 1,
    "hire_date": "2024-01-01T00:00:00Z",
    "is_active": true,
    "skills": [1, 2]
  }'
```

**获取所有员工**
```bash
curl -X GET "http://localhost:8000/api/employees" \
  -H "Authorization: Bearer <TOKEN>"
```

### 第三步：高级功能测试

#### 1. 能力定义

**创建能力定义**
```bash
curl -X POST "http://localhost:8000/api/competency-definitions" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "module_id": 1,
    "module_name": "BPS基础",
    "competency_type": "technical",
    "competency_code": "COMP-001",
    "competency_name": "问题解决",
    "level_1_description": "基础问题识别",
    "level_2_description": "系统问题分析",
    "level_3_description": "高级问题解决",
    "is_active": true
  }'
```

#### 2. 能力评估

**创建能力评估**
```bash
curl -X POST "http://localhost:8000/api/competency-assessments" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "uuid-of-employee",
    "skill_id": 1,
    "current_level": 2,
    "target_level": 3,
    "assessment_date": "2024-01-15T00:00:00Z",
    "assessor_notes": "表现良好，需要进一步培训"
  }'
```

**获取员工的所有评估**
```bash
curl -X GET "http://localhost:8000/api/competency-assessments/employee/{employee_id}" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 3. 任务管理

**创建任务**
```bash
curl -X POST "http://localhost:8000/api/tasks" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "新产品培训",
    "task_type": "training",
    "task_location": "FLCNa",
    "assigned_employee_id": "uuid-of-employee",
    "start_date": "2024-02-01T00:00:00Z",
    "end_date": "2024-02-05T00:00:00Z",
    "hours_per_day": 8,
    "total_hours": 40,
    "status": "active",
    "notes": "新产品线培训课程"
  }'
```

**查询任务（带筛选）**
```bash
curl -X GET "http://localhost:8000/api/tasks?status=active&start_date=2024-02-01" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 4. 资源规划

**创建资源任务类型**
```bash
curl -X POST "http://localhost:8000/api/resource-task-types" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "P",
    "name": "Project",
    "color_hex": "#10B981",
    "description": "项目工作",
    "is_active": true
  }'
```

**创建资源规划任务**
```bash
curl -X POST "http://localhost:8000/api/resource-planning-tasks" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "uuid-of-employee",
    "task_type_code": "P",
    "start_week": "CW23",
    "end_week": "CW25",
    "factory_code": "FLCNa",
    "hours": 120,
    "is_cross_factory": false,
    "notes": "Q2项目计划"
  }'
```

#### 5. 通知管理

**创建通知**
```bash
curl -X POST "http://localhost:8000/api/notifications" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "uuid-of-task",
    "affected_employee_id": "uuid-of-employee",
    "modified_by_employee_id": "uuid-of-modifier",
    "notification_type": "task_assigned",
    "change_description": "新任务已分配",
    "is_read": false
  }'
```

**获取未读通知**
```bash
curl -X GET "http://localhost:8000/api/notifications?is_read=false" \
  -H "Authorization: Bearer <TOKEN>"
```

**标记通知为已读**
```bash
curl -X PUT "http://localhost:8000/api/notifications/{notification_id}" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "is_read": true
  }'
```

### 第四步：视图查询测试

#### 1. 员工能力矩阵

```bash
curl -X GET "http://localhost:8000/api/views/employee-competency-matrix?department_id=1" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 2. 技能差距分析

```bash
curl -X GET "http://localhost:8000/api/views/skill-gap-analysis?min_gap=2" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 3. 员工工作负载

```bash
curl -X GET "http://localhost:8000/api/views/employee-workload?start_date=2024-01-01&end_date=2024-12-31" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 4. 资源规划概览

```bash
curl -X GET "http://localhost:8000/api/views/resource-planning-overview?year=2024" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 5. 部门技能分布

```bash
curl -X GET "http://localhost:8000/api/views/department-skill-distribution" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 6. 任务时间线

```bash
curl -X GET "http://localhost:8000/api/views/task-timeline?start_date=2024-01-01" \
  -H "Authorization: Bearer <TOKEN>"
```

## 🎯 使用 Swagger UI 测试

1. 访问 http://localhost:8000/api/docs
2. 点击右上角的 "Authorize" 按钮
3. 输入获得的 Bearer token
4. 点击 "Authorize" 确认
5. 现在可以直接在 UI 中测试所有端点

## ✅ 测试检查清单

### 基础功能
- [ ] 认证流程（OTP 请求和验证）
- [ ] 部门 CRUD
- [ ] 工厂 CRUD
- [ ] 任务类型 CRUD
- [ ] 技能 CRUD
- [ ] 员工 CRUD

### 高级功能
- [ ] 能力定义 CRUD
- [ ] 能力评估 CRUD
- [ ] 任务管理 CRUD
- [ ] 资源任务类型 CRUD
- [ ] 资源规划任务 CRUD
- [ ] 通知管理 CRUD

### 视图查询
- [ ] 员工能力矩阵
- [ ] 技能差距分析
- [ ] 员工工作负载
- [ ] 资源规划概览
- [ ] 部门技能分布
- [ ] 任务时间线

### 错误处理
- [ ] 无效的 token
- [ ] 不存在的资源 (404)
- [ ] 必填字段缺失 (422)
- [ ] 权限验证

## 📊 预期结果

所有端点应该：
- ✅ 返回正确的状态码（200, 201, 404, 422, 500）
- ✅ 返回符合 schema 的 JSON 数据
- ✅ 正确处理错误情况
- ✅ 需要认证的端点检查 token
- ✅ 日志输出清晰

## 🐛 常见问题

### 1. 401 Unauthorized
- 检查 token 是否有效
- 确认 Authorization header 格式正确

### 2. 500 Internal Server Error
- 检查数据库连接
- 查看服务器日志
- 确认 SQL 查询正确

### 3. 422 Unprocessable Entity
- 检查请求体字段类型
- 确认必填字段都已提供
- 验证数据格式（如 UUID、日期格式）

## 📝 测试报告

测试完成后，记录：
- 测试日期和时间
- 测试的端点数量
- 成功/失败的测试
- 发现的问题
- 性能指标（响应时间）

## 🚀 下一步

测试通过后：
1. 前端集成 - 替换 Supabase SDK 为新的 REST API 调用
2. 前端认证流程更新
3. E2E 测试
4. 性能优化
