## ADDED Requirements

### Requirement: Dashboard Without Saturation Trend Chart
系统 SHALL 在总览页保留团队饱和度 KPI，但不显示饱和度趋势折线图。

#### Scenario: View dashboard saturation information
- **WHEN** 用户打开总览页
- **THEN** 系统显示本月平均饱和度 KPI
- **AND** 系统不显示「饱和度趋势 Saturation Trend」折线图
- **AND** 能力等级分布图占据原趋势图所在整行的可用宽度
