# Competency Profile Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化能力画像的当前 GAP、人员分配和季度趋势展示，并把能力评估的有效等级统一收紧为 0–4。

**Architecture:** 当前年度分析继续由前端纯聚合函数从最新评估投影计算；季度趋势由 FastAPI/SQL Server 按季度末快照聚合，只向浏览器返回四个季度合计。能力等级上限在编辑控件、Pydantic 模型和 SQL 约束三层统一执行，部署工作流以可重复迁移应用数据库约束。

**Tech Stack:** React 18, TypeScript 5.5, Recharts 3.4, TanStack React Query 5, Vitest 3, Testing Library, FastAPI, Pydantic v2, pyodbc, SQL Server, pytest, GitHub Actions self-hosted Jetson runner

## Global Constraints

- 能力等级必须满足整数 `0 <= current <= target <= 4`；0 是有效值，5 必须在 API 边界返回 HTTP 422。
- 当前分析范围使用页面所选年度、当前在职工程师和当前启用技能；技能数量必须来自数据，不得写死 38 或 39。
- 所有总 GAP 必须直接累加 `target - current`，不得通过平均值乘数量反推。
- 季度趋势固定返回所选年度 Q1–Q4，并可跨年度向前沿用最后历史快照。
- 独立 Ranking 入口和排名语义必须消失，但工程师模块 GAP 汇总及个人/模块/团队合计必须保留。
- 平均分显示一位小数；GAP 总数按实际精度显示。
- 不新增第三方依赖；中文主标题、英文副标题和现有浅色 Bosch 风格保持一致。
- 必须保留用户现有未提交文件和缓存，不得清理无关工作区内容。

---

## File Structure

- `backend/migrations/006_competency_levels_0_4.sql`：幂等地验证并收紧当前表、历史表等级约束。
- `backend/run_migration.py`：接受显式迁移路径，供 GitHub Actions 调用。
- `backend/models.py`：0–4 保存边界。
- `backend/competency_assessment_history.py`：季度末团队 GAP SQL 聚合。
- `backend/routers/competency_assessments.py`：趋势参数验证和静态路由。
- `src/lib/competencyAggregation.ts`：当前数据平均值、人员分配、无排名矩阵纯函数。
- `src/lib/competencyApi.ts`：季度趋势请求和响应类型。
- `src/hooks/useCompetencyGapTrend.ts`：趋势 React Query 状态。
- `src/components/competency/TeamGapAnalysis.tsx`：团队差距分析四张卡片。
- `src/components/competency/TotalScoreView.tsx`：平均分雷达/柱状图与保留的总分 KPI/表格。
- `src/components/competency/PersonalGapAnalysis.tsx`：个人总 GAP 图表与汇总。
- `src/pages/Competency.tsx`：查询、年度/团队个人切换和组件编排。

---

### Task 1: Add a safe 0–4 database migration path

**Files:**
- Create: `backend/migrations/006_competency_levels_0_4.sql`
- Create: `backend/tests/test_competency_level_0_4_migration.py`
- Modify: `backend/run_migration.py:16-76`
- Modify: `SQLSERVER_SCHEMA.sql:141-188`
- Modify: `.github/workflows/jetson-deploy.yml:129-148`

**Interfaces:**
- Consumes: SQL Server tables `dbo.competency_assessments` and `dbo.competency_assessment_history` created by migration 005.
- Produces: idempotent constraints `CK_competency_assessments_current_0_4`, `CK_competency_assessments_target_0_4`, `CK_competency_history_current_0_4`, `CK_competency_history_target_0_4`; CLI `python run_migration.py <path>`.

- [ ] **Step 1: Write migration contract tests**

```python
from pathlib import Path


SQL = Path("migrations/006_competency_levels_0_4.sql").read_text(encoding="utf-8")


def test_preflight_happens_before_constraint_drop():
    preflight = SQL.index("current_level > 4 OR target_level > 4")
    first_drop = SQL.index("DROP CONSTRAINT")
    assert preflight < first_drop
    assert "THROW 51000" in SQL


def test_migration_installs_all_four_level_constraints():
    for name in (
        "CK_competency_assessments_current_0_4",
        "CK_competency_assessments_target_0_4",
        "CK_competency_history_current_0_4",
        "CK_competency_history_target_0_4",
    ):
        assert name in SQL
    assert SQL.count("BETWEEN 0 AND 4") >= 4
```

