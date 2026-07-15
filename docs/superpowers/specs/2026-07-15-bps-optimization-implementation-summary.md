# BPS 项目优化需求实现说明（2.1–4.7）

## 1. 文档目的与当前状态

本文汇总日程管理、能力评估和能力画像三组优化需求，逐条说明最终实现结果、业务规则、数据处理方式和主要代码位置。

本文以当前代码版本为准。需求 2.1–2.5、3.1–3.3、4.1–4.7 均已实现。原主体功能已通过 GitHub Actions 部署及 Jetson 页面复验；2026-07-15 独立审核发现并完成的能力评估卡片/表格 0–4 显示与统一红绿配色修复已通过本地自动化测试、TypeScript、ESLint 和生产构建，尚待再次通过 GitHub Actions 部署到 Jetson。

需要特别注意以下最终规则：

- 能力等级的最终有效范围是 **0–4**。早期能力评估设计中的 0–5 已被后续需求收紧为 0–4。
- 能力评估的每一次成功修改都会保存历史；业务页面显示每个员工、每项技能的最新值。
- “38 个技能”来自当前启用技能的动态数据，不在前端硬编码数量。
- 连续任务只改变日历的组合展示，不合并、删除或重写数据库中的任务记录和工时。

---

## 2. 日程管理

### 2.1 “能力区域工时分布”采用柱状图，按照工时高低排列

#### 实现结果

团队视图和个人视图中的能力区域工时分布均由饼图改为柱状图。每个能力区域对应一根柱子，并按照总工时从高到低排列。

#### 实现方式

1. 遍历当前统计范围内的任务，按能力区域累计工时。
2. 使用纯函数对统计结果排序：
   - 第一排序条件：工时降序；
   - 工时相同时：按能力区域名称排序，避免刷新后顺序跳动。
3. 使用 Recharts `BarChart` 渲染柱状图。
4. 保留各能力区域原有颜色，并在悬停提示中显示工时数值。

#### 主要代码

- `src/lib/scheduleRules.ts`：`buildCompetenceHourStats`、`sortHourStats`
- `src/pages/Schedule.tsx`：团队及个人能力区域工时柱状图
- `src/lib/__tests__/scheduleRules.test.ts`：聚合和降序排列测试

---

### 2.2 Location 选项将 “GPU-SU” 修改为 “Supplier”

#### 实现结果

新增任务时，Location 下拉框显示 `Supplier`，不再提供 `GPU-SU`。

#### 历史数据兼容

如果编辑一条历史任务，而该任务的 Location 已经是 `GPU-SU`，下拉框会临时保留这个旧值，避免打开编辑框后原数据丢失。用户可以主动将其修改为 `Supplier`。新任务不能再选择 `GPU-SU`。

#### 主要代码

- `src/lib/taskTypeConfig.ts`：标准 Location 配置
- `src/lib/scheduleRules.ts`：`getTaskLocationOptions`
- `src/pages/Schedule.tsx`：任务录入和编辑对话框

---

### 2.3 “任务状态”变更为可选输入项目

#### 实现结果

任务状态从必填按钮组改为可选下拉框，包含：

- 空白项“请选择……”；
- 计划中；
- 进行中；
- 已完成；
- 已取消。

字段不再显示必填标记，也不使用浏览器的 `required` 校验。

#### 后端兼容

现有后端流程仍需要一个有效状态，因此用户不选择状态时，提交前统一转换为 `planned`。这使页面保持“可选输入”，同时不破坏现有审批、筛选和数据库逻辑。

#### 主要代码

- `src/lib/scheduleRules.ts`：`normalizeOptionalStatus`
- `src/pages/Schedule.tsx`：任务状态下拉框及提交转换

---

### 2.4 任务类型选择 Leave 后锁定其他业务字段

#### 实现结果

当任务类型选择 `Leave` 时：

1. 任务名称自动设为 `Leave`；
2. Location 自动设为 `out of office`；
3. 清空能力区域、能力项、分配工程师、任务状态和备注等无关输入；
4. 除任务类型、开始日期、结束日期和时间槽以外，其余业务字段全部禁用；
5. 已禁用字段不再参与必填校验，避免用户为请假任务输入无意义信息。

