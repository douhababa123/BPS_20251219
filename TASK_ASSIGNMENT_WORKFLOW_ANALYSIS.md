# BPS 任务分配流程与权限分析

**文档版本**: 1.0  
**创建日期**: 2026-02-25  
**适用系统**: BPS 任务管理与智能匹配系统

---

## 📋 目录

1. [系统角色定义](#系统角色定义)
2. [任务状态流转](#任务状态流转)
3. [任务创建流程](#任务创建流程)
4. [任务审批流程](#任务审批流程)
5. [任务查询与显示](#任务查询与显示)
6. [权限矩阵](#权限矩阵)
7. [数据库设计](#数据库设计)
8. [前端组件架构](#前端组件架构)
9. [后端 API 端点](#后端-api-端点)
10. [关键技术决策](#关键技术决策)

---

## 系统角色定义

### 管理员（Admin）
- **识别条件**: `user.role === 'admin'` 或 `user.position === 'Site PS'`
- **权限特征**:
  - 可以查看所有用户提交的任务
  - 可以审批（批准/拒绝）待审批任务
  - 可以使用"强制指派"功能（绕过审批）
  - 在任务看板中可以执行管理操作
  - 在日程管理页面看到待审批任务横幅

### 普通用户（Regular User）
- **识别条件**: 非 admin 角色的所有用户
- **权限特征**:
  - 只能查看自己提交的任务
  - 可以通过智能匹配系统提交任务（需审批）
  - 不能审批任务
  - 不能强制指派任务
  - 不能看到其他用户提交的任务

---

## 任务状态流转

### 状态定义

| 状态 | 英文标识 | 含义 | 可见位置 |
|------|---------|------|---------|
| 待审批 | `pending_approval` | 用户提交，等待管理员审批 | 任务看板-待审批，日程管理-待审批横幅 |
| 已规划 | `planned` | 已审批通过或强制指派，等待员工确认 | 任务看板-已分配，日程管理-日历 |
| 已确认 | `confirmed` | 员工已确认接受任务 | 任务看板-已分配，日程管理-日历 |
| 进行中 | `in_progress` | 任务执行中 | 任务看板-已分配，日程管理-日历 |
| 已完成 | `completed` | 任务完成 | 任务看板-已分配，日程管理-日历 |
| 已拒绝 | `rejected` | 管理员拒绝 | 任务看板-已拒绝 |
| 员工拒绝 | `employee_rejected` | 员工拒绝接受 | 任务看板-已拒绝 |
| 已取消 | `cancelled` | 任务取消 | 任务看板-已拒绝 |

### 状态流转图

```
┌─────────────────┐
│  用户提交任务    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐         ┌──────────────┐
│ pending_approval├────────>│   rejected   │ (管理员拒绝)
│    (待审批)      │         │  (已拒绝)     │
└────────┬────────┘         └──────────────┘
         │ (管理员批准)
         ▼
┌─────────────────┐         ┌─────────────────┐
│     planned     ├────────>│employee_rejected│ (员工拒绝)
│    (已规划)      │         │  (员工已拒绝)     │
└────────┬────────┘         └─────────────────┘
         │ (员工确认)
         ▼
┌─────────────────┐
│   confirmed     │
│    (已确认)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  in_progress    │
│    (进行中)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   completed     │
│    (已完成)      │
└─────────────────┘

特殊路径（管理员强制指派）:
┌──────────────┐
│ 强制指派操作  │
└──────┬───────┘
       │ (跳过审批)
       ▼
┌─────────────────┐
│     planned     │
│    (已规划)      │
└─────────────────┘
```

---

## 任务创建流程

### 1. 智能匹配提交（需审批）

**触发位置**: `src/pages/Matching.tsx` - 匹配候选人列表的"确认提交"按钮

**前端流程**:
```typescript
// 1. 用户点击"确认提交"
const handleConfirm = (candidate) => {
  setConfirmingId(candidate.userId);
}

// 2. 确认对话框中点击"确认"
submitMutation.mutate({
  candidate: selectedCandidate,
  taskInfo: {
    name: taskName,
    type: taskType,
    location: taskLocation,
    startDate: startDate,
    endDate: endDate,
  }
});

// 3. submitMutation 调用 API
taskWorkflowService.assign({
  taskName: taskInfo.name,
  employeeId: candidate.userId,
  taskType: taskInfo.type,
  location: taskInfo.location,
  startDate: taskInfo.startDate,
  endDate: taskInfo.endDate,
  notes: `通过智能匹配系统分配 (综合评分: ${score}%)`
});
```

**后端处理**: `backend/routers/matching.py` - `/assign` 端点
```python
@router.post("/assign")
def assign_task(assignment: TaskAssignment, current_user: dict = Depends(get_current_user)):
    # 1. 获取当前用户 ID
    requester_id = current_user.get('user_id')
    
    # 2. 插入任务，状态为 pending_approval
    cursor.execute("""
        INSERT INTO dbo.tasks 
        (id, task_name, task_type, task_location, assigned_employee_id, 
         start_date, end_date, status, notes, requester_id, created_at)
        OUTPUT INSERTED.id
        VALUES (NEWID(), ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, GETDATE())
    """, ...)
    
    # 3. notes 字段追加标识
    final_notes = (assignment.notes + ' [来源:智能匹配系统]').strip()
    
    # 4. 返回任务 ID
    return {"taskId": task_id, "status": "pending_approval"}
```

**数据库记录**:
```sql
INSERT INTO dbo.tasks (
    id,                  -- UNIQUEIDENTIFIER (自动生成)
    task_name,           -- '测试任务'
    status,              -- 'pending_approval'
    notes,               -- '通过智能匹配系统分配 (综合评分: 85%) [来源:智能匹配系统]'
    requester_id,        -- 提交者的 user_id
    created_at           -- 当前时间
)
```

### 2. 强制指派（跳过审批，仅管理员）

**触发位置**: `src/pages/Matching.tsx` - 匹配候选人列表的"强制指派"按钮（仅管理员可见）

**前端判断**:
```typescript
const isAdmin = user?.role === 'admin';

// 按钮可见性
{isAdmin && (
  <button onClick={() => forceAssignMutation.mutate(...)}>
    强制指派
  </button>
)}
```

**后端处理**: `backend/routers/matching.py` - `/force-assign` 端点
```python
@router.post("/force-assign")
def force_assign_task(assignment: TaskAssignment, current_user: dict = Depends(get_current_user)):
    # 1. 验证管理员权限
    if current_user.get('role') != 'admin':
        raise HTTPException(403, "仅管理员可以使用强制指派")
    
    # 2. 插入任务，状态直接为 planned（跳过审批）
    cursor.execute("""
        INSERT INTO dbo.tasks (...) 
        VALUES (..., 'planned', ?, ...)
    """)
    
    # 3. notes 字段追加特殊标识
    final_notes = (assignment.notes + ' [来源:智能匹配系统/强制指派]').strip()
    
    return {"taskId": task_id, "status": "planned"}
```

**关键差异**:
| 特征 | 普通提交 | 强制指派 |
|------|---------|---------|
| 权限要求 | 所有用户 | 仅管理员 |
| 初始状态 | `pending_approval` | `planned` |
| notes 标识 | `[来源:智能匹配系统]` | `[来源:智能匹配系统/强制指派]` |
| 需要审批 | ✅ 是 | ❌ 否 |

---

## 任务审批流程

### 审批入口

**位置**: `src/pages/Schedule.tsx` - 日程管理页面顶部横幅

**显示条件**:
```typescript
const isAdmin = user?.role === 'admin';
const pendingApprovalTasks = tasks?.filter(t => t.status === 'pending_approval') || [];

// 仅管理员且有待审批任务时显示
{isAdmin && pendingApprovalTasks.length > 0 && (
  <div className="待审批横幅">
    <span>有 {pendingApprovalTasks.length} 个任务待审批</span>
    <button onClick={审批操作}>批准</button>
    <button onClick={拒绝操作}>拒绝</button>
  </div>
)}
```

### 审批操作

#### 1. 批准任务

**前端调用**:
```typescript
const approveMutation = useMutation({
  mutationFn: (taskId: string) => taskWorkflowService.approve(taskId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['matching-history'] });
  }
});
```

**后端处理**: `backend/routers/task_workflow.py` - `/approve/{task_id}` 端点
```python
@router.post("/approve/{task_id}")
def approve_task(task_id: str, current_user: dict = Depends(get_current_user)):
    # 1. 验证管理员权限
    if current_user.get('role') != 'admin':
        raise HTTPException(403, "仅管理员可以审批任务")
    
    # 2. 更新任务状态
    cursor.execute("""
        UPDATE dbo.tasks
        SET status = 'planned',
            updated_at = GETDATE()
        WHERE id = ?
    """, task_id)
    
    # 3. 可选：发送通知给提交者和被分配的员工
    
    return {"status": "approved", "new_status": "planned"}
```

**状态变更**: `pending_approval` → `planned`

#### 2. 拒绝任务

**前端调用**:
```typescript
const rejectMutation = useMutation({
  mutationFn: ({ taskId, reason }: { taskId: string; reason: string }) => 
    taskWorkflowService.reject(taskId, reason),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['matching-history'] });
  }
});

// 显示拒绝原因输入框
<Modal>
  <textarea value={rejectReason} onChange={...} />
  <button onClick={() => rejectMutation.mutate({ taskId, reason: rejectReason })}>
    确认拒绝
  </button>
</Modal>
```

**后端处理**: `backend/routers/task_workflow.py` - `/reject/{task_id}` 端点
```python
@router.post("/reject/{task_id}")
def reject_task(task_id: str, rejection: RejectRequest, current_user: dict = Depends(get_current_user)):
    # 1. 验证管理员权限
    if current_user.get('role') != 'admin':
        raise HTTPException(403, "仅管理员可以拒绝任务")
    
    # 2. 更新任务状态和拒绝原因
    cursor.execute("""
        UPDATE dbo.tasks
        SET status = 'rejected',
            rejection_reason = ?,
            updated_at = GETDATE()
        WHERE id = ?
    """, rejection.reason, task_id)
    
    return {"status": "rejected", "reason": rejection.reason}
```

**状态变更**: `pending_approval` → `rejected`

---

## 任务查询与显示

### 查询策略

#### 1. 日程管理页面 - 所有任务

**位置**: `src/pages/Schedule.tsx`

**查询逻辑**:
```typescript
const { data: tasks = [] } = useQuery({
  queryKey: ['tasks', startDate, endDate],
  queryFn: () => taskApi.getTasks(startDate, endDate),
});

// 管理员特殊处理：显示待审批横幅
const pendingApprovalTasks = isAdmin 
  ? tasks.filter(t => t.status === 'pending_approval')
  : [];
```

**后端端点**: `/api/tasks?start_date=X&end_date=Y`
- **管理员**: 返回所有任务（不过滤 requester_id）
- **普通用户**: 仅返回自己相关的任务（`WHERE requester_id = ? OR assigned_employee_id IN (当前用户管理的员工)`）

#### 2. 任务看板 - 智能匹配任务

**位置**: `src/pages/Matching.tsx` - TaskKanban 组件

**查询逻辑**:
```typescript
const { data: matchingHistory = [] } = useQuery({
  queryKey: ['matching-history'],
  queryFn: () => matchingApi.getMatchingHistory(50),
});
```

**后端端点**: `/api/matching/history?limit=50`

**关键查询条件** (已修复):
```sql
-- 管理员查询（看所有匹配系统任务）
SELECT TOP (?) ...
FROM dbo.tasks t
WHERE t.notes COLLATE Chinese_PRC_CI_AS LIKE N'%智能匹配系统%'
ORDER BY t.created_at DESC

-- 普通用户查询（只看自己提交的）
SELECT TOP (?) ...
FROM dbo.tasks t
WHERE t.notes COLLATE Chinese_PRC_CI_AS LIKE N'%智能匹配系统%'
  AND t.requester_id = ?  -- 当前用户 ID
ORDER BY t.created_at DESC
```

**⚠️ 关键技术点**:
- 使用 `COLLATE Chinese_PRC_CI_AS` 解决中文字符查询问题
- `notes` 字段数据库排序规则为 `Latin1_General_CI_AS`，直接 LIKE 查询中文会返回 0 结果
- 必须在查询时显式指定中文排序规则

### 任务看板分组映射

**前端分组逻辑**:
```typescript
const toKanbanStatus = (dbStatus: string): KanbanTab => {
  if (dbStatus === 'pending_approval') return 'pending';          // 待审批
  if (['planned', 'confirmed', 'in_progress', 'completed'].includes(dbStatus)) 
    return 'assigned';  // 已分配
  if (['rejected', 'employee_rejected', 'cancelled'].includes(dbStatus)) 
    return 'rejected';  // 已拒绝
  return 'matching';    // 匹配中（默认，不存在的兜底）
};
```

**看板标签页**:
| 标签 | 显示名称 | 包含状态 | 用户操作 | 管理员操作 |
|------|---------|---------|---------|-----------|
| matching | 匹配中 | (理论上不存在) | 查看 | 查看 |
| pending | 待审批 | `pending_approval` | 查看 | 批准/拒绝 |
| assigned | 已分配 | `planned`, `confirmed`, `in_progress`, `completed` | 查看 | 查看 |
| rejected | 已拒绝 | `rejected`, `employee_rejected`, `cancelled` | 查看 | 查看 |

---

## 权限矩阵

### 功能权限对比

| 功能 | 普通用户 | 管理员 | 实现位置 |
|------|---------|--------|---------|
| 查看智能匹配页面 | ✅ | ✅ | `Matching.tsx` |
| 使用智能匹配功能 | ✅ | ✅ | `Matching.tsx` - Preview |
| 提交任务（需审批） | ✅ | ✅ | `submitMutation` |
| 强制指派任务 | ❌ | ✅ | `forceAssignMutation` (按钮隐藏) |
| 查看自己提交的任务 | ✅ | ✅ | `/matching/history` (WHERE requester_id) |
| 查看所有用户任务 | ❌ | ✅ | `/matching/history` (无 requester_id 过滤) |
| 审批任务 | ❌ | ✅ | `Schedule.tsx` - 审批横幅 |
| 拒绝任务 | ❌ | ✅ | `taskWorkflowService.reject` |
| 在任务看板批准任务 | ❌ | ✅ | `TaskKanban` - pending 标签 |
| 在任务看板拒绝任务 | ❌ | ✅ | `TaskKanban` - pending 标签 |

### 数据可见性

| 数据范围 | 普通用户 | 管理员 |
|---------|---------|--------|
| 任务看板 - 自己提交的任务 | ✅ 可见 | ✅ 可见 |
| 任务看板 - 其他用户提交的任务 | ❌ 不可见 | ✅ 可见 |
| 日程管理 - pending_approval 任务 | ❌ 不显示横幅 | ✅ 显示审批横幅 |
| 日程管理 - 日历任务 | ✅ 自己相关 | ✅ 所有任务 |
| 任务详情 - 拒绝原因 | ✅ 可见 | ✅ 可见 |
| 任务详情 - 提交者姓名 | ✅ 可见 | ✅ 可见 |

---

## 数据库设计

### tasks 表关键字段

```sql
CREATE TABLE dbo.tasks (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    task_name NVARCHAR(200) NOT NULL,
    task_type NVARCHAR(100),
    task_location NVARCHAR(200),
    assigned_employee_id UNIQUEIDENTIFIER,
    start_date DATE,
    end_date DATE,
    status NVARCHAR(50) DEFAULT 'pending_approval',
    notes NVARCHAR(MAX) COLLATE Latin1_General_CI_AS,  -- ⚠️ 排序规则问题
    requester_id UNIQUEIDENTIFIER,  -- 提交者 ID
    rejection_reason NVARCHAR(500),  -- 拒绝原因
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2,
    
    FOREIGN KEY (assigned_employee_id) REFERENCES dbo.employees(id),
    FOREIGN KEY (requester_id) REFERENCES dbo.users(id)
);
```

### 关键字段说明

| 字段 | 类型 | 用途 | 示例值 |
|------|------|------|--------|
| `id` | UNIQUEIDENTIFIER | 任务唯一标识 | `DB759FF8-F99D-...` |
| `status` | NVARCHAR(50) | 任务状态 | `pending_approval`, `planned`, `rejected` |
| `notes` | NVARCHAR(MAX) | 备注说明，用于标识来源 | `通过智能匹配系统分配 (综合评分: 85%) [来源:智能匹配系统]` |
| `requester_id` | UNIQUEIDENTIFIER | 提交者用户 ID | `8348D1A1-29CB-...` |
| `rejection_reason` | NVARCHAR(500) | 管理员拒绝原因 | `技能不匹配` |

### 索引建议

```sql
-- 1. 按状态查询优化
CREATE INDEX idx_tasks_status ON dbo.tasks(status) 
INCLUDE (task_name, assigned_employee_id, requester_id);

-- 2. 按提交者查询优化
CREATE INDEX idx_tasks_requester ON dbo.tasks(requester_id) 
INCLUDE (status, created_at);

-- 3. 按创建时间排序优化
CREATE INDEX idx_tasks_created ON dbo.tasks(created_at DESC);

-- 4. 全文索引（可选，用于 notes 字段搜索）
CREATE FULLTEXT INDEX ON dbo.tasks(notes)
KEY INDEX PK_tasks;
```

---

## 前端组件架构

### 组件层级关系

```
App.tsx
└── Matching.tsx (智能匹配页面)
    ├── 匹配参数表单
    ├── 候选人列表
    │   ├── CandidateCard (候选人卡片)
    │   │   ├── 确认提交按钮 → submitMutation
    │   │   └── 强制指派按钮 (管理员) → forceAssignMutation
    │   └── 确认对话框 Modal
    └── TaskKanban (任务看板)
        ├── 标签页切换 (matching/pending/assigned/rejected)
        ├── 任务卡片列表
        │   ├── 任务详情展示
        │   └── 操作按钮区域
        │       ├── 批准按钮 (管理员，pending 标签)
        │       └── 拒绝按钮 (管理员，pending 标签)
        └── 拒绝原因输入 Modal

Schedule.tsx (日程管理页面)
├── 待审批横幅 (管理员，有 pending_approval 时)
│   ├── 批准按钮
│   └── 拒绝按钮
├── 日历视图
└── 拒绝原因输入 Modal
```

### 关键 React Query 查询

```typescript
// 1. 智能匹配历史（任务看板数据）
const { data: matchingHistory = [] } = useQuery({
  queryKey: ['matching-history'],
  queryFn: () => matchingApi.getMatchingHistory(50),
});

// 2. 日程管理任务列表
const { data: tasks = [] } = useQuery({
  queryKey: ['tasks', startDate, endDate],
  queryFn: () => taskApi.getTasks(startDate, endDate),
});

// 3. 提交任务后刷新
submitMutation.onSuccess = () => {
  queryClient.invalidateQueries({ queryKey: ['matching-history'] });
  setActiveTab('kanban');
};

// 4. 审批任务后刷新
approveMutation.onSuccess = () => {
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['matching-history'] });
};
```

---

## 后端 API 端点

### 任务匹配相关

| 端点 | 方法 | 权限 | 功能 | 返回状态 |
|------|------|------|------|---------|
| `/api/matching/preview` | POST | 所有用户 | 预览候选人列表 | N/A (不创建任务) |
| `/api/matching/assign` | POST | 所有用户 | 提交任务（需审批） | `pending_approval` |
| `/api/matching/force-assign` | POST | 仅管理员 | 强制指派任务 | `planned` |
| `/api/matching/history` | GET | 所有用户 | 获取匹配历史 | 根据角色过滤 |

### 任务工作流相关

| 端点 | 方法 | 权限 | 功能 | 状态变更 |
|------|------|------|------|---------|
| `/api/task-workflow/approve/{task_id}` | POST | 仅管理员 | 批准任务 | `pending_approval` → `planned` |
| `/api/task-workflow/reject/{task_id}` | POST | 仅管理员 | 拒绝任务 | `pending_approval` → `rejected` |

### 通用任务管理

| 端点 | 方法 | 权限 | 功能 | 数据范围 |
|------|------|------|------|---------|
| `/api/tasks` | GET | 所有用户 | 获取任务列表 | 管理员: 全部<br>用户: 自己相关 |
| `/api/tasks/{task_id}` | GET | 所有用户 | 获取任务详情 | 需权限检查 |

---

## 关键技术决策

### 1. 中文字符查询问题

**问题**: `notes` 字段使用 `Latin1_General_CI_AS` 排序规则，直接 LIKE 查询中文返回 0 结果

**解决方案**:
```sql
WHERE t.notes COLLATE Chinese_PRC_CI_AS LIKE N'%智能匹配系统%'
```

**影响范围**:
- `/api/matching/history` 端点
- 任务看板数据显示
- 管理员查看所有匹配任务

**替代方案**:
1. 修改表字段排序规则（需重建表，影响较大）
2. 添加专门的 `source` 字段标识来源（推荐长期方案）

### 2. requester_id 过滤策略

**设计原则**: 
- 普通用户只能看到自己提交的任务（隐私保护）
- 管理员需要看到所有任务（统一管理）

**实现方式**:
```python
if is_admin:
    # 管理员：无过滤
    cursor.execute("SELECT ... FROM tasks WHERE ...")
else:
    # 普通用户：按 requester_id 过滤
    cursor.execute("SELECT ... FROM tasks WHERE ... AND requester_id = ?", user_id)
```

**优点**:
- 数据隔离清晰
- 权限控制简单
- 性能开销小（有索引）

**缺点**:
- 无法实现"团队可见"功能（需扩展权限模型）
- 部门负责人无法查看下属提交的任务

### 3. 任务状态设计

**为什么使用字符串而不是枚举 ID？**

**优点**:
- 可读性强（数据库中直接看到 `pending_approval`）
- 前后端类型定义一致
- 调试方便

**缺点**:
- 占用存储空间略大
- 修改状态名称需要数据迁移

**建议**:
- 对于状态不多（< 20 个）的场景，使用字符串
- 对于复杂的状态机（> 20 个状态），考虑使用 ID + 状态表

### 4. notes 字段多用途

**当前用途**:
1. 存储任务备注说明
2. 标识任务来源（`[来源:智能匹配系统]`）
3. 区分强制指派（`[来源:智能匹配系统/强制指派]`）

**潜在问题**:
- 标识字符串硬编码（如果拼写错误会导致查询失败）
- 无法通过索引优化查询
- 多语言支持困难

**改进建议**:
```sql
ALTER TABLE dbo.tasks ADD source NVARCHAR(50);  -- 'manual', 'matching_system', 'force_assign'
ALTER TABLE dbo.tasks ADD source_details NVARCHAR(MAX);  -- JSON 格式存储详细信息

CREATE INDEX idx_tasks_source ON dbo.tasks(source);
```

修改后端查询:
```python
WHERE t.source = 'matching_system'
```

### 5. 缓存失效策略

**当前实现**: 手动 `invalidateQueries`

**影响的查询**:
1. `['matching-history']` - 任务看板数据
2. `['tasks', startDate, endDate]` - 日程管理任务
3. `['task', taskId]` - 单个任务详情

**刷新时机**:
- 提交任务后
- 审批任务后
- 拒绝任务后
- 修改任务后

**优化建议**:
- 使用 WebSocket 实时推送（避免轮询）
- 实现乐观更新（提升用户体验）
- 添加后台同步机制（离线支持）

---

## 流程示例

### 示例 1: 普通用户提交任务

```
时间线：
T0: 用户 Alice 登录系统
    - role: 'user'
    - user_id: 'UUID-ALICE-001'

T1: Alice 进入智能匹配页面
    - 输入任务需求（工程师技能、TPM/精益流程）
    - 点击"预览候选人"

T2: 系统显示候选人列表
    - 候选人 Bob (综合评分: 85%)
    - 候选人 Carol (综合评分: 72%)

T3: Alice 选择 Bob，点击"确认提交"
    - 弹出确认对话框
    - 显示任务详情和候选人信息

T4: Alice 点击对话框中的"确认"按钮
    → submitMutation.mutate()
    → POST /api/matching/assign
    → 数据库插入记录:
        {
          id: 'UUID-TASK-001',
          task_name: '测试任务',
          assigned_employee_id: 'UUID-BOB',
          status: 'pending_approval',
          notes: '通过智能匹配系统分配 (综合评分: 85%) [来源:智能匹配系统]',
          requester_id: 'UUID-ALICE-001'
        }
    → 返回: { taskId: 'UUID-TASK-001', status: 'pending_approval' }

T5: 前端收到成功响应
    - 刷新任务看板数据: invalidateQueries(['matching-history'])
    - 切换到"任务看板"标签: setActiveTab('kanban')

T6: 任务看板显示新任务
    - "待审批" 标签显示 1 个任务
    - 任务卡片显示详情（灰色边框，审批中状态）
    - Alice 只能查看，不能操作
```

### 示例 2: 管理员审批任务

```
时间线：
T0: 管理员 David 登录系统
    - role: 'admin'
    - position: 'Site PS'
    - user_id: 'UUID-DAVID-002'

T1: David 进入日程管理页面
    - 页面顶部显示待审批横幅
    - "有 1 个任务待审批"
    - 显示任务：测试任务 (提交者: Alice, 分配给: Bob)

T2: David 点击"批准"按钮
    → approveMutation.mutate('UUID-TASK-001')
    → POST /api/task-workflow/approve/UUID-TASK-001
    → 验证管理员权限
    → 数据库更新:
        UPDATE dbo.tasks
        SET status = 'planned', updated_at = GETDATE()
        WHERE id = 'UUID-TASK-001'
    → 返回: { status: 'approved', new_status: 'planned' }

T3: 前端收到成功响应
    - 刷新日程管理任务: invalidateQueries(['tasks'])
    - 刷新任务看板: invalidateQueries(['matching-history'])
    - 横幅消失（没有待审批任务了）

T4: 任务在日历中显示
    - 日期: 任务的 start_date - end_date
    - 状态: 已规划（绿色标签）
    - 分配给: Bob

T5: Alice 查看任务看板
    - "已分配" 标签显示 1 个任务
    - 任务状态从"待审批"变为"已规划"
    - 显示审批通过时间
```

### 示例 3: 管理员强制指派

```
时间线：
T0: 管理员 David 在智能匹配页面
    - 查看候选人列表
    - 发现所有候选人评分都低于阈值（< 60%）

T1: David 决定强制指派给 Carol (评分 45%)
    - 点击候选人卡片上的"强制指派"按钮
    - 弹出确认对话框，提示"将跳过审批流程"

T2: David 确认强制指派
    → forceAssignMutation.mutate()
    → POST /api/matching/force-assign
    → 验证管理员权限
    → 数据库插入记录:
        {
          id: 'UUID-TASK-002',
          status: 'planned',  // 直接跳过 pending_approval
          notes: '强制指派(智能匹配系统) (综合评分: 45%) [来源:智能匹配系统/强制指派]',
          requester_id: 'UUID-DAVID-002'
        }

T3: 任务直接出现在日历中
    - 状态: 已规划（不需要审批）
    - 在任务看板的"已分配"标签下显示
    - notes 字段标识为"强制指派"
```

---

## 待改进点

### 1. 权限模型扩展

**当前限制**: 只有 admin/非 admin 两种角色

**改进方向**:
- 部门负责人：查看本部门任务
- 项目经理：查看项目相关任务
- 团队 Leader：审批本团队任务

**实现建议**:
```sql
-- 添加角色表
CREATE TABLE dbo.roles (
    id UNIQUEIDENTIFIER PRIMARY KEY,
    name NVARCHAR(50),
    permissions NVARCHAR(MAX)  -- JSON 格式
);

-- 用户角色关联
CREATE TABLE dbo.user_roles (
    user_id UNIQUEIDENTIFIER,
    role_id UNIQUEIDENTIFIER,
    scope NVARCHAR(100),  -- 'global', 'department:XX', 'project:YY'
    PRIMARY KEY (user_id, role_id, scope)
);
```

### 2. 审批流多级支持

**当前限制**: 单级审批（管理员）

**改进方向**:
- 两级审批：部门负责人 → 站长
- 并行审批：多个审批人同时审批
- 审批链：上级 → 上上级 → ...

**实现建议**:
```sql
CREATE TABLE dbo.approval_workflows (
    id UNIQUEIDENTIFIER PRIMARY KEY,
    task_id UNIQUEIDENTIFIER,
    step INT,
    approver_id UNIQUEIDENTIFIER,
    status NVARCHAR(20),  -- 'pending', 'approved', 'rejected'
    approved_at DATETIME2
);
```

### 3. 通知机制

**当前缺失**: 无任何通知功能

**改进方向**:
- 邮件通知：任务提交、审批结果
- 站内通知：实时消息推送
- 移动推送：关键事件提醒

### 4. 审计日志

**当前缺失**: 无详细操作记录

**改进方向**:
- 记录所有状态变更
- 记录操作人和操作时间
- 支持历史回溯

**实现建议**:
```sql
CREATE TABLE dbo.task_audit_logs (
    id UNIQUEIDENTIFIER PRIMARY KEY,
    task_id UNIQUEIDENTIFIER,
    action NVARCHAR(50),  -- 'created', 'approved', 'rejected', 'updated'
    actor_id UNIQUEIDENTIFIER,
    old_status NVARCHAR(50),
    new_status NVARCHAR(50),
    details NVARCHAR(MAX),  -- JSON
    created_at DATETIME2 DEFAULT GETDATE()
);
```

### 5. 性能优化

**当前问题**:
- `notes` 字段 LIKE 查询效率低
- 无分页支持（/matching/history 返回所有记录）

**改进方向**:
- 添加 `source` 字段并建立索引
- 实现分页查询（Offset-Limit 或 Cursor-based）
- 添加缓存层（Redis）

---

## 总结

### 核心流程回顾

1. **任务创建**:
   - 普通提交 → `pending_approval` → 需审批
   - 强制指派 → `planned` → 跳过审批（仅管理员）

2. **任务审批**:
   - 管理员批准 → `pending_approval` → `planned`
   - 管理员拒绝 → `pending_approval` → `rejected`

3. **数据隔离**:
   - 管理员：查看所有任务
   - 普通用户：只看自己提交的任务（WHERE requester_id）

4. **关键修复**:
   - 中文查询问题：使用 `COLLATE Chinese_PRC_CI_AS`
   - 缓存失效：`invalidateQueries` 确保数据同步

### 系统优势

- ✅ 权限控制清晰（admin/非 admin）
- ✅ 审批流程规范（pending → approved/rejected）
- ✅ 数据隔离安全（requester_id 过滤）
- ✅ 操作可追溯（notes 字段记录来源）

### 当前限制

- ⚠️ 单级审批（无多级支持）
- ⚠️ 角色单一（仅 admin/user）
- ⚠️ 无通知机制
- ⚠️ 无审计日志
- ⚠️ notes 字段多用途（建议拆分）

---

**文档维护**: 请在系统架构变更时及时更新本文档

**反馈渠道**: 如有疑问或改进建议，请联系开发团队