- [ ] **Step 2: Run the migration tests and verify RED**

Run: `cd backend; ..\.venv\Scripts\python.exe -m pytest tests/test_competency_level_0_4_migration.py -q`

Expected: FAIL because `006_competency_levels_0_4.sql` does not exist.

- [ ] **Step 3: Implement the idempotent migration and generic runner**

The SQL must use `SET XACT_ABORT ON`, a `TRY/TRANSACTION/CATCH` block, abort before any DDL when either table contains a level above 4, drop both legacy `_0_5` names and any previous `_0_4` names when present, then add the four named 0–4 constraints. Update `SQLSERVER_SCHEMA.sql` to create the same four names.

Replace the hard-coded runner entry point with:

```python
if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python run_migration.py <migration.sql>")
        sys.exit(2)
    migration_file = Path(sys.argv[1])
    if not migration_file.is_absolute():
        migration_file = Path(__file__).parent / migration_file
    run_migration(migration_file)
```

In the Jetson deploy job, after `docker compose build --pull=false` and before `docker compose up -d`, add:

```yaml
          echo "🔧 应用能力等级 0-4 数据库约束..."
          docker compose run --rm --no-deps backend \
            python run_migration.py migrations/006_competency_levels_0_4.sql
```

- [ ] **Step 4: Run migration tests and static checks**

Run: `cd backend; ..\.venv\Scripts\python.exe -m pytest tests/test_competency_level_0_4_migration.py -q; ..\.venv\Scripts\python.exe -m py_compile run_migration.py`

Expected: all tests PASS and compilation exits 0.

- [ ] **Step 5: Commit the migration path**

```powershell
git add backend/migrations/006_competency_levels_0_4.sql backend/tests/test_competency_level_0_4_migration.py backend/run_migration.py SQLSERVER_SCHEMA.sql .github/workflows/jetson-deploy.yml
git commit -m "feat: enforce four-level competency constraints"
```

---

### Task 2: Enforce 0–4 in API models and the edit dialog

**Files:**
- Modify: `backend/models.py:350-396`
- Modify: `backend/routers/competency_assessments.py:360-440`
- Modify: `backend/routers/admin_competency_assessments.py:14-45,120-190`
- Modify: `backend/tests/test_competency_assessment_history.py`
- Create: `backend/tests/test_competency_level_validation.py`
- Modify: `backend/tests/test_competency_assessments.py:35-105`
- Modify: `src/components/AssessmentEditDialog.tsx:18-54,115-148`
- Modify: `src/components/__tests__/AssessmentEditDialog.test.tsx`

**Interfaces:**
- Consumes: `CompetencyAssessmentSave` and `AssessmentSaveInput`.
- Produces: Pydantic bounds `ge=0, le=4`; select option set `[0,1,2,3,4]`.

- [ ] **Step 1: Change tests to require 0–4 and rejection of 5**

Add the backend test:

```python
import pytest
from pydantic import ValidationError
from models import CompetencyAssessmentSave


def test_competency_save_rejects_level_five():
    with pytest.raises(ValidationError):
        CompetencyAssessmentSave(current_level=4, target_level=5)


def test_admin_payload_rejects_level_five():
    with pytest.raises(ValidationError):
        AdminCompetencyAssessmentCreate(
            employee_id="00000000-0000-0000-0000-000000000001",
            skill_id=1,
            current_level=4,
            target_level=5,
        )
```

Change the dialog expectation after current 3 to:

```typescript
expect(optionValues).toEqual(['', '3', '4']);
expect(screen.queryByRole('option', { name: '5' })).not.toBeInTheDocument();
```

