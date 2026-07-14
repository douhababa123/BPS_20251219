# Competency GAP Ranking Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在能力画像排名页增加所有工程师 × 9 个模块的 GAP 排名矩阵，并修正个人模块总 GAP 的计算口径。

**Architecture:** 在现有 `competencyAggregation.ts` 中增加一个纯函数，一次生成模块列、工程师行、模块合计和团队合计；`Competency.tsx` 只负责传入当前年度数据并渲染。个人模块统计类型增加直接计算的 `totalGap`，消除 UI 通过平均值反推总数的错误。

**Tech Stack:** React 18、TypeScript 5.5、TailwindCSS、Vitest、React Testing Library、GitHub Actions、Jetson ARM64 self-hosted runner

## Global Constraints

- 只统计 `current_level > 0` 且 `target_level > 0` 的有效评估。
- GAP 使用记录中的 `gap`，保留负值，不截断为 0。
- 无有效记录显示 `—`；有效记录合计为零显示 `0.0`。
- 当前年度筛选是矩阵唯一时间范围来源。
- 不修改数据库结构、后端 API、导航或评估录入流程。
- 不提交现有工作区中的 `__pycache__`、截图、导出文件或其他无关改动。

---

## File Structure

- `src/lib/competencyAggregation.ts`：定义矩阵数据契约并实现纯聚合逻辑；为个人模块统计提供直接的 `totalGap`。
- `src/lib/__tests__/competencyAggregation.test.ts`：验证交叉汇总、排序、缺失值、零值和负值口径。
- `src/pages/Competency.tsx`：调用矩阵聚合函数，在排名页渲染矩阵，并直接显示个人模块 `totalGap`。
- `openspec/changes/enhance-schedule-and-competency/tasks.md`：在验证完成后勾选本次实际完成的能力分析任务。

### Task 1: 为个人模块统计提供直接总 GAP

**Files:**
- Modify: `src/lib/competencyAggregation.ts:59-68,257-340`
- Test: `src/lib/__tests__/competencyAggregation.test.ts`

**Interfaces:**
- Consumes: `calculatePersonalModuleStats(employeeId, assessments, skills)` 现有参数。
- Produces: `PersonalModuleStats.totalGap: number`；`gap` 继续表示平均 GAP，保持雷达图兼容。

- [ ] **Step 1: 写失败测试**

在 `calculatePersonalModuleStats` 测试组增加：一个模块含两条有效记录（GAP 2、1）和一条未完成记录，断言 `totalGap === 3`、`gap === 1.5`、`skillCount === 3`。

```ts
expect(module.totalGap).toBe(3);
expect(module.gap).toBe(1.5);
expect(module.skillCount).toBe(3);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/lib/__tests__/competencyAggregation.test.ts`
Expected: FAIL，提示 `totalGap` 不存在或值不匹配。

- [ ] **Step 3: 最小实现**

给接口增加字段，并在有数据、无数据两个返回分支分别赋值：

```ts
export interface PersonalModuleStats {
  // existing fields
  totalGap: number;
}

totalGap: stats.totalGap,
```

无数据分支使用 `totalGap: 0`。平均 GAP仍使用 `stats.totalGap / stats.gapCount`。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- src/lib/__tests__/competencyAggregation.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```powershell
git add src/lib/competencyAggregation.ts src/lib/__tests__/competencyAggregation.test.ts
git commit -m "fix: calculate personal module GAP totals directly"
```

### Task 2: 实现工程师模块 GAP 排名矩阵聚合

**Files:**
- Modify: `src/lib/competencyAggregation.ts`
- Test: `src/lib/__tests__/competencyAggregation.test.ts`

**Interfaces:**
- Consumes: `AssessmentFull[]`（调用方已按年度过滤）、`Skill[]`。
- Produces: `calculateEmployeeModuleGapMatrix(assessments, skills): EmployeeModuleGapMatrix`。

需要定义以下契约：

```ts
export interface EmployeeModuleGapCell {
  totalGap: number;
  hasData: boolean;
}

export interface EmployeeModuleGapRow {
  rank: number;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  modules: Record<number, EmployeeModuleGapCell>;
  totalGap: number;
}

export interface EmployeeModuleGapMatrix {
  modules: ModuleInfo[];
  rows: EmployeeModuleGapRow[];
  moduleTotals: Record<number, number>;
  grandTotal: number;
}
```

- [ ] **Step 1: 写交叉汇总失败测试**

用两个工程师、两个模块构造记录，断言每个交叉单元、个人合计、模块合计和总计；同时断言返回固定 9 个模块。

```ts
const matrix = calculateEmployeeModuleGapMatrix(mockAssessments, mockSkills);
expect(matrix.modules).toHaveLength(9);
expect(matrix.rows.find(row => row.employeeId === 'emp-1')?.modules[1]).toEqual({ totalGap: 3, hasData: true });
expect(matrix.moduleTotals[1]).toBe(3);
expect(matrix.moduleTotals[2]).toBe(2);
expect(matrix.grandTotal).toBe(5);
```

- [ ] **Step 2: 写边界与排序失败测试**

覆盖同分姓名升序、未完成记录、有效零 GAP、完全无数据模块和负 GAP。断言未完成记录不令 `hasData` 变为 true，零 GAP 单元为 `{totalGap: 0, hasData: true}`，负值进入合计。

- [ ] **Step 3: 运行测试并确认失败**

Run: `npm test -- src/lib/__tests__/competencyAggregation.test.ts`
Expected: FAIL，提示导出函数不存在。

- [ ] **Step 4: 实现纯聚合函数**

