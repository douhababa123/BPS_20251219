# Schedule Half-Day Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display AM tasks in the invisible left half of a calendar date cell, PM tasks in the invisible right half, and FULL_DAY tasks at full width without regressing connected task bands.

**Architecture:** Add a pure lane-packing function to `scheduleRules.ts`, then render its output through a focused `CalendarDayTasks` component shared by assigned and unassigned rows. The date-cell renderer uses a two-column CSS grid with no visible divider; existing connected-segment metadata remains the source for ordering, labels, and edge connections.

**Tech Stack:** React 18.3, TypeScript 5.5, TailwindCSS 3.4, Vitest, React Testing Library, Playwright/Firefox for visual verification.

## Global Constraints

- The left/right halves are equal 50 percent widths; do not use 3.5h/4.5h proportional widths.
- Do not render a half-cell divider, separate background, border, heading, or time scale.
- AM uses the left half, PM uses the right half, and FULL_DAY spans the complete cell width.
- Multiple tasks in the same half stack vertically; one AM and one PM task may share a lane.
- Connected fragments remain 26px high, use stable lanes, and display text only on the leftmost fragment.
- Do not change backend APIs, database records, time-slot values, or workload calculations.

---

### Task 1: Pure calendar lane packing

**Files:**
- Modify: `src/lib/scheduleRules.ts`
- Test: `src/lib/__tests__/scheduleRules.test.ts`

**Interfaces:**
- Consumes: `sortCalendarTasks(tasks, date, segments)` and `ContinuousTaskSegmentMeta` from `src/lib/scheduleRules.ts`.
- Produces: `buildCalendarTaskLayout<T>(tasks, date, segments): CalendarTaskLayout<T>[]`.

- [ ] **Step 1: Write failing tests for slot columns and lane pairing**

Add imports for `buildCalendarTaskLayout` and `ContinuousTaskSegmentMeta`, then add these tests:

```ts
it('pairs AM and PM in one lane and gives FULL_DAY an exclusive full-width lane', () => {
  const am = task({ id: '1-am', time_slot: 'AM' });
  const pm = task({ id: '2-pm', time_slot: 'PM' });
  const full = task({ id: '3-full', task_name: 'Full', time_slot: 'FULL_DAY' });
  const segments = buildContinuousTaskSegments([am, pm, full]);

  expect(buildCalendarTaskLayout([am, pm, full], '2026-07-01', segments)).toEqual([
    { task: am, row: 0, column: 'am' },
    { task: pm, row: 0, column: 'pm' },
    { task: full, row: 1, column: 'full' },
  ]);
});

it('stacks tasks in the same half on separate lanes', () => {
  const first = task({ id: 'am-1', task_name: 'A', time_slot: 'AM' });
  const second = task({ id: 'am-2', task_name: 'B', time_slot: 'AM' });
  const segments = buildContinuousTaskSegments([first, second]);

  expect(buildCalendarTaskLayout([first, second], '2026-07-01', segments).map(({ row, column }) => ({ row, column }))).toEqual([
    { row: 0, column: 'am' },
    { row: 1, column: 'am' },
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/lib/__tests__/scheduleRules.test.ts
```

Expected: FAIL because `buildCalendarTaskLayout` is not exported.

- [ ] **Step 3: Implement the typed lane builder**

Add:

```ts
export type CalendarTaskColumn = 'am' | 'pm' | 'full';

export interface CalendarTaskLayout<T> {
  task: T;
  row: number;
  column: CalendarTaskColumn;
}

interface CalendarTaskLane<T> {
  am?: T;
  pm?: T;
  full?: T;
}

export function buildCalendarTaskLayout<T extends ScheduleTaskForContinuity>(
  tasks: T[],
  date: string,
  segments: Map<string, ContinuousTaskSegmentMeta>
): CalendarTaskLayout<T>[] {
  const lanes: CalendarTaskLane<T>[] = [];
  const visibleTasks = sortCalendarTasks(tasks, date, segments)
    .filter((task) => !segments.get(`${task.id}|${date}`)?.hidden);

  const result: CalendarTaskLayout<T>[] = [];
  visibleTasks.forEach((task) => {
    const slot = task.time_slot || 'FULL_DAY';
    if (slot === 'FULL_DAY') {
      const row = lanes.length;
      lanes.push({ full: task });
      result.push({ task, row, column: 'full' });
      return;
    }

    const column = slot === 'AM' ? 'am' : 'pm';
    let row = lanes.findIndex((lane) => !lane.full && !lane[column]);
    if (row === -1) {
      row = lanes.length;
      lanes.push({});
    }
    lanes[row][column] = task;
    result.push({ task, row, column });
  });

  return result.sort((left, right) => left.row - right.row || left.column.localeCompare(right.column));
}
```