Update the API integrity assertions to `<= 4`, and rename the old high-value test to verify level 4 rather than level 5.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd backend; ..\.venv\Scripts\python.exe -m pytest tests/test_competency_assessment_history.py -q; cd ..; npm test -- --run src/components/__tests__/AssessmentEditDialog.test.tsx`

Expected: backend accepts 5 and frontend still renders option 5, so both new assertions FAIL.

- [ ] **Step 3: Implement the minimal four-level bounds**

Change every competency create/update/save `Field(..., ge=0, le=5)` or optional equivalent in `backend/models.py` to `le=4`. Add target/current combination validation to the legacy create model. For legacy and admin partial updates, read the stored current/target pair, merge submitted values, and raise HTTP 422 before executing UPDATE when `next_target < next_current`. Apply `Field(ge=0, le=4)` plus a model validator to the independent admin create/update schemas so no registered write route accepts 5.

In the dialog use:

```typescript
const LEVELS = [0, 1, 2, 3, 4] as const;

const targetOptions = useMemo(
  () => current === '' ? [] : LEVELS.filter(level => level >= current),
  [current],
);
```

Render current options from `LEVELS` and extend `canSave` with `current <= 4 && target <= 4`.

- [ ] **Step 4: Run focused and model tests**

Run: `cd backend; ..\.venv\Scripts\python.exe -m pytest tests/test_competency_assessment_history.py tests/test_competency_assessment_routes.py -q; cd ..; npm test -- --run src/components/__tests__/AssessmentEditDialog.test.tsx`

Expected: all tests PASS.

- [ ] **Step 5: Commit four-level input validation**

```powershell
git add backend/models.py backend/routers/competency_assessments.py backend/routers/admin_competency_assessments.py backend/tests/test_competency_assessment_history.py backend/tests/test_competency_level_validation.py backend/tests/test_competency_assessments.py src/components/AssessmentEditDialog.tsx src/components/__tests__/AssessmentEditDialog.test.tsx
git commit -m "feat: restrict competency editing to levels zero through four"
```

---

### Task 3: Correct current analytics and build per-person aggregation

**Files:**
- Modify: `src/lib/competencyAggregation.ts`
- Modify: `src/lib/__tests__/competencyAggregation.test.ts`

**Interfaces:**
- Consumes: `AssessmentFull[]`, `Skill[]`, and active employee scope `{ employeeId, employeeName, departmentName }[]`.
- Produces: `calculateEmployeeGapDistribution(...)`, `calculateEmployeeModuleGapSummary(...)`, zero-inclusive averages, direct GAP totals.

- [ ] **Step 1: Write failing zero, distribution and summary tests**

```typescript
it('includes assessed zero in module averages and total GAP', () => {
  const rows = [
    { ...mockAssessments[0], employee_id: 'emp-1', current_level: 0, target_level: 2, gap: 2 },
    { ...mockAssessments[2], employee_id: 'emp-2', current_level: 4, target_level: 4, gap: 0 },
  ];
  const module = calculateTeamModuleStats(rows, mockSkills)[0];
  expect(module.avgCurrent).toBe(2);
  expect(module.avgTarget).toBe(3);
  expect(module.totalGap).toBe(2);
});

it('shows every active employee in selected module distribution', () => {
  const points = calculateEmployeeGapDistribution(
    mockAssessments,
    mockSkills,
    [
      { employeeId: 'emp-1', employeeName: 'Zoe', departmentName: 'D' },
      { employeeId: 'emp-2', employeeName: 'Amy', departmentName: 'D' },
      { employeeId: 'emp-3', employeeName: 'No Data', departmentName: 'D' },
    ],
    { dimension: 'module', itemId: 1 },
  );
  expect(points.map(point => [point.employeeName, point.totalGap, point.hasData])).toEqual([
    ['Zoe', 3, true],
    ['Amy', 0, true],
    ['No Data', 0, false],
  ]);
});

