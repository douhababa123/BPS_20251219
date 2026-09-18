# Change: 统一总览与能力画像图表体验

## Why

总览和能力画像中的图表已经能够表达正确业务数据，但当前存在长标签旋转/截断、人员与技能维度过密、颜色语义不一致、图例与坐标单位不统一，以及空数据和无障碍说明不完整等问题。用户要求使用 UI/UX 设计规范审核并美化图表，同时明确日程管理必须保持现状。

## What Changes

- 为总览与能力画像建立统一的图表颜色、字体、网格线、坐标轴、图例、数值标签和 Tooltip 规范。
- 优化总览 GAP 关闭趋势的层级、坐标单位、图例顺序和选中月份信息表达，不改变 KPI 或趋势计算。
- 将适合类别比较的长标签柱状图改为水平布局，完整展示模块、技能和人员名称。
- 保留业务已确认的九模块雷达图，并改善标签、图例、留白及当前/目标系列辨识度。
- 个人视图的“技能”雷达图按用户确认保持现状，不改变图表类型、布局或交互；仅优化个人 GAP 分布等其他纳入范围的图表。
- 为无数据、加载失败和缺少历史点提供一致状态；为图表补充机器可读摘要和数据说明。
- 日程管理页面以及可通过 URL 打开的旧日历页面完全不修改。

## Impact

- Affected specs: `chart-presentation`
- Affected frontend: `src/pages/Dashboard.tsx`, `src/components/competency/TotalScoreView.tsx`, `src/components/competency/TeamGapAnalysis.tsx`, `src/components/competency/PersonalGapAnalysis.tsx`，以及仅服务这些图表的轻量共享展示组件/常量
- Tests: 对图表方向、系列语义、空状态、数据标签和范围隔离增加组件测试；执行前端完整测试、类型检查和生产构建
- Data/API impact: 无；不修改数据库、接口、统计范围、指标公式、筛选逻辑或历史数据
- Explicitly excluded: `src/pages/Schedule.tsx`, `src/pages/Calendar.tsx`，以及个人视图“技能”雷达图