从 `Leave` 切换回其他任务类型时，Leave 自动写入的值会被清理，相关字段恢复可编辑。编辑已有 Leave 任务时，也会直接进入锁定状态。

#### 主要代码

- `src/lib/scheduleRules.ts`：`isLeaveTaskType`、`applyTaskTypeChange`
- `src/pages/Schedule.tsx`：字段禁用、清空及校验处理
- `src/lib/__tests__/scheduleRules.test.ts`：进入、退出和编辑 Leave 的状态转换测试

---

### 2.5 连续超过 8 小时的任务在日历中连接显示

#### 最终业务含义

系统不再简单地根据日期范围计算“连续工时”，而是直接使用已有时间槽：

- 上午 `AM`：3.5h；
- 下午 `PM`：4.5h；
- 全天 `FULL_DAY`：展开为上午和下午，共 8h。

只有时间真正连贯、累计工时大于 8h 的同一任务，才在日历中显示为连接的跨格任务条。

#### 同一连续任务的识别条件

任务片段必须同时满足以下条件：

1. 同一工程师；
2. 同一任务名称；
3. 同一任务类型；
4. 日期和时间槽连续。

时间槽连续规则包括：

- 同一天上午接下午：连续；
- 当天下午或全天结束后，下一自然日上午或全天开始：连续；
- 第一天全天、第二天下午：不连续，因为第二天上午存在空档；
- 第一天只有上午、第二天上午：不连续，因为第一天下午存在空档；
- 任意未覆盖的上午或下午都会中断连续段。

例如，第一天全天 8h 加第二天上午 3.5h，会形成 11.5h 连续任务；第一天全天加第二天下午，则分别显示为 8h 和 4.5h。

#### 日历展示方式

1. 连续总工时大于 8h 时，各日期格中的任务片段连接为同一条视觉任务带。
2. 完整任务名称和连续总工时只在最左侧的首段显示一次。
3. 首段任务名称在第一天单元格内自动换行并完整显示。
4. 后续中段和尾段不重复文字，并与首段保持相同高度。
5. 相邻片段取消面对面的间距、圆角和边框，使任务条视觉上连续。
6. 普通任务同样完整显示名称；上午任务位于日期格上部，下午任务位于下部，二者均使用完整列宽。
7. 日期列最小宽度为 100px，不额外显示明显的上午/下午子格或分隔线。

#### 数据影响

此功能只组合前端展示片段，不修改：

- 后端 API；
- 数据库任务记录；
- 单条记录的 `total_hours`；
- 上午 3.5h、下午 4.5h、全天 8h 的时间槽定义。

#### 主要代码

- `src/lib/scheduleRules.ts`：连续段识别、工时累计、片段位置和显示顺序
- `src/components/TaskCard.tsx`：首段/中段/尾段样式、完整名称和连续总工时
- `src/components/CalendarDayTasks.tsx`：纵向排列和同组片段高度同步
- `src/pages/Schedule.tsx`：100px 日期列及工程师行共享高度
- `src/lib/__tests__/scheduleRules.test.ts`、`src/components/__tests__/TaskCard.test.tsx`、`src/components/__tests__/CalendarDayTasks.test.tsx`：连续性和视觉结构测试

---

## 3. 能力评估

### 3.1 网页手动修改现状和目标，并执行目标不小于现状的规则

#### 实现结果

有权限的用户可以在能力评估矩阵中点击单元格，或使用 Enter/Space 键打开编辑对话框并修改能力现状、目标及备注。

权限规则为：

- 管理员可以修改所有工程师；
- 工程师只能修改自己的能力评估；
- 前端控制是否显示编辑入口，后端再次进行最终权限校验。

#### 数值和颜色规则

