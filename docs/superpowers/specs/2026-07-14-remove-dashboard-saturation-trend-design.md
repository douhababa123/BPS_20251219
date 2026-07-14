# 移除总览饱和度趋势设计

## 背景

总览页当前在 KPI 卡片下方显示“饱和度趋势 Saturation Trend”折线图。产品要求移除该折线图，但继续保留顶部“本月平均饱和度 Monthly Avg Saturation”KPI。

## 目标

- 总览页不再渲染“饱和度趋势 Saturation Trend”标题和折线图。
- 顶部“本月平均饱和度”KPI继续显示，并保持现有计算口径。
- 原折线图右侧的“能力等级分布 Level Distribution”扩展为整行宽度，避免布局留白。

## 非目标

- 不修改饱和度数据计算函数。
- 不修改任务、人员或能力评估 API。
- 不调整其他总览卡片和图表的业务口径。

## 实现设计

修改 `src/pages/Dashboard.tsx`：

- 删除饱和度趋势卡片及其 `LineChart`、`Line` 图形元素。
- 删除不再使用的 Recharts 导入。
- 保留 `saturationTrend` 聚合结果和 `latestSaturation`，因为顶部 KPI仍依赖最新饱和度值。
- 将“能力等级分布”卡片从三列布局中的单列卡片改为整行卡片，图表高度继续保持 280px。

不新增组件、依赖、后端接口或数据库变更。

## 空状态与错误处理

沿用现有逻辑：没有任务数据时，顶部饱和度 KPI显示 `0%`。移除折线图不会增加新的空状态或错误分支。

## 验证与发布

- 静态检查确认 `Dashboard.tsx` 不再包含“Saturation Trend”、`LineChart` 或 `Line`。
- 运行全量 Vitest 测试、TypeScript 类型检查和生产构建。
- 推送 `DEV`，由现有 GitHub Actions 部署到 Jetson。
- 以 Action 的代码质量检查、Jetson 部署和 `/api/health` 健康检查成功为发布完成条件。

## 回滚

本变更不涉及数据迁移。若发布验证失败，回滚本次页面提交并重新推送 `DEV`。
