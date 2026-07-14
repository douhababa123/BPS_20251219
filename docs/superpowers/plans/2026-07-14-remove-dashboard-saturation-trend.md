# Remove Dashboard Saturation Trend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从总览页移除饱和度趋势折线图，同时保留顶部饱和度 KPI并让能力等级分布占满整行。

**Architecture:** 保留现有 `buildSaturationTrend` 与 `latestSaturation` 数据链，仅删除 `Dashboard.tsx` 中的折线图渲染和专用图表导入。能力等级分布沿用原数据和图表配置，改为单张整行卡片。

**Tech Stack:** React 18、TypeScript 5.5、Recharts、TailwindCSS、Vitest、Vite、GitHub Actions

## Global Constraints

- 顶部“本月平均饱和度 Monthly Avg Saturation”KPI必须保留现有值和计算口径。
- 不修改任务、员工、能力评估 API或饱和度聚合函数。
- 不调整其他总览图表的业务口径。
- 不提交现有工作区中的缓存、截图、导出文件或其他无关改动。

---

### Task 1: 建立 OpenSpec 变更记录

**Files:**
- Create: `openspec/changes/remove-dashboard-saturation-trend/proposal.md`
- Create: `openspec/changes/remove-dashboard-saturation-trend/tasks.md`
- Create: `openspec/changes/remove-dashboard-saturation-trend/specs/dashboard-overview/spec.md`

**Interfaces:**
- Consumes: 已确认设计 `docs/superpowers/specs/2026-07-14-remove-dashboard-saturation-trend-design.md`。
- Produces: 经严格校验的 OpenSpec 变更 `remove-dashboard-saturation-trend`。

- [ ] **Step 1: 编写 proposal.md**

明确 Why 为减少总览冗余；What Changes 为移除趋势图、保留 KPI、扩展能力等级分布；Impact 仅包含 `src/pages/Dashboard.tsx` 和 `dashboard-overview`。

- [ ] **Step 2: 编写 delta spec**

```markdown
## ADDED Requirements
### Requirement: Dashboard Without Saturation Trend Chart
系统 SHALL 在总览页保留团队饱和度 KPI，但不显示饱和度趋势折线图。

#### Scenario: View dashboard saturation information
- **WHEN** 用户打开总览页
- **THEN** 系统显示本月平均饱和度 KPI
- **AND** 系统不显示「饱和度趋势 Saturation Trend」折线图
- **AND** 能力等级分布图占据原趋势图所在整行的可用宽度
```

- [ ] **Step 3: 编写 tasks.md 并严格校验**

Run: `openspec validate remove-dashboard-saturation-trend --strict`
Expected: `Change 'remove-dashboard-saturation-trend' is valid`。

- [ ] **Step 4: 提交 OpenSpec 和实施计划**

```powershell
git add openspec/changes/remove-dashboard-saturation-trend docs/superpowers/plans/2026-07-14-remove-dashboard-saturation-trend.md
git commit -m "docs: specify dashboard saturation trend removal"
```

### Task 2: 删除折线图并扩展能力等级分布

**Files:**
- Modify: `src/pages/Dashboard.tsx:1-20,158-190`

**Interfaces:**
- Consumes: 现有 `saturationTrend` 和 `latestSaturation`。
- Produces: 不含趋势图但继续显示饱和度 KPI的 Dashboard 页面。

- [ ] **Step 1: 记录移除前的失败断言**

Run: `rg -n "Saturation Trend|LineChart|<Line " src/pages/Dashboard.tsx`
Expected: 命中趋势图标题、`LineChart` 导入/组件和 `Line` 导入/组件，证明当前页面不满足要求。

- [ ] **Step 2: 删除趋势图 JSX 与无用导入**

从 Recharts 导入中删除 `LineChart` 和 `Line`。删除标题为“饱和度趋势 Saturation Trend”的整张卡片，但保留下列代码：

```ts
const saturationTrend = useMemo(
  () => buildSaturationTrend(allTasks, employees?.length || 0),
  [allTasks, employees?.length]
);
const latestSaturation = saturationTrend[saturationTrend.length - 1]?.saturation || 0;
```

- [ ] **Step 3: 将能力等级分布改为整行**

删除原 `grid grid-cols-3` 容器及能力等级卡片的单列约束，使“能力等级分布 Level Distribution”卡片成为普通整宽卡片；保留 `ResponsiveContainer` 高度 280 和原 `BarChart` 配置。

- [ ] **Step 4: 验证目标文本和图表元素已移除**

Run: `rg -n "Saturation Trend|LineChart|<Line " src/pages/Dashboard.tsx`
Expected: 无输出，退出码 1。

Run: `rg -n "Monthly Avg Saturation|latestSaturation|Level Distribution" src/pages/Dashboard.tsx`
Expected: 三类内容均有命中。

- [ ] **Step 5: 运行静态、测试和构建验证**

Run: `npm test`
Expected: 所有测试通过。

Run: `npm run typecheck`
Expected: PASS。

Run: `npm run build`
Expected: PASS 并生成 `dist/`。

- [ ] **Step 6: 完成 OpenSpec 任务并提交**

将 `openspec/changes/remove-dashboard-saturation-trend/tasks.md` 中已完成项全部改为 `[x]`，重新运行 strict validate，然后执行：

```powershell
git add src/pages/Dashboard.tsx openspec/changes/remove-dashboard-saturation-trend/tasks.md
git commit -m "feat: remove dashboard saturation trend chart"
```

### Task 3: 集成到 DEV 并部署 Jetson

**Files:**
- Verify: `.github/workflows/jetson-deploy.yml`

**Interfaces:**
- Consumes: Tasks 1–2 的已验证提交。
- Produces: 与 `origin/DEV` 一致的发布提交及成功的 Jetson Action run。

- [ ] **Step 1: 审计提交范围并合并回 DEV**

确认 diff 只包含设计/计划、OpenSpec和 `Dashboard.tsx`。快进合并功能分支后，在 `DEV` 再运行 `npm test`、`npm run typecheck`、`npm run build`。

- [ ] **Step 2: 推送 DEV**

Run: `git push origin DEV`
Expected: push 成功，并触发 `Jetson CI/CD Pipeline`。

- [ ] **Step 3: 监控 GitHub Actions**

使用 GitHub Actions API查询本次 SHA 对应 run，持续等待到终态。
Expected: “代码质量检查”和“部署到 Jetson”均为 `success`，部署步骤中的 `/api/health` 检查成功。

- [ ] **Step 4: 最终核对**

确认本地 HEAD、`origin/DEV` 和 Action `head_sha` 一致；若任一步失败，先诊断修复，不宣称发布完成。