- 现状和目标都只能取 0、1、2、3、4；
- 目标下拉框只提供“大于等于当前现状”的值；
- 如果提高现状后原目标变得小于现状，系统清空无效目标、显示错误并禁止保存；
- 后端同时校验 `0 <= 现状 <= 目标 <= 4`，非法请求返回 422；
- 目标等于现状：显示绿色，不显示正 GAP；
- 目标大于现状：显示红色及准确 GAP 数值；
- 红色不再根据 GAP 为 1、2、3、4 使用不同深浅。
- 上述红绿规则同时应用于矩阵、卡片、表格、模块进度条和平均 GAP 摘要；
- 卡片和表格的能力体系、分母及进度刻度统一为 0–4，不再显示 `/5` 或第五级刻度。

#### 主要代码

- `src/components/AssessmentEditDialog.tsx`：联动选择、错误提示和保存控制
- `src/components/MatrixView.tsx`：矩阵单元格编辑入口、键盘操作和颜色规则
- `src/pages/CompetencyAssessment.tsx`：卡片、表格和摘要的 0–4 显示及统一红绿 GAP 规则
- `src/lib/competencyApi.ts`：保存及历史 API
- `backend/routers/competency_assessments.py`：工程师保存和权限校验
- `backend/routers/admin_competency_assessments.py`：管理员保存和服务端校验
- `backend/migrations/006_competency_levels_0_4.sql`：数据库 0–4 约束

---

### 3.2 现状必须有数值，最小为 0

#### 实现结果

现状是必填项，0 是合法且有业务意义的已评估值，不能被当作空值。

具体处理如下：

- 编辑对话框未选择现状时不能保存；
- 聚合代码使用“是否为 `null`/`undefined`”判断缺失，不再使用布尔判断，因此 0 会进入平均分、总分、GAP 和人数统计；
- 卡片和表格将 0 显示为合法的 `L0`，目标和现状均为 0 时显示绿色 GAP 0，不再显示为 `-`；
- 数据库当前表与历史表均限制能力等级为 0–4。

迁移到 0–4 约束之前会先检查是否存在大于 4 的旧数据；如存在则中止迁移并报告，不会静默截断成 4。

---

### 3.3 保存每次修改历史，页面显示最新版本及季度末版本

#### 数据结构

采用“当前投影 + 不可变历史”的双表方案：

```text
网页保存一次评估
        │
        ▼
统一后端事务
   ├── 更新 competency_assessments 当前最新值
   └── 新增 competency_assessment_history 完整历史快照
        │
        ├── 主页面及现有统计读取当前最新值
        └── 历史查询和季度趋势按时间还原版本
```

#### 每次保存的处理

一次保存会在同一个数据库事务中完成：

1. 校验用户权限、员工、技能和 0–4 等级规则；
2. 按“员工 + 技能”更新或新增当前表唯一记录；
3. 向历史表追加一条完整且不可修改的快照；
4. 任一步骤失败则整体回滚，避免当前值和历史不一致。

历史快照包含员工、技能、现状、目标、GAP、评估日期、年份、季度、备注、修改时间、修改人和修改来源。季度由服务端根据修改时间计算，不能由前端伪造。

#### 页面和季度规则

- 能力评估主页面始终读取 `competency_assessments`，显示最新整体版本；
- 同一季度修改多次时，所有修改都保留在历史表中；
- 历史 API 支持员工、技能、年份和季度筛选；
- `latest_per_quarter=true` 时，每个季度只返回该季度最后一次修改；
- 季度趋势使用每个季度最后一天之前可获得的最新历史快照，而不是只看当天发生的修改。

#### 现有数据历史基线

数据库迁移时，将上线前已有的当前评估复制到历史表，标记为 `MIGRATION_BASELINE`。这样上线后的季度趋势有起点，同时不会伪造上线前并不存在的逐次修改记录。

#### 主要代码

- `backend/competency_assessment_history.py`：统一事务保存、历史追加及趋势快照计算
- `backend/routers/competency_assessments.py`：保存、历史查询和趋势接口
- `backend/routers/admin_competency_assessments.py`：管理员写入复用同一保存服务
- `backend/migrations/005_competency_assessment_history.sql`：历史表、基线迁移、当前记录唯一化
- `backend/migrations/006_competency_levels_0_4.sql`：当前表和历史表 0–4 约束

---

## 4. 能力画像

### 4.1 取消 “排名 Ranking”

#### 实现结果

独立的“排名 Ranking”入口、名次列及按 GAP 排名的语义已移除。