- [ ] **Step 4: Add hidden-fragment and connected-lane coverage**

Add these tests:

```ts
it('excludes fragments marked hidden by the continuous segment map', () => {
  const visible = task({ id: 'visible', time_slot: 'AM' });
  const hidden = task({ id: 'hidden', time_slot: 'PM' });
  const segments = new Map([
    ['visible|2026-07-01', { position: 'start', continuousHours: 11.5, showLabel: true, groupId: 'group' }],
    ['hidden|2026-07-01', { position: 'start', continuousHours: 11.5, showLabel: false, groupId: 'group', hidden: true }],
  ] satisfies Array<[string, ContinuousTaskSegmentMeta]>);

  expect(buildCalendarTaskLayout([visible, hidden], '2026-07-01', segments).map(({ task }) => task.id)).toEqual([
    'visible',
  ]);
});

it('keeps a connected group on row zero across dates with different daily tasks', () => {
  const connected = task({ id: 'connected', start_date: '2026-07-01', end_date: '2026-07-02', time_slot: 'FULL_DAY' });
  const firstDaily = task({ id: 'first-daily', task_name: 'First daily', start_date: '2026-07-01', end_date: '2026-07-01' });
  const secondDaily = task({ id: 'second-daily', task_name: 'Second daily', start_date: '2026-07-02', end_date: '2026-07-02' });
  const segments = buildContinuousTaskSegments([connected, firstDaily, secondDaily]);

  const firstRow = buildCalendarTaskLayout([firstDaily, connected], '2026-07-01', segments)
    .find(({ task }) => task.id === 'connected')?.row;
  const secondRow = buildCalendarTaskLayout([secondDaily, connected], '2026-07-02', segments)
    .find(({ task }) => task.id === 'connected')?.row;

  expect([firstRow, secondRow]).toEqual([0, 0]);
});
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
npm test -- src/lib/__tests__/scheduleRules.test.ts
```

Expected: all schedule-rule tests pass.

- [ ] **Step 6: Commit the rule layer**

```powershell
git add src/lib/scheduleRules.ts src/lib/__tests__/scheduleRules.test.ts
git commit -m "feat: add half-day calendar lane layout"
```

### Task 2: Reusable invisible two-column date-cell renderer

**Files:**
- Create: `src/components/CalendarDayTasks.tsx`
- Create: `src/components/__tests__/CalendarDayTasks.test.tsx`
- Modify: `src/components/TaskCard.tsx`

**Interfaces:**
- Consumes: `buildCalendarTaskLayout`, `ContinuousTaskSegmentMeta`, and `TaskCardCompact`.
- Produces: `CalendarDayTasks({ tasks, date, segments, onTaskClick })`.

- [ ] **Step 1: Export the compact task shape**

Rename the anonymous task shape in `TaskCardProps` to an exported `TaskCardTask` interface without changing its fields or runtime behavior:

```ts
export interface TaskCardTask {
  id: string;
  task_name: string;
  task_type: string;
  competence?: string;
  status?: 'planned' | 'in_progress' | 'completed' | 'cancelled'
         | 'pending_approval' | 'rejected' | 'confirmed' | 'employee_rejected';
  time_slot?: TimeSlot;
  total_hours?: number;
  employee_name?: string;
  start_date?: string;
  end_date?: string;
}
```

- [ ] **Step 2: Write the failing renderer test**

Render one AM task, one PM task, and one FULL_DAY task. Assert their wrappers expose `data-calendar-column="am|pm|full"`, that AM/PM share `gridRow: 1`, and that FULL_DAY uses `gridColumn: 1 / 3` on the next row. Also assert the root has `grid-cols-2` and no gap/divider classes.

- [ ] **Step 3: Run the renderer test and verify RED**

```powershell
npm test -- src/components/__tests__/CalendarDayTasks.test.tsx
```

Expected: FAIL because `CalendarDayTasks` does not exist.

- [ ] **Step 4: Implement `CalendarDayTasks`**

Use this structure:

```tsx
export type CalendarDayTask = TaskCardTask & ScheduleTaskForContinuity;

export function CalendarDayTasks({ tasks, date, segments, onTaskClick }: CalendarDayTasksProps) {
  const layout = buildCalendarTaskLayout(tasks, date, segments);
  return (
    <div className="grid grid-cols-2 auto-rows-[30px]" data-testid="calendar-day-tasks">
      {layout.map(({ task, row, column }) => (
        <div
          key={task.id}
          className="task-card-compact min-w-0"
          data-calendar-column={column}
          style={{
            gridRow: row + 1,
            gridColumn: column === 'full' ? '1 / 3' : column === 'am' ? '1 / 2' : '2 / 3',
          }}
        >
          <TaskCardCompact
            task={task}
            segmentMeta={segments.get(`${task.id}|${date}`)}
            onClick={() => onTaskClick(task)}
          />
        </div>
      ))}
    </div>
  );
}
```

