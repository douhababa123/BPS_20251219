# 智能任务匹配算法分析

> 源文件：`backend/routers/matching.py`  
> 前端入口：`src/pages/Matching.tsx` → `src/lib/matchingApi.ts`

---

## 一、算法整体流程

```
用户填写任务需求（角色、模块、能力要求、时间段）
          ↓
遍历所有 is_active=1 的员工
          ↓
  ┌───────────────────────────────────┐
  │  对每个员工计算：                   │
  │  1. 技能匹配分  skill_score        │
  │  2. 时间可用分  time_score         │
  │  3. 综合得分    final_score        │
  │  4. 角色门槛    role_gate          │
  └───────────────────────────────────┘
          ↓
按排序规则输出候选人列表（前端展示）
```

---

## 二、技能匹配分 `skill_score`

### 2.1 单项技能得分 `si`

对每个要求的技能项 `i`：

| 变量 | 含义 |
|------|------|
| `Ci` | 候选人当前技能等级（来自 `competency_assessments.current_level`，无评估记录则为 0） |
| `Ri` | 任务要求的技能等级 |
| `Ti` | 候选人目标技能等级 |
| `w`  | 权重（关键项 `is_key=True` → 2，普通项 → 1） |

$$
\text{base}_i = \min\left(\frac{C_i}{R_i},\ 1.0\right)
$$

$$
\text{bonus}_i = \begin{cases} 0.1 & \text{if } T_i > C_i \\ 0 & \text{otherwise} \end{cases}
$$

$$
s_i = (\text{base}_i + \text{bonus}_i) \times w_i
$$

> **bonus 的含义**：候选人目标高于现状，表示处于成长期，额外加 0.1 分奖励。

### 2.2 综合技能分

$$
\text{skill\_score} = \frac{\sum_i s_i}{\sum_i w_i}
$$

**理论范围**：`[0, 1.1]`（最高分需所有技能满足且有成长 bonus）

---

## 三、时间可用分 `time_score`

### 3.1 总时段数计算

```
total_slots = 工作日天数 × 2（AM + PM 各算 1 个时段，排除周末）
```

### 3.2 已占用时段数

查询 `dbo.tasks` 表中与当前任务时间段**有重叠**且状态不为 `cancelled/completed` 的任务：

$$
\text{overlap condition:} \quad \text{task.start\_date} \leq \text{qEnd} \quad \text{AND} \quad \text{task.end\_date} \geq \text{qStart}
$$

按 `time_slot` 字段统计占用时段：

| `time_slot` 值 | 占用时段数 |
|---------------|-----------|
| `FULL_DAY` | 2 |
| `AM` | 1 |
| `PM` | 1 |
| 其他/NULL | 2（按全天算） |

### 3.3 时间分

$$
\text{free\_slots} = \max(\text{total\_slots} - \text{occupied\_slots},\ 0)
$$

$$
\text{time\_score} = \min\left(\frac{\text{free\_slots}}{\text{total\_slots}},\ 1.0\right)
$$

**范围**：`[0, 1.0]`，完全空闲 = 1.0，完全占用 = 0

---

## 四、综合得分 `final_score`

$$
\text{final\_score} = 0.5 \times \text{skill\_score} + 0.5 \times \text{time\_score}
$$

**合格标准**：

$$
\text{qualified} = \text{final\_score} \geq 1.0
$$

---

## 五、角色门槛检查 `role_gate`

仅对 **Lead** 和 **Expert** 角色生效：

| 角色 | 关键项均分门槛 | 模块均分门槛 |
|------|--------------|------------|
| Lead | ≥ 4.0 | ≥ 3.5 |
| Expert（后端） | ≥ 3.5 | ≥ 3.0 |

- **关键项均分**：`is_key=True` 的技能项的 `current_level` 平均值
- **模块均分**：所有要求技能项的 `current_level` 平均值

两项均达到才返回 `'OK'`，否则返回 `'LEAD_LOW'` 或 `'EXPERT_LOW'`（**不影响最终评分，仅标签展示**）。

---

## 六、候选人排序规则

```
优先级 1：建议人选（suggestedUserId 指定）
优先级 2：qualified=True 的候选人（按 finalScore 降序）
优先级 3：其余候选人（按 finalScore 降序）
```

---

## 七、⚠️ 发现的问题

### 问题 1：`qualified` 门槛设置过严（高风险）

```python
qualified = final_score >= 1.0
```

`skill_score` 理论最大值约 1.1（需所有技能满足且有 bonus），`time_score` 最大值 1.0。

$$
\text{final\_score}_{\max} \approx 0.5 \times 1.1 + 0.5 \times 1.0 = 1.05
$$

**实际含义**：候选人必须**能力几乎全满足 + 时间几乎完全空闲**，才能被标记为"合适人选"。只要员工有任何在途任务，`time_score < 1.0`，若技能也不带 bonus，则 `final_score ≤ 1.0 × 0.5 + <1.0 × 0.5 < 1.0`，即**永远不会 qualified**。

**建议**：将阈值改为 `0.7` 或拆分为两个独立阈值：

```python
# 建议改为：
qualified = skill_score >= 0.7 and time_score >= 0.5
```

---

### 问题 2：Expert 角色门槛前后端不一致（中风险）

| 位置 | Expert keyItem | Expert moduleMean |
|------|---------------|------------------|
| 后端 `matching.py` | 3.5 | 3.0 |
| 前端 `constants.ts` | **4.5** | **4.0** |

前端 UI 展示的标准和后端实际计算的标准不同，会造成用户困惑。

**建议**：统一为一处配置，或将 `role_thresholds` 通过 API 下发给前端。

---

### 问题 3：`occupied_tasks` 变量计算后未使用（低风险/代码冗余）

```python
occupied_tasks = cursor.fetchone()[0]  # ← 计算了但从未用到
```

后续计算使用的是 `occupied_slots`（第二次查询结果）。`occupied_tasks` 应删除或用于日志记录。

---

### 问题 4：同一技能有多条评估记录时，取的是"日期最新一条"（潜在风险）

SQL 用 `ORDER BY assessment_date DESC` 排序后，Python 用 `next()` 取第一条，逻辑上正确（取最新评估），但若 `assessment_date` 为 NULL 或相同，结果不确定。

---

## 八、算法合理性总结

| 维度 | 评价 |
|------|------|
| **技能评分设计** | ✅ 合理：加权平均 + 关键项双倍权重 + 成长 bonus 体现进步潜力 |
| **时间可用性** | ✅ 合理：按实际时段（AM/PM）计算，比按天更精确 |
| **综合得分权重** | ✅ 合理：技能与时间各 50%，符合实际业务需求 |
| **合格门槛** | ❌ 过严：`>=1.0` 在大多数场景下几乎无人合格，应改为 `>=0.7` |
| **角色门槛** | ⚠️ 数值前后端不一致，Expert 门槛差距明显 |
| **排序逻辑** | ✅ 合理：建议人选 → 合格人选 → 其余候选 |
| **数据来源** | ✅ 全部来自 SQL Server 实时查询，无 mock 数据 |
