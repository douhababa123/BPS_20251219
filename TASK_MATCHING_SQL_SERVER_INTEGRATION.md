# 🚀 任务分配模块 - SQL Server数据对接实现

## 📅 更新日期
2025-01-30

## ✅ 已完成的工作

### 1. 后端API实现 (Backend)

#### 新增文件
- **backend/routers/matching.py** - 任务匹配路由模块

#### 核心功能

##### 1.1 获取模块列表
```python
GET /api/matching/modules
```
- 从 `skills` 表获取所有distinct的模块
- 返回模块ID和名称

##### 1.2 获取技能列表
```python
GET /api/matching/skills?module_id=1
```
- 支持按模块ID筛选
- 返回技能详情（ID、模块ID、技能名称等）

##### 1.3 预览任务匹配
```python
POST /api/matching/preview
```

**请求体**:
```json
{
  "name": "任务名称",
  "role": "Lead",
  "moduleId": 1,
  "type": "WS",
  "location": "FDCCh",
  "topic": "TPM",
  "startDate": "2025-02-01",
  "endDate": "2025-02-07",
  "required": [
    {"skill_id": 10, "required_level": 4, "is_key": true},
    {"skill_id": 11, "required_level": 3, "is_key": false}
  ],
  "suggestedUserId": "uuid-string"
}
```

**核心算法**:
- ✅ 从 `employees` 表获取所有活跃员工
- ✅ 从 `competency_assessments` 表获取员工能力评估
- ✅ 从 `tasks` 表查询时间占用情况
- ✅ 计算技能评分（含关键项加权）
- ✅ 计算时间可用性评分
- ✅ 计算综合评分（0.5×技能 + 0.5×时间）
- ✅ 角色门槛检查（Lead/Expert）
- ✅ 候选人排序（建议人选 > 合格人选 > 按分数）

**返回数据**:
```json
[
  {
    "userId": "uuid",
    "name": "张三",
    "dept": "工程部",
    "homeLocation": "FDCCh",
    "skillScore": 1.05,
    "timeScore": 0.80,
    "finalScore": 0.93,
    "qualified": false,
    "roleGate": "OK",
    "badges": ["suggested"],
    "explain": {
      "items": [...],
      "sumW": 5,
      "skillScore": 1.05,
      "time": {
        "workSlots": 4,
        "freeSlots": 6,
        "timeScore": 0.80
      }
    }
  }
]
```

##### 1.4 确认任务分配
```python
POST /api/matching/assign
```

**功能**:
- ✅ 在 `tasks` 表创建新任务记录
- ✅ 状态设为 `pending`（待审批）
- ✅ 来源标记为 `matching`（匹配系统）
- 🔜 待实现：创建审批记录
- 🔜 待实现：发送通知

##### 1.5 获取匹配历史
```python
GET /api/matching/history?limit=20
```
- 从 `tasks` 表查询 `source='matching'` 的记录
- 返回匹配系统创建的所有任务

---

### 2. 前端实现 (Frontend)

#### 新增文件
- **src/lib/matchingApi.ts** - 任务匹配API服务

#### 修改文件
- **src/pages/Matching.tsx** - 任务匹配主页面

#### 核心修改

##### 2.1 API服务封装
```typescript
export const matchingApi = {
  getModules(): Promise<Module[]>
  getSkills(moduleId?: number): Promise<Skill[]>
  previewMatching(request: MatchingRequest): Promise<MatchingCandidate[]>
  assignTask(assignment: AssignmentRequest)
  getMatchingHistory(limit: number)
}
```

##### 2.2 页面集成
- ✅ 替换 `mockApi` 为 `matchingApi`
- ✅ 模块列表从SQL Server加载
- ✅ 技能列表从SQL Server加载
- ✅ 用户列表从 `/api/employees` 加载
- ✅ 匹配预览调用真实API
- ✅ 任务分配调用真实API，传递完整任务信息

---

## 📊 数据流程图

