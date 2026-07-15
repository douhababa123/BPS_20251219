# Change: 优化能力画像分析与统一四级能力上限

## Why

能力画像存在重复图表、已不需要的排名语义、平均 GAP 与总 GAP 混用，并缺少人员分配和可回溯的季度趋势。能力评估当前仍允许 5 分，也与已确认的 0–4 业务等级不一致。

## What Changes

- 取消独立 Ranking 入口，将工程师模块 GAP 矩阵改为无排名语义的汇总并迁移到差距分析。
- 总分视图的雷达图和柱状图显示 9 个模块平均现状/目标，固定 0–4 并增加数据标签。
- 差距分析移除重复雷达图，差距分布只显示总 GAP。
- 增加按模块/技能筛选的人员 GAP 分配柱状图。
- 增加模块/技能联动筛选的季度末总 GAP 趋势。
- 个人视图移除模块平均 GAP，统一使用模块总 GAP。
- **BREAKING**：能力评估输入、API 校验和数据库约束从 0–5 收紧到 0–4。

## Impact

- Affected specs: `competency-profile-analytics`, `competency-assessment-editing`
- Affected frontend: `src/pages/Competency.tsx`, competency analytics components, `src/lib/competencyAggregation.ts`, competency API client/hooks, assessment edit dialog
- Affected backend: competency assessment models/routes/history analytics and tests
- Affected database: current/history competency level check constraints; no data rewrite is expected because current data contains no 5
- Related changes: supersedes the ranking presentation added by `enhance-schedule-and-competency`; tightens the level bound introduced by `add-competency-assessment-editing-history`