实现要点：预建 9 个模块合计；用 `skill_id -> module_id` Map 避免循环 `find`；仅处理有效记录和已知模块；按员工 Map 累加；所有员工行补齐 9 个单元；按 `totalGap` 降序、`employeeName.localeCompare` 升序排序后赋 `rank`；`grandTotal` 从行合计求和。

```ts
const isComplete = assessment.current_level > 0 && assessment.target_level > 0;
if (!isComplete) return;
cell.totalGap += assessment.gap;
cell.hasData = true;
```

- [ ] **Step 5: 运行聚合测试并确认通过**

Run: `npm test -- src/lib/__tests__/competencyAggregation.test.ts`
Expected: PASS，且模块合计之和等于个人合计之和。

- [ ] **Step 6: 提交**

```powershell
git add src/lib/competencyAggregation.ts src/lib/__tests__/competencyAggregation.test.ts
git commit -m "feat: aggregate employee module GAP ranking matrix"
```

### Task 3: 在能力画像排名页渲染矩阵

**Files:**
- Modify: `src/pages/Competency.tsx:18-31,100-130,380-575,778-799`
- Test: `src/lib/__tests__/competencyAggregation.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `calculateEmployeeModuleGapMatrix` 和 `EmployeeModuleGapMatrix`。
- Produces: 团队排名页中的“工程师模块 GAP 排名”表；现有模块排名表保持不变。

- [ ] **Step 1: 在页面计算年度矩阵并向 TeamView 传递**

```ts
const employeeModuleGapMatrix = useMemo(
  () => calculateEmployeeModuleGapMatrix(assessments, skills),
  [assessments, skills]
);
```

给 `TeamView` props 增加 `employeeModuleGapMatrix`。

- [ ] **Step 2: 把排名分支改为两个卡片**

第一张卡片标题为“工程师模块 GAP 排名 Employee Module GAP Ranking”，第二张保留现有“模块排名 Module Ranking”。矩阵外层使用 `overflow-x-auto`，表格使用足够的 `min-w-max`。

- [ ] **Step 3: 渲染矩阵表头、行与合计**

表头遍历 `matrix.modules`；正文遍历 `matrix.rows`；单元格按 `hasData` 区分 `—` 和 `formatNumber(totalGap)`；底部遍历 `matrix.moduleTotals`，最右显示 `grandTotal`。排名显示继续使用 `getRankIcon(row.rank)`。

```tsx
{cell.hasData ? formatNumber(cell.totalGap) : '—'}
```

工程师列显示姓名和部门，模块表头提供 `title={module.name}`。工程师识别列使用 sticky 左侧样式，个人总 GAP列使用 sticky 右侧样式。

- [ ] **Step 4: 修复个人模块表显示**

删除：

```ts
const totalGap = module.gap * module.skillCount;
```

改为：

```ts
const totalGap = module.totalGap;
```

- [ ] **Step 5: 运行静态与单元验证**

Run: `npm run typecheck`
Expected: PASS。

Run: `npm test -- src/lib/__tests__/competencyAggregation.test.ts`
Expected: PASS。

Run: `npm run build`
Expected: PASS 并生成 `dist/`。

- [ ] **Step 6: 提交**

```powershell
git add src/pages/Competency.tsx
git commit -m "feat: display employee module GAP ranking matrix"
```

### Task 4: 完整验证、同步 OpenSpec 并发布 Jetson

**Files:**
- Modify: `openspec/changes/enhance-schedule-and-competency/tasks.md`（仅勾选已完成且可验证的相关任务）
- Verify: `.github/workflows/jetson-deploy.yml`

**Interfaces:**
- Consumes: Tasks 1–3 的已提交实现。
- Produces: 通过本地验证的提交、推送至 `origin/DEV` 的代码、成功的 Jetson CI/CD run。

- [ ] **Step 1: 运行完整前端验证**

Run: `npm test`
Expected: 全部测试通过。

Run: `npm run typecheck`
Expected: PASS。

Run: `npm run build`
Expected: PASS。

- [ ] **Step 2: 检查改动范围**

Run: `git status --short` 和 `git diff DEV@{upstream}...HEAD --stat`
Expected: 功能提交只包含设计/计划、聚合逻辑、测试、能力画像页面和确实完成的 OpenSpec 勾选；不包含缓存、截图或 `exports/`。

- [ ] **Step 3: 更新并验证 OpenSpec**

仅将现有 `enhance-schedule-and-competency/tasks.md` 中与个人模块 GAP 汇总、团队模块 GAP 汇总及测试对应且已完成的条目标为 `[x]`。

Run: `openspec validate enhance-schedule-and-competency --strict`
Expected: Valid。

- [ ] **Step 4: 提交任务状态**

```powershell
git add openspec/changes/enhance-schedule-and-competency/tasks.md docs/superpowers/plans/2026-07-14-competency-gap-ranking-matrix.md
git commit -m "docs: record GAP ranking matrix implementation"
```

- [ ] **Step 5: 推送 DEV 触发 GitHub Actions**

Run: `git push origin DEV`
Expected: push 成功；`Jetson CI/CD Pipeline` 因 DEV push 启动。

- [ ] **Step 6: 监控工作流到终态**

Run: `gh run list --workflow jetson-deploy.yml --branch DEV --limit 1`

取得 run id 后运行：`gh run watch <run-id> --exit-status`

Expected: `代码质量检查` 和 `部署到 Jetson` 均成功，部署日志包含健康检查成功。

- [ ] **Step 7: 发布结果核对**

Run: `gh run view <run-id> --log-failed`
Expected: 无失败日志。记录部署 run URL、提交 SHA 和本地验证结果；若失败，先诊断并修复，不宣称发布完成。