it('keeps an active skill with no selected-year assessment at zero', () => {
  const result = calculateTeamSkillStats([], mockSkills);
  expect(result.map(skill => [skill.skillId, skill.totalGap])).toEqual([
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
});

it('sorts the GAP summary by employee name and has no rank', () => {
  const namedAssessments = mockAssessments.map(assessment => ({
    ...assessment,
    employee_name: assessment.employee_id === 'emp-1' ? 'Zoe' : 'Amy',
  }));
  const summary = calculateEmployeeModuleGapSummary(namedAssessments, mockSkills);
  expect(summary.rows.map(row => row.employeeName)).toEqual(['Amy', 'Zoe']);
  expect(summary.rows[0]).not.toHaveProperty('rank');
});
```

- [ ] **Step 2: Run the aggregation suite and verify RED**

Run: `npm test -- --run src/lib/__tests__/competencyAggregation.test.ts`

Expected: zero average is excluded and both new function exports are missing.

- [ ] **Step 3: Implement the pure aggregation contracts**

Add these public types and signatures:

```typescript
export interface ActiveEmployeeScope {
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
}

export interface EmployeeGapDistributionPoint extends ActiveEmployeeScope {
  totalGap: number;
  hasData: boolean;
}

export type GapDistributionSelection = {
  dimension: 'module' | 'skill';
  itemId: number;
};

export function calculateEmployeeGapDistribution(
  assessments: AssessmentFull[],
  skills: Skill[],
  employees: ActiveEmployeeScope[],
  selection: GapDistributionSelection,
): EmployeeGapDistributionPoint[];

export function calculateEmployeeModuleGapSummary(
  assessments: AssessmentFull[],
  skills: Skill[],
  employees?: ActiveEmployeeScope[],
): EmployeeModuleGapMatrix;
```

For persisted current assessments, increment current, target and GAP counts for every record, including 0. Seed skill statistics from every active `Skill` so skills without a selected-year assessment remain visible with zero totals. Remove `rank` from `EmployeeModuleGapRow`, sort summary rows by `employeeName.localeCompare`, and make distribution sort GAP descending then name ascending. Rename UI-facing matrix comments from ranking to summary; remove `getRankIcon` once no consumers remain.

- [ ] **Step 4: Run the aggregation suite**

Run: `npm test -- --run src/lib/__tests__/competencyAggregation.test.ts`

Expected: all tests PASS, including missing-data versus zero-data assertions.

- [ ] **Step 5: Commit current analytics**

```powershell
git add src/lib/competencyAggregation.ts src/lib/__tests__/competencyAggregation.test.ts
git commit -m "feat: aggregate competency GAP without ranking"
```

---

### Task 4: Implement the quarter-end GAP trend endpoint

**Files:**
- Modify: `backend/competency_assessment_history.py`
- Modify: `backend/routers/competency_assessments.py:220-335`
- Create: `backend/tests/test_competency_gap_trend.py`
- Modify: `backend/tests/test_competency_assessment_routes.py`

**Interfaces:**
- Consumes: `year: int`, optional `module_id: int`, optional `skill_id: int`, authenticated caller.
- Produces: `GET /api/competency-assessments/gap-trend`; response `{year,moduleId,skillId,quarters:[{quarter,label,totalGap,hasData}]}`.

- [ ] **Step 1: Write route and SQL contract tests**

```python
def test_gap_trend_uses_as_of_snapshot_and_returns_four_quarters():
    cursor = MagicMock()
    cursor.fetchall.return_value = [(1, 12, 3), (2, 10, 3), (3, 0, 0), (4, 0, 0)]
    result = build_gap_trend(cursor, year=2026, module_id=None, skill_id=None)
    sql = cursor.execute.call_args.args[0]
    assert "OUTER APPLY" in sql
    assert "changed_at < DATEADD(day, 1, q.quarter_end)" in sql
    assert "ISNULL(e.is_active, 1) = 1" in sql
    assert "ISNULL(s.is_active, 1) = 1" in sql
    assert [point["hasData"] for point in result] == [True, True, False, False]


def test_gap_trend_rejects_skill_outside_module():
    cursor = MagicMock()
    cursor.fetchone.return_value = (8,)
    with pytest.raises(HTTPException) as error:
        validate_gap_trend_scope(cursor, module_id=7, skill_id=99)
    assert error.value.status_code == 422
```

Also assert `/gap-trend` is registered before `/{assessment_id}`.

- [ ] **Step 2: Run focused backend tests and verify RED**

Run: `cd backend; ..\.venv\Scripts\python.exe -m pytest tests/test_competency_gap_trend.py tests/test_competency_assessment_routes.py -q`

Expected: FAIL because trend functions and route do not exist.

- [ ] **Step 3: Implement validation, SQL and response mapping**

Add `validate_gap_trend_scope(cursor, module_id, skill_id)` to verify active module/skill existence and membership. Add `build_gap_trend(...)` with four quarter-end dates and an active employee × active skill scope. For each scope row and quarter, use `OUTER APPLY (SELECT TOP 1 gap FROM competency_assessment_history WHERE employee_id/skill_id match AND changed_at < day-after-quarter-end ORDER BY changed_at DESC, id DESC)`. Group by quarter with `SUM(gap)` and `COUNT(gap)`.

Register before the UUID route:

```python
@router.get("/gap-trend")
def get_gap_trend(
    year: int = Query(..., ge=2000, le=2100),
    module_id: Optional[int] = Query(None, ge=1, le=9),
    skill_id: Optional[int] = Query(None, ge=1),
    cursor=Depends(get_db),
    current_user=Depends(get_current_user),
):
    validate_gap_trend_scope(cursor, module_id, skill_id)
    quarters = build_gap_trend(cursor, year, module_id, skill_id)
    return {
        "year": year,
        "moduleId": module_id,
        "skillId": skill_id,
        "quarters": quarters,
    }
```

The endpoint returns aggregate data to any authenticated user and never returns employee IDs.

- [ ] **Step 4: Run backend trend and route tests**

Run: `cd backend; ..\.venv\Scripts\python.exe -m pytest tests/test_competency_gap_trend.py tests/test_competency_assessment_routes.py tests/test_competency_assessment_history.py -q`

Expected: all tests PASS.

- [ ] **Step 5: Commit the trend endpoint**

```powershell
git add backend/models.py backend/competency_assessment_history.py backend/routers/competency_assessments.py backend/tests/test_competency_gap_trend.py backend/tests/test_competency_assessment_routes.py
git commit -m "feat: aggregate quarter-end competency GAP trend"
```

---

### Task 5: Add the frontend trend client and query hook

**Files:**
- Modify: `src/lib/competencyApi.ts`
- Modify: `src/lib/__tests__/competencyApi.test.ts`
- Create: `src/hooks/useCompetencyGapTrend.ts`
- Create: `src/hooks/__tests__/useCompetencyGapTrend.test.tsx`

**Interfaces:**
- Consumes: `GapTrendFilters { year; moduleId?: number; skillId?: number }`.
- Produces: `CompetencyGapTrendResponse`, `getCompetencyGapTrend(filters)`, `useCompetencyGapTrend(filters)`.

- [ ] **Step 1: Write API serialization and query-key tests**

```typescript
it('requests a filtered quarter-end GAP trend', async () => {
  const payload = { year: 2026, moduleId: 7, skillId: 21, quarters: [] };
  vi.mocked(apiClient.get).mockResolvedValue({ data: payload });
  await expect(getCompetencyGapTrend({ year: 2026, moduleId: 7, skillId: 21 }))
    .resolves.toEqual(payload);
  expect(apiClient.get).toHaveBeenCalledWith('/competency-assessments/gap-trend', {
    params: { year: 2026, module_id: 7, skill_id: 21 },
  });
});
```

The hook test must render a `QueryClientProvider`, mock `getCompetencyGapTrend`, and verify that changing `skillId` creates a fresh request.

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

vi.mock('../../lib/competencyApi', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/competencyApi')>();
  return { ...actual, getCompetencyGapTrend: vi.fn() };
});

it('refetches when the selected skill changes', async () => {
  vi.mocked(getCompetencyGapTrend).mockResolvedValue({
    year: 2026,
    moduleId: 7,
    skillId: null,
    quarters: [],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { rerender } = renderHook(
    ({ skillId }: { skillId?: number }) => useCompetencyGapTrend({
      year: 2026,
      moduleId: 7,
      skillId,
    }),
    { wrapper, initialProps: { skillId: undefined } },
  );
  await waitFor(() => expect(getCompetencyGapTrend).toHaveBeenCalledTimes(1));
  rerender({ skillId: 21 });
  await waitFor(() => expect(getCompetencyGapTrend).toHaveBeenLastCalledWith({
    year: 2026,
    moduleId: 7,
    skillId: 21,
  }));
});
```

- [ ] **Step 2: Run client/hook tests and verify RED**

Run: `npm test -- --run src/lib/__tests__/competencyApi.test.ts src/hooks/__tests__/useCompetencyGapTrend.test.tsx`

Expected: missing exports cause FAIL.

- [ ] **Step 3: Implement types, client and hook**

```typescript
export interface GapTrendFilters {
  year: number;
  moduleId?: number;
  skillId?: number;
}

export interface CompetencyGapTrendPoint {
  quarter: 1 | 2 | 3 | 4;
  label: string;
  totalGap: number;
  hasData: boolean;
}

export interface CompetencyGapTrendResponse {
  year: number;
  moduleId: number | null;
  skillId: number | null;
  quarters: CompetencyGapTrendPoint[];
}

export async function getCompetencyGapTrend(filters: GapTrendFilters) {
  const response = await apiClient.get('/competency-assessments/gap-trend', {
    params: {
      year: filters.year,
      module_id: filters.moduleId,
      skill_id: filters.skillId,
    },
  });
  return response.data as CompetencyGapTrendResponse;
}
```

The hook query key is `['competency-gap-trend', year, moduleId ?? null, skillId ?? null]` and the query function calls the client above.

- [ ] **Step 4: Run client/hook tests**

Run: `npm test -- --run src/lib/__tests__/competencyApi.test.ts src/hooks/__tests__/useCompetencyGapTrend.test.tsx`

Expected: all tests PASS.

- [ ] **Step 5: Commit frontend trend state**

```powershell
git add src/lib/competencyApi.ts src/lib/__tests__/competencyApi.test.ts src/hooks/useCompetencyGapTrend.ts src/hooks/__tests__/useCompetencyGapTrend.test.tsx
git commit -m "feat: query competency GAP trend"
```

---

### Task 6: Build the team Gap Analysis component

**Files:**
- Create: `src/components/competency/TeamGapAnalysis.tsx`
- Create: `src/components/competency/__tests__/TeamGapAnalysis.test.tsx`
- Modify: `src/pages/Competency.tsx:35-220,340-670`

**Interfaces:**
- Consumes: current `assessments`, active `skills`, active `employees`, `year`, module/skill statistics and `EmployeeModuleGapMatrix` summary.
- Produces: four full-width cards: total distribution, per-person distribution, quarter trend, employee/module GAP summary.

- [ ] **Step 1: Write component behavior tests**

Mock Recharts to simple semantic containers and mock `useCompetencyGapTrend`. Assert:

```typescript
expect(screen.queryByRole('button', { name: /排名 Ranking/ })).not.toBeInTheDocument();
expect(screen.getByRole('heading', { name: /差距分布 Gap Distribution/ })).toBeInTheDocument();
expect(screen.getByRole('heading', { name: /人员 GAP 分配/ })).toBeInTheDocument();
expect(screen.getByRole('heading', { name: /季度总 GAP 趋势/ })).toBeInTheDocument();
expect(screen.getByRole('heading', { name: /工程师模块 GAP 汇总/ })).toBeInTheDocument();
expect(screen.queryByText('平均 GAP')).not.toBeInTheDocument();
expect(screen.queryByText('排名')).not.toBeInTheDocument();
```

Add a filter test: select module 7, then skill 21, switch to module 1, and assert the skill select resets to `all`.

- [ ] **Step 2: Run the team component test and verify RED**

Run: `npm test -- --run src/components/competency/__tests__/TeamGapAnalysis.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the four-card component**

Use local state:

```typescript
const [distributionDimension, setDistributionDimension] = useState<'module' | 'skill'>('module');
const [distributionItemId, setDistributionItemId] = useState<number>(MODULE_MAPPING[1].id);
const [trendModuleId, setTrendModuleId] = useState<number | undefined>();
const [trendSkillId, setTrendSkillId] = useState<number | undefined>();
```

Render only `totalGap` in Gap Distribution. Build per-person bars with `calculateEmployeeGapDistribution`; render every active employee, show `暂无评估` when `hasData` is false, and use GAP-desc/name-asc order from the aggregator. Trend filters must reset incompatible skills, call `useCompetencyGapTrend`, show a card-local retry on error, and label `hasData: false` as `暂无历史基线`. Render the summary table without a rank header or cell and keep its module/team total footer.

In `Competency.tsx`, reduce `SubViewMode` to `'analysis' | 'total-score'`, remove ranking imports/state/branch, query `getAssessmentMatrix()` so active employees and all active skill columns are available, and pass the mapped active scope into this component. Remove the `level > 0` filters from the page-level current and target KPI calculation so valid zero values use the same denominator as module averages.

- [ ] **Step 4: Run component and aggregation tests**

Run: `npm test -- --run src/components/competency/__tests__/TeamGapAnalysis.test.tsx src/lib/__tests__/competencyAggregation.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Commit team analysis UI**

```powershell
git add src/components/competency/TeamGapAnalysis.tsx src/components/competency/__tests__/TeamGapAnalysis.test.tsx src/pages/Competency.tsx
git commit -m "feat: redesign team competency GAP analysis"
```

---

### Task 7: Build average-score and personal total-GAP views

**Files:**
- Create: `src/components/competency/TotalScoreView.tsx`
- Create: `src/components/competency/PersonalGapAnalysis.tsx`
- Create: `src/components/competency/__tests__/TotalScoreView.test.tsx`
- Create: `src/components/competency/__tests__/PersonalGapAnalysis.test.tsx`
- Modify: `src/pages/Competency.tsx:670-1140`

**Interfaces:**
- Consumes: `ModuleStats[]`, `PersonalModuleStats[]`, personal skills, selected employee and current chart dimension.
- Produces: 0–4 average-score charts with labels; personal module total GAP with no average GAP column.

- [ ] **Step 1: Write Total Score and personal view tests**

The Total Score test must assert both chart series use `avgCurrent`/`avgTarget`, both axes receive domain `[0, 4]`, value labels contain one decimal, and the KPI headings remain. The personal test must assert:

```typescript
expect(screen.getByRole('columnheader', { name: '总 GAP' })).toBeInTheDocument();
expect(screen.queryByRole('columnheader', { name: '平均 GAP' })).not.toBeInTheDocument();
expect(screen.getByTestId('personal-module-gap-1')).toHaveTextContent('3');
```

- [ ] **Step 2: Run both view tests and verify RED**

Run: `npm test -- --run src/components/competency/__tests__/TotalScoreView.test.tsx src/components/competency/__tests__/PersonalGapAnalysis.test.tsx`

Expected: FAIL because the extracted components do not exist.

- [ ] **Step 3: Implement average-score labels and personal totals**

Total Score chart data must be exactly:

```typescript
const chartData = moduleStats.map(module => ({
  module: module.moduleName,
  currentAverage: Number(module.avgCurrent.toFixed(1)),
  targetAverage: Number(module.avgTarget.toFixed(1)),
}));
```

Use `[0, 4]` on both `PolarRadiusAxis` and bar `YAxis`. Put `LabelList` on both bars. For Radar labels, use two custom label renderers with different radial offsets and blue/orange fill; when coordinates are unavailable return `null`. Keep existing total KPI calculations and total detail table based on `totalCurrent`, `totalTarget`, and `totalGap`.

In Personal Gap Analysis, module bars use `module.totalGap`; skill bars use `skill.gap`. Sort module summaries by `totalGap` descending, remove the average column and preserve total GAP, skill count and status.

- [ ] **Step 4: Integrate components and run view tests**

Run: `npm test -- --run src/components/competency/__tests__/TotalScoreView.test.tsx src/components/competency/__tests__/PersonalGapAnalysis.test.tsx`

Expected: all tests PASS.

- [ ] **Step 5: Commit Total Score and personal views**

```powershell
git add src/components/competency/TotalScoreView.tsx src/components/competency/PersonalGapAnalysis.tsx src/components/competency/__tests__/TotalScoreView.test.tsx src/components/competency/__tests__/PersonalGapAnalysis.test.tsx src/pages/Competency.tsx
git commit -m "feat: show module averages and personal total GAP"
```

---

### Task 8: Complete verification, OpenSpec tracking and Jetson deployment

**Files:**
- Modify: `openspec/changes/update-competency-profile-analytics/tasks.md`
- Create: `docs/verification/2026-07-15-competency-profile-analytics.md`
- Create: browser screenshots under `docs/verification/`

**Interfaces:**
- Consumes: completed Tasks 1–7 and existing `Jetson CI/CD Pipeline`.
- Produces: passing local evidence, checked OpenSpec tasks, successful DEV Actions run, healthy Jetson and browser evidence.

- [ ] **Step 1: Run focused automated tests**

Run:

```powershell
npm test -- --run src/lib/__tests__/competencyAggregation.test.ts src/lib/__tests__/competencyApi.test.ts src/hooks/__tests__/useCompetencyGapTrend.test.tsx src/components/__tests__/AssessmentEditDialog.test.tsx src/components/competency/__tests__/TeamGapAnalysis.test.tsx src/components/competency/__tests__/TotalScoreView.test.tsx src/components/competency/__tests__/PersonalGapAnalysis.test.tsx
cd backend
..\.venv\Scripts\python.exe -m pytest tests/test_competency_level_0_4_migration.py tests/test_competency_gap_trend.py tests/test_competency_assessment_routes.py tests/test_competency_assessment_history.py -q
cd ..
```

Expected: every selected test PASS.

- [ ] **Step 2: Run full static and build verification**

Run:

```powershell
npm run typecheck
npm run lint
npm run build
cd backend
..\.venv\Scripts\python.exe -m pytest tests/ -q
cd ..
openspec validate update-competency-profile-analytics --strict
git diff --check
```

Expected: typecheck/build/OpenSpec/diff checks exit 0; all relevant tests pass. Record any unrelated pre-existing lint or integration failures separately and do not hide them.

- [ ] **Step 3: Mark OpenSpec tasks complete and write verification evidence**

Update every actually completed checkbox in `openspec/changes/update-competency-profile-analytics/tasks.md` to `[x]`. The verification document must record commands, pass counts, migration preflight result, current/target level-5 count, screenshots, Actions URL and Jetson health response.

- [ ] **Step 4: Commit implementation evidence**

```powershell
git add openspec/changes/update-competency-profile-analytics/tasks.md docs/verification/2026-07-15-competency-profile-analytics.md docs/verification/*.png
git commit -m "docs: verify competency profile analytics"
```

- [ ] **Step 5: Push DEV and monitor GitHub Actions**

Run: `git push origin DEV`

Expected: `Jetson CI/CD Pipeline` starts for the pushed implementation commit. Monitor both test and deploy jobs until completion; if the self-hosted runner loses communication, inspect Jetson resources/runner service before re-running the failed job.

- [ ] **Step 6: Verify Jetson in Firefox**

Open `http://10.70.80.183:3000/` and verify:

- Ability Assessment offers only 0–4 and saving 5 through API returns 422.
- Ability Profile has no Ranking tab and no duplicate Gap Analysis radar.
- Gap Distribution contains only total GAP.
- Personnel distribution filters and zero-data employees behave correctly.
- Trend shows Q1–Q4, linked filters, labels and no-baseline Tooltip.
- Total Score charts use 0–4 module averages with visible data labels.
- Personal module summary contains total GAP and no average GAP.
- Employee/module GAP summary retains personal, module and team totals with no ranks.

Capture screenshots and append the final Actions run URL and `GET /api/health` result to the verification document.

---

## Plan Self-Review

- Spec coverage: Tasks 2, 6 and 7 cover requirements 4.1–4.5 and 4.7; Tasks 4–6 cover 4.6; Task 1 and Task 2 cover the confirmed 0–4 cross-module change; Task 8 covers deployment and visual acceptance.
- Type consistency: trend response uses camel-case `moduleId`, `skillId`, `totalGap`, `hasData` end-to-end; query parameters remain snake-case. Current employee scope and distribution interfaces are defined in Task 3 and consumed in Task 6.
- Data consistency: active employees and skills come from `/matrix`; current values come from `/full`; historical aggregates come only from `/gap-trend`.
- Scope: no historical organization membership, multi-series trend, new dependency or unrelated refactor is included.