```
┌─────────────┐
│  用户填写   │
│  任务信息   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  POST /api/matching/    │
│  preview                │
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────┐
│  从SQL Server查询:       │
│  1. employees表          │
│  2. competency_          │
│     assessments表        │
│  3. tasks表（时间占用）  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  算法计算:              │
│  - 技能匹配评分         │
│  - 时间可用性评分       │
│  - 综合评分             │
│  - 角色门槛检查         │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  返回排序后的候选人列表  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  用户选择候选人          │
│  点击"立即指派"          │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  POST /api/matching/     │
│  assign                  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  写入tasks表             │
│  状态: pending           │
│  来源: matching          │
└──────────────────────────┘
```

---

## 🗄️ 涉及的数据库表

### 1. employees (员工表)
- 用途：获取所有候选人基本信息
- 字段：id, employee_name, department_id, factory_id, is_active

### 2. competency_assessments (能力评估表)
- 用途：获取员工的能力评估数据
- 字段：employee_id, skill_id, current_level, target_level

### 3. skills (技能表)
- 用途：获取模块和技能定义
- 字段：id, module_id, module_name, skill_name, skill_code

### 4. tasks (任务表)
- 用途：
  - 查询员工时间占用情况
  - 创建新的任务分配记录
- 字段：id, task_name, task_type, task_location, assigned_employee_id, start_date, end_date, status, source

### 5. departments (部门表)
- 用途：显示员工所属部门
- 关联：employees.department_id → departments.id

### 6. factories (工厂表)
- 用途：显示员工所在工厂
- 关联：employees.factory_id → factories.id

---

## 🧮 核心算法实现

### 1. 技能评分计算
```python
def calculate_skill_score(candidate_assessments, required_items):
    for req in required_items:
        Ci = 候选人当前能力等级
        Ri = 要求能力等级
        Ti = 候选人目标能力等级
        
        base = min(Ci / Ri, 1.0)
        bonus = 0.1 if Ti > Ci else 0
        w = 2 if is_key else 1
        si = (base + bonus) * w
    
    skill_score = sum(si) / sum(w)
    return skill_score
```

### 2. 时间评分计算
```python
def count_work_slots(start_date, end_date):
    count = 0
    for day in date_range:
        if day.weekday() < 5:  # 周一到周五
            count += 2  # AM + PM
    return count

total_slots = count_work_slots(start, end)
occupied_slots = query_from_tasks_table()
free_slots = total_slots - occupied_slots
time_score = free_slots / total_slots
```

### 3. 综合评分
```python
final_score = skill_score * 0.5 + time_score * 0.5
qualified = final_score >= 1.0
```

### 4. 角色门槛检查
```python
if role in ['Lead', 'Expert']:
    key_item_mean = average(关键项能力)
    module_mean = average(所有模块项能力)
    
    if key_item_mean >= threshold.keyItem and module_mean >= threshold.moduleMean:
        return 'OK'
    else:
        return 'LEAD_LOW' or 'EXPERT_LOW'
```

---

## ✨ 功能特点

### 已实现
- ✅ 从SQL Server真实数据库读取员工、能力、任务数据
- ✅ 智能匹配算法（技能+时间综合评分）
- ✅ 关键项加权计算
- ✅ 目标能力奖励机制
- ✅ 角色门槛自动检查
- ✅ 建议人选优先排序
- ✅ 合格/不合格人选区分
- ✅ 详细的评分解释（Explain功能）
- ✅ 任务分配记录到数据库

### 待优化
- 🔜 时间占用计算优化（当前简化为每任务2时段）
- 🔜 审批流程集成
- 🔜 邮件/站内信通知
- 🔜 匹配历史记录完善
- 🔜 权重配置管理（可调整技能/时间权重）
- 🔜 批量任务匹配
- 🔜 团队匹配（多人协作任务）

---

## 🚀 如何测试

