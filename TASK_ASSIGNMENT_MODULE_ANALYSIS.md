# 任务分配模块逻辑分析

> **模块覆盖范围**：智能匹配（Matching）、日程管理（Schedule）、审批工作流（Workflow）、通知系统（Notifications）

---

## 目录

1. [角色定义](#1-角色定义)
2. [任务状态机](#2-任务状态机)
3. [完整工作流](#3-完整工作流)
4. [Admin（Site PS）逻辑详解](#4-adminsite-ps逻辑详解)
5. [User（BPS 工程师）逻辑详解](#5-userbps-工程师逻辑详解)
6. [智能匹配算法](#6-智能匹配算法)
7. [通知系统](#7-通知系统)
8. [API 端点一览](#8-api-端点一览)
9. [关键文件索引](#9-关键文件索引)

---

## 1. 角色定义

| 角色 | 标识 | 权限范围 |
|------|------|----------|
| **Site PS（Admin）** | `role === 'admin'` | 全量读写任务、审批/拒绝、强制指派、删除 |
| **BPS 工程师（User）** | `role !== 'admin'` | 提交任务申请、确认/拒绝分配给自己的任务 |

角色由 JWT token 携带，后端每个工作流接口都会通过 `get_current_user` 依赖校验角色。

---

## 2. 任务状态机

```
                  ┌──────────────┐
                  │  (新任务创建)  │
                  └──────┬───────┘
                         │
          ┌──────────────┼────────────────────┐
          │ 普通申请       │                    │ Admin 强制指派
          ▼              │                    ▼
  ┌─────────────────┐    │           ┌──────────────┐
  │ pending_approval│    │           │   planned    │◄──────────────┐
  │   (待审批)      │    │           │  (已计划)     │               │
  └────────┬────────┘    │           └──────┬───────┘               │
           │             │                  │                        │
   ┌───────┴───────┐     │          ┌───────┴────────┐              │
   │               │     │          │                │              │
   ▼               ▼     │          ▼                ▼              │
┌──────────┐  ┌──────────┤   ┌────────────┐  ┌──────────────────┐  │
│ rejected │  │ planned  │◄──┤ confirmed  │  │employee_rejected │  │
│ (已拒绝) │  │(Admin批准)│   │(工程师确认)│  │  (工程师拒绝)    │  │
└──────────┘  └──────────┘   └────────────┘  └──────────────────┘  │
                  │                                                   │
           ┌──────┴──────────┐                                       │
           ▼                 ▼                                       │
    ┌────────────┐   ┌──────────────┐                                │
    │ in_progress│   │  cancelled   │                                │
    │  (进行中)  │   │   (已取消)   │                                │
    └─────┬──────┘   └──────────────┘                                │
          ▼                                                           │
    ┌──────────┐                                                      │
    │completed │                                                      │
    │ (已完成) │                                                      │
    └──────────┘                                                      │
                                                                      │
  注：Admin 可在 Schedule 页通过 TaskFormModal 直接修改任务状态 ──────┘
```

**状态总览：**

| 状态 | 中文 | 触发方 | 描述 |
|------|------|--------|------|
| `pending_approval` | 待审批 | 任何已登录用户 | 通过智能匹配提交申请后的初始状态 |
| `planned` | 已计划 | Admin（审批通过 or 强制指派）| 等待工程师确认 |
| `rejected` | 已拒绝 | Admin | Admin 审批拒绝，需填写原因 |
| `confirmed` | 已确认 | 工程师本人 | 工程师接受任务，流程完成 |
| `employee_rejected` | 工程师拒绝 | 工程师本人 | 工程师拒绝任务，需填写原因 |
| `in_progress` | 进行中 | Admin（手动更新）| 任务执行阶段 |
| `completed` | 已完成 | Admin（手动更新）| 任务结束 |
| `cancelled` | 已取消 | Admin（手动更新）| 任务撤销 |

---

## 3. 完整工作流

### 3.1 标准审批流（普通用户发起）

```
需求方(User/Admin)                    系统                         Admin(Site PS)              工程师
      │                                │                               │                          │
      │ 1. 填写任务需求                 │                               │                          │
      │ ─ 任务名/类型/地点/时间         │                               │                          │
      │ ─ 选择能力模块/技能要求         │                               │                          │
      │                                │                               │                          │
      │ 2. 点击"预览匹配"              │                               │                          │
      │──────────────────────────────►│ POST /api/matching/preview    │                          │
      │                                │ 计算候选人评分 Top5           │                          │
      │◄──────────────────────────────│ 返回候选人列表                │                          │
      │                                │                               │                          │
      │ 3. 选择候选人 → "提交申请"     │                               │                          │
      │──────────────────────────────►│ POST /api/matching/assign     │                          │
      │                                │ 创建 pending_approval 任务    │                          │
      │                                │──────────────────────────────►│ 通知: task_submitted     │
      │◄──────────────────────────────│ 返回 {status:'pending_approval'}│                         │
      │                                │                               │                          │
      │                                │                               │ 4. 在通知铃铛看到新申请   │
      │                                │                               │    打开 Schedule 页       │
      │                                │                               │                          │
      │                                │                               │ 5a. 审批通过              │
      │                                │◄──────────────────────────────│ POST /api/tasks/{id}/approve│
      │                                │ 更新 status → planned         │                          │
      │                                │──────────────────────────────────────────────────────►│
      │                                │                               │   通知: task_approved    │
      │                                │                               │                          │
      │                                │                               │                          │
      │                                │                               │ 5b. 审批拒绝              │
      │◄──────────────────────────────│◄──────────────────────────────│ POST /api/tasks/{id}/reject│
      │ 通知: task_rejected            │ 更新 status → rejected        │ (需填写拒绝原因)          │
      │                                │                               │                          │
      │                                │                               │             6. 工程师接受│
      │                                │◄──────────────────────────────────────────────────────│
      │◄──────────────────────────────│ 更新 status → confirmed       │          POST /api/tasks/{id}/confirm│
      │ 通知: task_confirmed           │──────────────────────────────►│ 通知: task_confirmed     │
      │                                │                               │                          │
      │                                │                               │             6. 工程师拒绝│
      │                                │◄──────────────────────────────────────────────────────│
      │◄──────────────────────────────│ 更新 status → employee_rejected│  POST /api/tasks/{id}/employee-reject│
      │ 通知: task_employee_rejected   │──────────────────────────────►│ 通知: task_employee_rejected│
```

### 3.2 Admin 强制指派流

```
Admin(Site PS)                         系统                          工程师
      │                                 │                               │
      │ 1. 进入智能匹配页               │                               │
      │    填写任务需求 → 预览匹配       │                               │
      │                                 │                               │
      │ 2. 选择候选人 → "强制指派"      │                               │
      │─────────────────────────────►  │ POST /api/matching/force-assign│
      │                                 │ 直接创建 planned 任务         │
      │                                 │ (跳过 pending_approval)      │
      │◄─────────────────────────────  │ 返回 {status:'planned'}       │
      │                                 │──────────────────────────────►│
      │                                 │          通知: task_approved  │
      │                                 │                               │
      │                                 │             3. 工程师在 Schedule 页确认/拒绝
```

### 3.3 Admin 直接创建任务流（Schedule 页 TaskFormModal）

```
Admin(Site PS)                          系统
      │                                  │
      │ 1. Schedule 页 → "新增任务"      │
      │    填写: 任务名/类型/地点/时间/  │
      │          工程师/备注             │
      │                                  │
      │ 2. 提交                          │
      │─────────────────────────────►   │ POST /api/tasks/
      │                                  │ 直接创建，status 由表单指定
      │◄─────────────────────────────   │ (默认 planned)
```

---

## 4. Admin（Site PS）逻辑详解

### 4.1 智能匹配页（Matching.tsx）

**两个 Tab：**

| Tab | 功能 |
|-----|------|
| 智能匹配（Smart Matching）| 填写需求 → 算法推荐候选人 → 提交申请 or 强制指派 |
| 任务看板（Task Board）| 查看所有通过智能匹配系统创建的历史任务 |

**操作对应的 API：**

| 操作 | API | 结果状态 |
|------|-----|---------|
| 预览匹配 | `POST /api/matching/preview` | 仅返回候选列表，不创建任务 |
| 提交申请 | `POST /api/matching/assign` | `pending_approval` |
| **强制指派**（Admin 专属）| `POST /api/matching/force-assign` | `planned`（跳过审批）|

**强制指派的权限守卫（后端）：**
```python
if current_user.get('role') != 'admin':
    raise HTTPException(status_code=403, detail="仅 Site PS (admin) 可使用强制指派")
```

**工作流状态卡片（前端实时显示）：**

```
任务申请 → 智能匹配 → 任务审批 → 日程同步
  ✅完成    ⏳进行中   🔵待启动   🔵待启动
```

- `submitMutation.isSuccess` → 审批卡片变为"进行中"（等待 admin 审批）
- `forceAssignMutation.isSuccess` → 审批卡片 + 日程卡片均变为"已完成"

### 4.2 日程管理页（Schedule.tsx）

**Admin 专属操作：**

| 操作 | 入口 | 说明 |
|------|------|------|
| 新增任务 | "新增任务"按钮 → `TaskFormModal` | 直接创建 `POST /api/tasks/`，状态自定义 |
| 编辑任务 | 点击任务卡片 → `TaskFormModal` | `PUT /api/tasks/{id}` |
| 删除任务 | 任务卡片操作 | `DELETE /api/tasks/{id}` |
| 导出 CSV | "导出"按钮 | 前端生成，覆盖已筛选任务 |
| 审批通过 | 通知 + 任务详情弹窗 | `POST /api/tasks/{id}/approve` |
| 审批拒绝 | 通知 + 任务详情弹窗 | `POST /api/tasks/{id}/reject`（需填原因）|
| 日历快速添加 | 点击日历空白格子 | 弹出预填充了员工和日期的 `TaskFormModal` |

**视图模式：**

| 视图 | 说明 |
|------|------|
| 团队视图（Team View）| 横轴为日期、纵轴为工程师的甘特式日历表，显示所有任务 |
| 个人视图（Personal View）| 展示每位工程师的饱和度、任务数、工时统计 |

**筛选能力：**
- 按月份（含上/下月切换、回到本月）
- 按工程师（多选）
- 按任务状态（全部/计划中/待审批/已确认/工程师拒绝/……共 9 种）

### 4.3 统计指标（仅 Admin 可见全局数据）

```
本月任务数 | 总工时 | 团队饱和度(%) | 参与人数
```

- **团队饱和度** = `总工时 / (参与人数 × 22工作日 × 8小时) × 100%`
- **个人饱和度** = `个人工时 / (22 × 8) × 100%`（上限 100%）

---

## 5. User（BPS 工程师）逻辑详解

### 5.1 提交任务申请

工程师可进入智能匹配页，执行与 Admin 相同的"预览匹配 → 提交申请"流程，但：

- **无法** 使用强制指派按钮（后端 403 守卫，前端按钮也不可见）
- 提交后任务进入 `pending_approval`，等待 Admin 审批

### 5.2 待确认任务处理（Schedule 页）

当 Admin 审批通过（或强制指派）后，工程师会：

1. 收到系统通知（`task_approved`）
2. 登录后在 Schedule 页顶部看到**黄色警告区**："您有 N 个待确认任务，请尽快处理"

该区域只对 **非 admin** 用户显示，条件：
```tsx
// myPlannedTasks：status==='planned' 且 assigned_employee_email === user.email
{!isAdmin && myPlannedTasks.length > 0 && (
  <div className="bg-amber-50 ...">...</div>
)}
```

**操作按钮：**

| 按钮 | API | 结果 |
|------|-----|------|
| ✅ 接受 | `POST /api/tasks/{id}/confirm` | `planned` → `confirmed` |
| ❌ 拒绝 | 弹出填写原因弹窗 → `POST /api/tasks/{id}/employee-reject` | `planned` → `employee_rejected` |

**拒绝原因为必填项**（前端和后端双重校验）：
```tsx
if (!empRejectReason.trim()) { alert('请填写拒绝原因'); return; }
```
```python
if not rejection_reason:
    raise HTTPException(status_code=400, detail="拒绝时必须填写原因")
```

### 5.3 权限验证（工程师只能操作自己的任务）

后端的 `confirm` 和 `employee-reject` 接口均验证当前用户是否为任务的被指派人：

```python
# 通过 employees.email 与 users.email 关联
cursor.execute("""
    SELECT e.id FROM dbo.employees e
    INNER JOIN dbo.users u ON u.email = e.email
    WHERE u.id = ?
""", current_user_id)

if task['assigned_employee_id'] != current_emp_id:
    raise HTTPException(status_code=403, detail="只能确认/拒绝分配给自己的任务")
```

---

## 6. 智能匹配算法

### 6.1 综合评分公式

$$\text{最终评分} = 0.5 \times \text{技能评分} + 0.5 \times \text{时间可用率}$$

### 6.2 技能评分（Skill Score）

$$S_i = \left(\min\left(\frac{C_i}{R_i}, 1.0\right) + \text{bonus}_i\right) \times w_i$$

| 参数 | 含义 |
|------|------|
| $C_i$ | 候选人当前技能等级（`current_level`，0–5）|
| $R_i$ | 任务要求等级（`required_level`，1–5）|
| $\text{bonus}_i$ | 若 `target_level > current_level`，则 +0.1（表示有成长意愿）|
| $w_i$ | 关键项（`is_key=true`）权重 = 2，普通项权重 = 1 |

$$\text{技能评分} = \frac{\sum S_i}{\sum w_i}$$

### 6.3 时间可用率（Time Score）

- **工作时段（slot）**：每个工作日算 2 个时段（AM + PM），周末不计
- **已占用时段**：查询 `dbo.tasks` 中与任务时间段重叠且状态不为 `cancelled/completed` 的任务

$$\text{时间评分} = \frac{\text{空闲时段}}{\text{总时段}}$$

若有 `time_slot` 字段：
- `FULL_DAY` = 2个时段
- `AM` 或 `PM` = 1个时段

### 6.4 合格标准

$$\text{qualified} = (\text{技能评分} \geq 0.7) \cap (\text{时间评分} \geq 0.5)$$

### 6.5 角色门槛（Role Gate）

仅对 `Lead` 和 `Expert` 角色生效：

| 角色 | 关键项均值要求 | 模块均值要求 | 不达标代码 |
|------|----------------|--------------|-----------|
| Lead | ≥ 4.0 | ≥ 3.5 | `LEAD_LOW` |
| Expert | ≥ 4.5 | ≥ 4.0 | `EXPERT_LOW` |
| Member / Coach | 无门槛 | 无门槛 | `OK` |

### 6.6 候选人排序规则

```python
def sort_key(c):
    if 'suggested' in c['badges']:   # 建议人选优先
        return (0, -c['finalScore'])
    if c['qualified']:                # 合格人选次之
        return (1, -c['finalScore'])
    return (2, -c['finalScore'])      # 其他按分数排序

# 最终返回 Top 5
```

### 6.7 候选人卡片展示（前端）

每张候选人卡片显示：
- 综合评分环（Final Score %）
- 技能匹配条（Skill Score）
- 时间可用性条（Time Score）
- 角色门槛状态（绿色 OK / 黄色 LEAD_LOW / 红色 EXPERT_LOW）
- `qualified` 徽章（合格人选）/ `suggested` 徽章（建议人选）
- 详细评分抽屉（点击展开每项技能得分明细）

---

## 7. 通知系统

### 7.1 通知类型与触发时机

| 通知类型 | 触发事件 | 发送对象 |
|----------|----------|----------|
| `task_submitted` | 提交任务申请（`/assign`）| 所有 Admin |
| `task_approved` | Admin 审批通过 or 强制指派 | 被指派工程师 |
| `task_rejected` | Admin 审批拒绝 | 申请人（`requester_id`）|
| `task_confirmed` | 工程师确认接受 | 申请人 + 所有 Admin |
| `task_employee_rejected` | 工程师拒绝任务 | 申请人 + 所有 Admin |

### 7.2 通知入口

```
顶部导航栏 → 🔔 铃铛图标（NotificationPanel.tsx）
  ├── 红色角标：未读数量（每30秒刷新一次）
  ├── 点击展开通知列表
  ├── 单条点击 → 标记已读（POST /api/notifications/{id}/read）
  └── 全部已读 → POST /api/notifications/read-all
```

### 7.3 通知数据结构

```typescript
interface Notification {
  id: string;
  user_id: string;
  type: 'task_submitted' | 'task_approved' | 'task_rejected'
       | 'task_confirmed' | 'task_employee_rejected';
  title: string;    // 简短标题（顶部显示）
  body: string;     // 详细内容
  task_id?: string; // 关联任务 ID
  is_read: boolean;
  created_at?: string;
}
```

---

## 8. API 端点一览

### 任务 CRUD（`/api/tasks`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/tasks/` | 已登录 | 获取任务列表（支持按员工/状态/日期筛选）|
| `GET` | `/api/tasks/{id}` | 已登录 | 获取单个任务详情 |
| `POST` | `/api/tasks/` | 已登录 | 创建任务（Schedule 页直接创建）|
| `PUT` | `/api/tasks/{id}` | 已登录 | 更新任务信息 |
| `DELETE` | `/api/tasks/{id}` | 已登录 | 删除任务 |

### 审批工作流（`/api/tasks/{id}/...`）

| 方法 | 路径 | 权限 | 状态转换 |
|------|------|------|---------|
| `POST` | `/api/tasks/{id}/approve` | **Admin only** | `pending_approval` → `planned` |
| `POST` | `/api/tasks/{id}/reject` | **Admin only** | `pending_approval` → `rejected` |
| `POST` | `/api/tasks/{id}/confirm` | 被指派工程师本人 | `planned` → `confirmed` |
| `POST` | `/api/tasks/{id}/employee-reject` | 被指派工程师本人 | `planned` → `employee_rejected` |

### 智能匹配（`/api/matching`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/matching/modules` | 已登录 | 获取能力模块列表 |
| `GET` | `/api/matching/skills` | 已登录 | 获取技能列表（可按模块筛选）|
| `POST` | `/api/matching/preview` | 已登录 | 预览匹配候选人（不创建任务）|
| `POST` | `/api/matching/assign` | 已登录 | 提交任务申请（`pending_approval`）|
| `POST` | `/api/matching/force-assign` | **Admin only** | 强制指派（`planned`）|
| `GET` | `/api/matching/history` | 已登录 | 获取智能匹配历史记录 |

### 通知（`/api/notifications`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/notifications/` | 已登录 | 获取通知列表 + 未读数 |
| `POST` | `/api/notifications/{id}/read` | 已登录 | 标记单条已读 |
| `POST` | `/api/notifications/read-all` | 已登录 | 标记全部已读 |

---

## 9. 关键文件索引

### 前端

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/pages/Matching.tsx` | 1027 | 智能匹配页面（表单、候选人列表、工作流状态、任务看板）|
| `src/pages/Schedule.tsx` | 1288 | 日程管理页面（日历视图、个人视图、待确认任务区域）|
| `src/services/task-workflow.service.ts` | 80 | 审批工作流 API 调用（assign / force-assign / approve / reject / confirm / employee-reject）|
| `src/services/tasks.service.ts` | 30 | 任务 CRUD API 调用 |
| `src/services/notifications.service.ts` | 40 | 通知 API 调用（getAll / markRead / markAllRead）|
| `src/components/NotificationPanel.tsx` | 175 | 通知铃铛 + 通知面板 UI 组件 |
| `src/types/api.ts` | 547 | 任务、通知、工作流相关的 TypeScript 类型定义 |
| `src/lib/matchingApi.ts` | — | 智能匹配预览、获取模块/技能/历史的 API 调用 |
| `src/lib/constants.ts` | — | TASK_TYPES / LOCATIONS / ROLES / ROLE_THRESHOLDS 常量 |

### 后端

| 文件 | 行数 | 职责 |
|------|------|------|
| `backend/routers/tasks.py` | 530 | 任务 CRUD + 完整审批工作流（approve / reject / confirm / employee-reject）|
| `backend/routers/matching.py` | 692 | 智能匹配算法 + assign / force-assign 端点 |
| `backend/routers/notifications.py` | — | 通知相关端点 + `create_notification` 工具函数 |
| `backend/models.py` | — | Task / TaskCreate / TaskUpdate Pydantic 模型 |
| `backend/routers/auth.py` | — | `get_current_user` JWT 解析依赖 |

### 数据库

| 表 | 用途 |
|----|------|
| `dbo.tasks` | 任务主表（含 `status`, `requester_id`, `rejection_reason`, `rejected_by`）|
| `dbo.notifications` | 通知记录 |
| `dbo.employees` | 员工信息（与 users 通过 email 关联）|
| `dbo.users` | 用户账户（含 role）|
| `dbo.competency_assessments` | 员工技能评估数据（匹配算法数据来源）|

---

## 附：状态流转颜色对照（前端 UI）

```tsx
const TASK_STATUS_CONFIG = {
  planned:           { label: '计划中',     color: 'bg-blue-100   text-blue-700   border-blue-300'   },
  in_progress:       { label: '进行中',     color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  completed:         { label: '已完成',     color: 'bg-green-100  text-green-700  border-green-300'  },
  cancelled:         { label: '已取消',     color: 'bg-red-100    text-red-700    border-red-300'    },
  pending_approval:  { label: '待审批',     color: 'bg-orange-100 text-orange-700 border-orange-300' },
  rejected:          { label: '已拒绝',     color: 'bg-red-100    text-red-600    border-red-200'    },
  confirmed:         { label: '已确认',     color: 'bg-teal-100   text-teal-700   border-teal-300'   },
  employee_rejected: { label: '工程师拒绝', color: 'bg-purple-100 text-purple-700 border-purple-300' },
};
```