为了避免之前已经实现的统计能力丢失，原“工程师 × 能力模块”矩阵没有删除，而是迁入“差距分析”，改名为“工程师模块 GAP 汇总”。该汇总：

- 按工程师姓名排列，不再按 GAP 排名；
- 保留每个人在每个模块的 GAP 总分；
- 保留每个人的个人总 GAP；
- 保留每个模块所有人的团队 GAP 合计；
- 保留全团队总 GAP。

原单独的模块排名表被移除，因为 4.4 的差距分布已经提供模块总 GAP，避免重复。

#### 主要代码

- `src/pages/Competency.tsx`：移除 Ranking 子视图
- `src/components/competency/TeamGapAnalysis.tsx`：工程师模块 GAP 汇总
- `src/lib/competencyAggregation.ts`：姓名排序和个人/模块/团队合计

---

### 4.2 总分视图显示 9 大模块平均分，最大值 4，并增加数据标签

#### 实现结果

总分视图中的雷达图和柱状图均显示 9 大能力模块的：

- 平均现状；
- 平均目标。

两个图表的坐标最大值固定为 4，图形上直接显示一位小数的数据标签。

#### 平均分规则

- 0 分参与平均值计算；
- 完全没有评估记录的缺失值不进入分母；
- 前端和数据库共同保证新数据不超过 4；
- 迁移发现旧数据大于 4 时会中止，而不是在图表中静默截断。

雷达图使用蓝色现状标签和橙色目标标签，并使用不同偏移减少重叠；柱状图标签显示在柱子顶部。

原有“总目标分数、总实际分数、总差距”KPI 和模块总分明细表继续保留，它们仍显示总分，而不是被平均分替代。

#### 主要代码

- `src/components/competency/TotalScoreView.tsx`：平均分雷达图、柱状图、0–4 坐标和 `LabelList`/雷达标签
- `src/lib/competencyAggregation.ts`：模块平均值和总值计算

---

### 4.3 差距分析移除重复的“9 大模块雷达图”

差距分析中的 9 大模块雷达图已移除，因为总分视图已经提供相同维度的平均现状/目标雷达图。个人视图中用于查看个人能力结构的雷达展示不受此项影响。

主要代码：`src/pages/Competency.tsx`、`src/components/competency/TeamGapAnalysis.tsx`。

---

### 4.4 差距分布只显示 GAP 总数值

#### 实现结果

“差距分布”支持在“模块”和“技能”两个维度之间切换，每根柱子只显示 GAP 总数值，不再显示平均 GAP。

GAP 总数按原始评估逐条直接求和：

`总 GAP = Σ(目标值 - 现状值)`

系统不会先求平均再反推总数，从而避免人数不同或缺失数据造成误差。

#### 主要代码

- `src/components/competency/TeamGapAnalysis.tsx`：模块/技能差距分布柱状图
- `src/lib/competencyAggregation.ts`：模块和技能总 GAP 聚合

---

### 4.5 增加模块/技能 GAP 在不同人员之间的分配柱状图

#### 实现结果

新增“人员 GAP 分配”柱状图，采用已确认的方案 A：先选择维度和具体项目，再比较该项目在所有人员之间的 GAP。

使用方式：

1. 选择“模块”或“技能”；
2. 选择一个具体能力模块或技能；
3. 图表显示每位工程师的一根柱子；
4. 按 GAP 从高到低排列，GAP 相同时按姓名排列。

GAP 为 0 的人员仍然显示。没有该项评估数据的人员以 0 柱显示，并在图表下方标注“暂无评估”，避免把“没有数据”和“真实 GAP 为 0”混为一谈。

模块来自 9 大模块配置；技能来自当前启用技能，因此当前为 38 项，但会随后台启用技能变化自动更新。

#### 主要代码

- `src/lib/competencyAggregation.ts`：`calculateEmployeeGapDistribution`
- `src/components/competency/TeamGapAnalysis.tsx`：维度/项目筛选器和人员柱状图

---

### 4.6 增加季度总 GAP 趋势图及模块、技能筛选器

#### 实现结果

