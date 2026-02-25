# 任务匹配算法修复与优化报告

## 修复的问题

### 1. ✅ 能力要求下拉框为空的问题

**问题原因**：
- 后端 `/matching/skills` 接口返回字段名为 `skill_name`
- 前端期望字段名为 `name`
- 导致前端无法正确显示技能列表

**修复方案**：
修改 `backend/routers/matching.py` 第 215-226 行，将后端返回字段映射为前端期望的格式：

```python
skills.append({
    'id': row[0],
    'moduleId': row[1],      # 统一使用驼峰命名
    'moduleName': row[2],
    'name': row[3],          # ✅ 修复：映射为name字段
    'code': row[4] if row[4] else None,
    'isKeyDefault': False,   # 添加默认值
})
```

**验证方法**：
1. 打开任务匹配界面
2. 点击"能力要求"的"添加"按钮
3. 第一个下拉框应该显示技能列表（如"TPM基础"、"精益流程"等）
4. 第二个下拉框显示L1~L5

---

## 优化的匹配算法

### 2. ✅ 修复时间可用性计算SQL错误

**原问题**：
- SQL查询语法错误，导致时间可用性计算失败
- 时间段重叠判断逻辑不完整

**优化方案**：
修改第 335-349 行，修复SQL查询并增加状态过滤：

```python
cursor.execute("""
    SELECT COUNT(*) as task_count
    FROM dbo.tasks
    WHERE assigned_employee_id = ?
      AND (
          (start_date <= ? AND end_date >= ?)  -- 任务开始在时间段内
          OR
          (start_date >= ? AND end_date <= ?)  -- 任务完全在时间段内
          OR
          (start_date <= ? AND end_date >= ?)  -- 任务结束在时间段内
      )
      AND status NOT IN ('cancelled', 'completed')  -- ✅ 排除已取消/完成任务
""", ...)
```

### 3. ✅ 精确计算占用时段

**原逻辑**：简单假设每个任务占用2个时段
**新逻辑**：根据 `time_slot` 字段精确计算

```python
SELECT COALESCE(SUM(
    CASE 
        WHEN time_slot = 'FULL_DAY' THEN 2  -- 全天=2时段
        WHEN time_slot = 'AM' THEN 1        -- 上午=1时段
        WHEN time_slot = 'PM' THEN 1        -- 下午=1时段
        ELSE 2                              -- 默认全天
    END
), 0) as occupied_slots
FROM dbo.tasks
...
```

**优势**：
- 准确反映员工实际工作负荷
- 避免高估或低估时间冲突

### 4. ✅ 动态权重优化

**原逻辑**：固定 50% 技能分 + 50% 时间分
**新逻辑**：根据任务角色动态调整权重

```python
if role in ['Lead', 'Expert']:
    # 高级角色更看重技能匹配
    skill_weight = 0.7  # 70%
    time_weight = 0.3   # 30%
else:
    # 普通角色技能和时间平衡
    skill_weight = 0.6  # 60%
    time_weight = 0.4   # 40%
```

**设计理念**：
- **Lead/Expert**：核心技术角色，技能匹配最重要
- **Member/Coach**：执行角色，时间可用性更重要

### 5. ✅ 加分与惩罚机制

#### 加分项
```python
# 完全可用的员工（时间分>=90%）
if time_score >= 0.9:
    base_score += 0.1  # 额外加10%
```

#### 惩罚项
```python
# 时间严重不足（时间分<30%）
if time_score < 0.3:
    base_score *= 0.8  # 总分打8折
```

**效果**：
- 优先推荐完全空闲的员工
- 避免分配给日程过满的员工

### 6. ✅ 优化合格标准

**原标准**：`final_score >= 1.0`（综合分及格）
**新标准**：
```python
qualified = (
    skill_result['skill_score'] >= 0.8  # 技能分≥80%
    AND 
    time_score >= 0.3                   # 时间分≥30%
)
```

**优势**：
- 避免"技能强但时间全满"或"时间空但技能不足"的候选人
- 两个维度都必须达标

### 7. ✅ 增强匹配解释

新增 `generate_match_reason()` 函数，自动生成人类可读的匹配原因：

**示例输出**：
```
✅ 技能完全匹配 | ✅ 时间完全可用 | ✅ 通过角色门槛 | 🎯 推荐指派
⚠️ 技能略有不足 | ⚠️ 时间较紧张 | ✅ 通过角色门槛 | ⚠️ 谨慎考虑
❌ 技能不满足要求 | ❌ 时间严重冲突 | ⚠️ 角色门槛不足 | ⚠️ 谨慎考虑
```

**包含信息**：
- ✅ 技能评估（完全匹配/基本满足/略有不足/不满足）
- ✅ 时间可用性（完全可用/基本可用/较紧张/严重冲突）
- ✅ 角色门槛（通过/不足）
- ✅ 最终建议（推荐指派/谨慎考虑）

### 8. ✅ 详细的explain字段

前端可以获取更详细的匹配计算过程：