Do not add `gap-*`, column borders, backgrounds, AM/PM headings, or visible sub-cell elements.

- [ ] **Step 5: Verify card behavior and renderer tests**

```powershell
npm test -- src/components/__tests__/CalendarDayTasks.test.tsx src/components/__tests__/TaskCard.test.tsx
```

Expected: all component tests pass; connected middle cards remain blank and 26px high.

- [ ] **Step 6: Commit the renderer**

```powershell
git add src/components/CalendarDayTasks.tsx src/components/__tests__/CalendarDayTasks.test.tsx src/components/TaskCard.tsx
git commit -m "feat: render half-day tasks in invisible columns"
```

### Task 3: Team calendar integration

**Files:**
- Modify: `src/pages/Schedule.tsx`
- Test: `src/components/__tests__/CalendarDayTasks.test.tsx`

**Interfaces:**
- Consumes: `CalendarDayTasks` from Task 2.
- Produces: assigned and unassigned calendar cells with identical AM/PM/full-day behavior.

- [ ] **Step 1: Replace both duplicated task loops**

Import `CalendarDayTasks`. In both assigned and unassigned `<td>` elements, replace the `sortCalendarTasks(...).map(...)` block with:

```tsx
<CalendarDayTasks
  tasks={dayTasks}
  date={dateStr}
  segments={continuousSegments}
  onTaskClick={setSelectedTask}
/>
```

Remove the now-unused `sortCalendarTasks` import from `Schedule.tsx`. Keep the `<td>` classes and double-click guard unchanged so the half-cell grid remains invisible.

- [ ] **Step 2: Add click and tooltip regression assertions**

In `CalendarDayTasks.test.tsx`, click AM and PM cards independently and assert `onTaskClick` receives the correct task. Assert a truncated half-width card still has a `title` containing the complete task name and time slot.

- [ ] **Step 3: Run schedule and component tests**

```powershell
npm test -- src/components/__tests__/CalendarDayTasks.test.tsx src/components/__tests__/TaskCard.test.tsx src/pages/__tests__/ScheduleTaskForm.test.tsx
npm run typecheck
```

Expected: all selected tests and TypeScript checking pass.

- [ ] **Step 4: Commit integration**

```powershell
git add src/pages/Schedule.tsx src/components/__tests__/CalendarDayTasks.test.tsx
git commit -m "feat: position schedule tasks by half day"
```

### Task 4: Full verification, Firefox QA, and deployment

**Files:**
- Modify: `openspec/changes/update-calendar-half-day-positioning/tasks.md`
- No production files should change during this task unless verification finds a defect.

**Interfaces:**
- Consumes: completed implementation from Tasks 1–3.
- Produces: verified `DEV` deployment on Jetson.

- [ ] **Step 1: Run full automated verification**

```powershell
npm test
npm run typecheck
npm run build
npx eslint src/lib/scheduleRules.ts src/lib/__tests__/scheduleRules.test.ts src/components/CalendarDayTasks.tsx src/components/__tests__/CalendarDayTasks.test.tsx src/components/TaskCard.tsx
openspec validate update-calendar-half-day-positioning --strict
```

Expected: all commands exit `0`; build warnings about bundle size may remain informational.

- [ ] **Step 2: Run Firefox visual acceptance locally with Jetson data**

Use the authenticated Firefox session and July 2026 schedule data. Verify:

```text
AM: left half only
PM: right half only
FULL_DAY: complete width
AM + PM: one shared lane
two AM tasks: stacked in left half
partition: no visible divider/background/heading
connected >8h: equal 26px height, stable y coordinate, label only on leftmost fragment
```

Capture a screenshot and inspect computed bounding boxes before marking OpenSpec verification tasks complete.

- [ ] **Step 3: Update the OpenSpec checklist and commit**

Mark sections 1–3 complete, leaving deployment unchecked until the workflow succeeds:

```powershell
git add openspec/changes/update-calendar-half-day-positioning/tasks.md
git commit -m "docs: verify half-day calendar positioning"
```

- [ ] **Step 4: Push `DEV` and monitor deployment**

```powershell
git push origin DEV
```

Confirm the workflow run for the implementation SHA has both jobs successful:

```text
代码质量检查: success
部署到 Jetson: success
```

- [ ] **Step 5: Verify the deployed Jetson page in Firefox**

Refresh `http://10.70.80.183:3000/`, repeat the visual acceptance list, and confirm no console errors related to the calendar renderer.

- [ ] **Step 6: Record deployment completion**

Mark deployment tasks complete and commit the docs-only checklist update:

```powershell
git add openspec/changes/update-calendar-half-day-positioning/tasks.md
git commit -m "docs: record half-day calendar deployment"
git push origin DEV
```
