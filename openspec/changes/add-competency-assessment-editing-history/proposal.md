# Change: 增加能力评估网页编辑与季度历史

## Why

当前能力评估页面只能查看数据，用户无法在网页维护能力现状和目标；现有更新接口也没有本人权限和完整历史。业务需要把能力维护收口到矩阵页面，在保证 `目标 >= 现状` 的同时保存每次修改，并可还原每个季度的最终版本。

## What Changes

- 默认能力评估矩阵支持管理员编辑所有员工、普通工程师编辑本人。
- 现状和目标改为 `0–5` 整数选择，现状必填，目标必须大于或等于现状。
- GAP 为 0 时统一绿色；GAP 大于 0 时统一红色并显示数值，不再按 GAP 大小分色。
- 增加统一的安全保存接口，在一个事务中更新最新投影并追加完整历史快照。
- 新增能力评估历史表、季度查询接口和现有数据历史基线迁移。
- **BREAKING**：当前评估表唯一性从“员工 + 技能 + 年份”调整为“员工 + 技能”，等级约束从 `1–5` 调整为 `0–5`。

## Impact

- Affected specs: `competency-assessment-editing`
- Affected code: `backend/models.py`, `backend/routers/competency_assessments.py`, `backend/migrations/`, `SQLSERVER_SCHEMA.sql`, `src/lib/competencyApi.ts`, `src/lib/database.types.ts`, `src/components/MatrixView.tsx`, `src/pages/CompetencyAssessment.tsx`
- Affected data: `dbo.competency_assessments` and new `dbo.competency_assessment_history`
- Related active change: `enhance-schedule-and-competency` continues to own competency GAP analytics; this change owns editing, validation, permissions, latest projection and history only.