```json
{
  "explain": {
    "items": [...],  // 每个技能的详细计算
    "sumW": 10,
    "skillScore": 0.85,
    "time": {
      "totalSlots": 20,       // 总时段数
      "occupiedSlots": 8,     // 已占用
      "freeSlots": 12,        // 空闲
      "timeScore": 0.6,       // 时间分数
      "availability": "60%"   // 可用率
    },
    "weights": {
      "skill": 0.7,  // 技能权重
      "time": 0.3    // 时间权重
    },
    "bonuses": {
      "fullAvailable": false,  // 是否完全可用加分
      "penalty": false         // 是否时间不足惩罚
    },
    "reason": "✅ 技能基本满足 | ✅ 时间基本可用 | ✅ 通过角色门槛 | 🎯 推荐指派"
  }
}
```

---

## 算法流程图

```
1. 获取任务需求
   ├─ 角色: Lead/Expert/Member/Coach
   ├─ 时间段: start_date ~ end_date
   └─ 能力要求: [{skill_id, required_level, is_key}, ...]

2. 遍历所有活跃员工
   │
   ├─ 2.1 查询员工能力评估 (competency_assessments)
   │   └─ current_level, target_level
   │
   ├─ 2.2 计算技能匹配分
   │   ├─ 单项得分 = (min(Ci/Ri, 1.0) + bonus) * weight
   │   │   ├─ Ci: 当前等级
   │   │   ├─ Ri: 要求等级
   │   │   ├─ bonus: 有提升空间 +0.1
   │   │   └─ weight: 关键项=2, 普通=1
   │   └─ 技能分 = sum(si) / sum(w)
   │
   ├─ 2.3 计算时间可用性
   │   ├─ 总时段 = 工作日数 * 2 (AM+PM)
   │   ├─ 已占用 = SUM(任务的time_slot时段数)
   │   ├─ 空闲 = 总时段 - 已占用
   │   └─ 时间分 = 空闲 / 总时段
   │
   ├─ 2.4 计算综合评分
   │   ├─ 基础分 = 技能分 * skill_weight + 时间分 * time_weight
   │   ├─ 加分项: 时间完全可用 +0.1
   │   ├─ 惩罚项: 时间严重不足 *0.8
   │   └─ 最终分 = min(基础分, 2.0)
   │
   ├─ 2.5 判断合格性
   │   └─ qualified = (技能分 >= 0.8) AND (时间分 >= 0.3)
   │
   └─ 2.6 角色门槛检查
       ├─ Lead: keyItem>=4.0, moduleMean>=3.5
       └─ Expert: keyItem>=3.5, moduleMean>=3.0

3. 排序候选人
   ├─ 第一优先: 建议人选
   ├─ 第二优先: 合格候选人（按分数降序）
   └─ 第三优先: 其他候选人（按分数降序）

4. 返回结果列表
```

---

## 测试建议

### 测试场景 1：正常匹配
- **任务**: Lead角色，需要TPM模块L4技能
- **期望**: 显示技能L4+的员工，且时间可用

### 测试场景 2：时间冲突
- **前置**: 为某员工分配满整月任务
- **期望**: 该员工时间分数接近0，排名靠后

### 测试场景 3：技能不足
- **任务**: 需要高级技能L5
- **期望**: 只有L1-L2的员工排名靠后且标记为不合格

### 测试场景 4：角色门槛
- **任务**: Lead角色，但候选人平均分<3.5
- **期望**: roleGate显示LEAD_LOW警告

---

## 性能优化建议

### 当前实现
- ✅ 按模块筛选技能（避免加载所有技能）
- ✅ 使用索引字段查询（employee_id, skill_id）
- ✅ 单次SQL查询获取时间占用

### 后续优化方向
1. **缓存热数据**：员工能力评估数据可缓存5分钟
2. **分页加载**：候选人超过100人时分页返回
3. **并发查询**：多个员工的数据查询可以并行
4. **索引优化**：
   - `tasks` 表添加 `(assigned_employee_id, start_date, end_date, status)` 复合索引
   - `competency_assessments` 表添加 `(employee_id, skill_id, assessment_date DESC)` 索引

---

## API 使用示例

### 请求
```http
POST /api/matching/preview
Content-Type: application/json

{
  "name": "L24 HC Optimization Project",
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
  "suggestedUserId": "uuid-123"
}
```

### 响应
```json
[
  {
    "userId": "uuid-123",
    "name": "张三",
    "dept": "工程部",
    "homeLocation": "N/A",
    "skillScore": 0.92,
    "timeScore": 0.75,
    "finalScore": 1.27,
    "qualified": true,
    "roleGate": "OK",
    "badges": ["suggested"],
    "explain": {
      "reason": "✅ 技能完全匹配 | ✅ 时间基本可用 | ✅ 通过角色门槛 | 🎯 推荐指派",
      ...
    }
  },
  ...
]
```

---

## 修改文件清单

| 文件 | 修改内容 | 行号 |
|------|---------|------|
| `backend/routers/matching.py` | 修复技能接口字段映射 | 215-226 |
| `backend/routers/matching.py` | 修复时间可用性SQL查询 | 335-349 |
| `backend/routers/matching.py` | 精确计算占用时段 | 351-372 |
| `backend/routers/matching.py` | 动态权重优化 | 379-399 |
| `backend/routers/matching.py` | 增强explain字段 | 407-434 |
| `backend/routers/matching.py` | 添加匹配原因生成函数 | 139-173 |

---

## 日期
2026-02-02