### 1. 启动后端
```bash
cd backend
c:/Users/DOC2CHZ/Software/BPS_20251219/.venv/Scripts/python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 启动前端
```bash
npm run dev
```

### 3. 测试步骤
1. 打开浏览器访问 `http://localhost:5173`
2. 登录系统
3. 进入"任务分配"页面
4. 填写任务信息：
   - 任务名称：TPM Audit
   - 角色：Lead
   - 模块：选择一个模块
   - 添加能力要求（至少1个）
   - 设置日期范围
5. 点击"预览匹配"
6. 查看候选人列表（按综合评分排序）
7. 点击"查看详情"查看评分计算过程
8. 选择候选人，点击"立即指派"
9. 检查数据库 `tasks` 表，确认新记录已创建

### 4. 验证数据
```sql
-- 查看最新的匹配任务
SELECT TOP 10 *
FROM tasks
WHERE source = 'matching'
ORDER BY created_at DESC;

-- 查看员工能力评估
SELECT e.employee_name, s.skill_name, 
       ca.current_level, ca.target_level, ca.gap
FROM competency_assessments ca
JOIN employees e ON ca.employee_id = e.id
JOIN skills s ON ca.skill_id = s.id
WHERE e.employee_name = '员工名称';
```

---

## 📝 API端点清单

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | `/api/matching/modules` | 获取模块列表 | ❌ |
| GET | `/api/matching/skills` | 获取技能列表 | ❌ |
| POST | `/api/matching/preview` | 预览匹配结果 | ❌ |
| POST | `/api/matching/assign` | 确认任务分配 | ✅ |
| GET | `/api/matching/history` | 获取匹配历史 | ❌ |

---

## 🐛 已知问题

### 1. 时间占用计算简化
**问题**: 当前按每个任务占用2个时段计算，不够精确。  
**影响**: 时间评分可能不准确。  
**解决方案**: 需要改进为按任务的实际天数和时段计算。

**代码位置**: `backend/routers/matching.py` 第290-310行
```python
# TODO: 实现真实的日程查询逻辑
# 当前简化：每个任务假设占用2个时段
occupied_slots = occupied_tasks * 2
```

**改进方向**:
```python
# 计算每个任务实际占用的时段数
for task in overlapping_tasks:
    task_slots = count_work_slots(task.start_date, task.end_date)
    # 计算任务与查询日期范围的重叠部分
    overlap_slots = calculate_overlap(task_dates, query_dates)
    occupied_slots += overlap_slots
```

### 2. 审批流程未实现
**问题**: 点击"立即指派"后直接创建任务，没有审批环节。  
**影响**: 不符合实际业务流程（Site PS审批）。  
**解决方案**: 需要创建 `task_approvals` 表和审批工作流。

### 3. 通知功能缺失
**问题**: 分配任务后没有通知被分配人。  
**影响**: 用户无法及时知晓任务分配。  
**解决方案**: 集成邮件服务或站内信系统。

---

## 📚 相关文档

- [任务分配模块逻辑梳理](TASK_MATCHING_MODULE_ANALYSIS.md)
- [能力画像模块实现](COMPETENCY_IMPLEMENTATION_SUMMARY.md)
- [日程管理模块总结](FINAL_SCHEDULE_SUMMARY.md)
- [后端API路由说明](backend/API_ROUTES.md)

---

## 🎯 下一步计划

### 第一优先级（本周）
- [ ] 优化时间占用计算逻辑
- [ ] 添加错误处理和日志记录
- [ ] 单元测试和集成测试
- [ ] 性能优化（大量候选人时）

### 第二优先级（下周）
- [ ] 实现审批流程
- [ ] 添加邮件通知功能
- [ ] 匹配历史记录完善
- [ ] 权重配置管理界面

### 第三优先级（两周后）
- [ ] 批量任务匹配
- [ ] 团队匹配功能
- [ ] 匹配准确率分析报表
- [ ] 移动端适配

---

**更新人**: GitHub Copilot  
**状态**: ✅ 基础功能已实现，可用于测试  
**版本**: v1.0 - SQL Server集成版