差距分析新增“季度总 GAP 趋势”折线图，显示所选年度 Q1–Q4 的季度末总 GAP，并支持：

- 全部模块或指定能力模块；
- 全部技能或指定技能；
- 模块和技能联动筛选。

切换模块时，如果当前技能不属于新模块，系统会自动清空技能选择；后端也会校验模块与技能的归属关系，非法组合返回 422。

#### 趋势计算规则

每个季度点不是简单汇总“该季度发生过修改的记录”，而是还原季度最后一天的有效状态：

1. 确定当前有效的工程师和有效技能范围；
2. 对每个“工程师 + 技能”，查找季度结束时间之前最近的一条历史快照；
3. 允许沿用之前季度甚至之前年度的最近值；
4. 对选定范围直接累加 `目标 - 现状`；
5. 返回 Q1–Q4 四个固定点。

接口通过 `hasData` 区分“真实总 GAP 为 0”和“该季度没有任何历史基线”。没有基线的点不会被错误地画成 0。

后端只返回聚合趋势，不向普通前端页面暴露所有人的原始历史明细。

#### 主要代码

- `backend/routers/competency_assessments.py`：`/api/competency-assessments/gap-trend`
- `backend/competency_assessment_history.py`：季度末快照和总 GAP 计算
- `src/lib/competencyApi.ts`：趋势 API 客户端
- `src/hooks/useCompetencyGapTrend.ts`：React Query 数据获取
- `src/components/competency/TeamGapAnalysis.tsx`：趋势图和联动筛选器

---

### 4.7 个人视图不显示每个模块的平均 GAP

#### 实现结果

个人视图的模块图表统一显示模块总 GAP，不再显示模块平均 GAP。模块明细表移除了“平均 GAP”列，保留：

- 模块总 GAP；
- 技能数量；
- 状态信息。

切换到技能维度时，仍可查看每项技能的 GAP，便于定位具体提升项。

#### 主要代码

- `src/components/competency/PersonalGapAnalysis.tsx`
- `src/lib/competencyAggregation.ts`

---

## 5. 测试、迁移和部署验证

### 自动化覆盖

实现包含以下验证：

- 日程聚合排序、Location 兼容、可选状态、Leave 状态转换和连续时间槽识别；
- 普通/跨天任务完整名称、片段连接、首段标签和高度同步；
- 能力评估权限、0 值、0–4 范围、目标不小于现状、单事务保存和历史追加；
- 历史基线迁移、当前记录唯一性和迁移前置检查；
- 模块平均分、直接总 GAP、人员分配、姓名排序、季度末趋势和筛选器校验；
- Ranking 入口和重复雷达移除、数据标签、动态技能数量及个人平均 GAP 移除；
- TypeScript、生产构建和 OpenSpec 严格校验。

### 部署结果

主体变更已合入 `DEV`，并通过现有 GitHub Actions 工作流部署到 Jetson。能力评估和能力画像的上一轮整合部署为：

- [GitHub Actions 运行 29398839282](https://github.com/douhababa123/BPS_20251219/actions/runs/29398839282)

该次部署后已对 Jetson 健康状态、0–4 能力编辑、总分图表、差距分析、人员分配、季度趋势及工程师模块 GAP 汇总进行页面复验。2026-07-15 新增的能力评估卡片/表格统一配色、`L0` 和四级刻度修复当前仅完成本地验证，需在下一次 GitHub Actions 部署后补充 Jetson 复验记录。

---

## 6. 对应设计与 OpenSpec 文档

- [日程管理优化设计](2026-07-14-schedule-management-optimization-design.md)
- [日历上下排列与完整名称设计](2026-07-14-schedule-half-day-positioning-design.md)
- [能力评估编辑与历史设计](2026-07-15-competency-assessment-editing-history-design.md)
- [能力画像分析设计](2026-07-15-competency-profile-analytics-design.md)
- [日程管理 OpenSpec](../../../openspec/changes/update-schedule-management-workflows/)
- [能力评估历史 OpenSpec](../../../openspec/changes/add-competency-assessment-editing-history/)
- [能力画像 OpenSpec](../../../openspec/changes/update-competency-profile-analytics/)
