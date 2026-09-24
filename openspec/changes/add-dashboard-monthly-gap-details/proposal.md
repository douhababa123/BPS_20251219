# Change: Dashboard 月度 GAP 构成明细抽屉

## Why

总览趋势柱形只能看到月度 GAP 总分，无法解释该数值由哪些人员、能力模块和技能构成。

## What Changes

- 点击月度 GAP 柱子，打开右侧抽屉，展示该月同一年度基线范围内的技能 GAP 明细。
- 明细沿用年度、模块、人员筛选，显示人员、模块、技能、月末现状、年度目标及 GAP，并与柱高对账。
- 当前月按当前时刻而非未来月末取数；历史月份按月末取数。
- 不改变现有 KPI、趋势公式、数据库及日程管理。

## Impact

- Affected specs: `dashboard-gap-details`
- Affected code: `backend/competency_progress.py`, `backend/routers/dashboard_progress.py`, `src/pages/Dashboard.tsx`, Dashboard API/抽屉与测试
- Deployment: 不在本次本地实现中自动部署，按用户另行要求走 Jetson 工作流。
