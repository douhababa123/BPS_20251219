# Change: 移除总览饱和度趋势图

## Why

总览页的“饱和度趋势”折线图不再需要。移除该图可减少页面冗余，同时保留顶部饱和度 KPI供快速查看当前指标。

## What Changes

- 移除总览页“饱和度趋势 Saturation Trend”折线图。
- 保留“本月平均饱和度 Monthly Avg Saturation”KPI及现有计算口径。
- 将“能力等级分布 Level Distribution”图扩展为整行宽度。

## Impact

- Affected specs: `dashboard-overview`
- Affected code: `src/pages/Dashboard.tsx`
- No API, database, or data migration impact.
