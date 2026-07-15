# Schedule Vertical Task Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace horizontal half-day cards with 100px full-width vertical AM/PM lanes, complete wrapped task names, and connected cross-day fragments whose later segments match the first segment's measured height.

**Architecture:** Keep the current table and per-date `CalendarDayTasks` component, but change its pure layout metadata from two columns to ordered vertical sections. `Schedule` owns a `groupId -> measuredHeight` registry shared by every date cell; the first connected fragment reports its rendered height from `TaskCardCompact`, and all fragments consume the shared height. No task records, continuity rules, hour calculations, APIs, or database structures change.

**Tech Stack:** React 18, TypeScript 5.5, TailwindCSS 3.4, Vitest, React Testing Library, Vite 5.4, Firefox/Playwright for visual verification.

## Global Constraints

- Date header and body cells use a minimum width of exactly `100px`.
- Display order is connected/FULL_DAY tasks, then AM tasks, then PM tasks.
- AM and PM cards occupy the full usable date-cell width; no visible AM/PM sub-grid is rendered.
- Every visible task name is complete and wraps naturally; it is not truncated or line-clamped.
- A connected task shows name, total continuous hours, and status only in its first fragment.
- Middle/end connected fragments remain empty, connect without visible gaps, and use the first fragment's measured height.
- Existing task identity, time-slot hours (AM 3.5h, PM 4.5h, FULL_DAY 8h), click, hover, double-click-to-add, API, and database behavior remain unchanged.
- Work must be test-first, with a failing test observed before each production-code task.

---

### Task 1: Align OpenSpec with the approved vertical design

**Files:**
- Modify: `openspec/changes/update-calendar-half-day-positioning/proposal.md`
- Modify: `openspec/changes/update-calendar-half-day-positioning/design.md`
- Modify: `openspec/changes/update-calendar-half-day-positioning/specs/schedule-management/spec.md`
- Modify: `openspec/changes/update-calendar-half-day-positioning/tasks.md`

**Interfaces:**
- Consumes: approved design in `docs/superpowers/specs/2026-07-14-schedule-half-day-positioning-design.md`.
- Produces: the normative `Vertical half-day task positioning and complete labels` requirement and an unchecked implementation checklist used by Tasks 2-5.

- [ ] **Step 1: Replace the horizontal requirement with the complete vertical requirement**

Write the spec delta with the following scenarios and normative behavior:

```markdown
## ADDED Requirements

### Requirement: Vertical half-day task positioning and complete labels

The system SHALL render calendar tasks in full-width vertical time-slot order and SHALL display every visible task name in full.

#### Scenario: Morning and afternoon tasks
- **WHEN** a date contains AM and PM tasks
- **THEN** every card occupies the complete usable width of the date cell
- **AND** AM cards appear above PM cards
- **AND** no visible AM/PM sub-grid is rendered

#### Scenario: Complete ordinary task name
- **WHEN** a task name exceeds the available width of its 100px-minimum date column
- **THEN** the name wraps without truncation or line clamping
- **AND** the task card and engineer row grow to contain the complete name

#### Scenario: Connected task label and height
- **WHEN** a connected task crosses one or more date boundaries
- **THEN** its first fragment wraps the complete task name within the first date cell
- **AND** middle and end fragments omit repeated text
- **AND** every fragment uses the measured height of the first fragment
- **AND** adjacent fragments connect without a visible gap

#### Scenario: Complete interactions
- **WHEN** any ordinary or connected task fragment is clicked or hovered
- **THEN** clicking opens the same task detail behavior as before
- **AND** hover information exposes complete task details
```

- [ ] **Step 2: Update proposal, design, and checklist language**

Replace references to left/right 50% columns with:

```markdown
- 100px minimum date columns
- full-width single-column date-cell task flow
- connected/FULL_DAY -> AM -> PM ordering
- complete name wrapping and natural row growth
- first-fragment measurement shared with connected middle/end fragments
```

Add Task 5 checklist items for full validation, Firefox verification, DEV merge, GitHub Actions, and Jetson recheck, all initially unchecked.

- [ ] **Step 3: Validate the updated change**

Run:

```powershell
openspec validate update-calendar-half-day-positioning --strict
```

Expected: `Change 'update-calendar-half-day-positioning' is valid`.

- [ ] **Step 4: Commit the approved specification**

```powershell
git add openspec/changes/update-calendar-half-day-positioning docs/superpowers/specs/2026-07-14-schedule-half-day-positioning-design.md
git commit -m "docs: specify vertical calendar task layout"
```

### Task 2: Replace half-day column allocation with vertical ordering

**Files:**
- Modify: `src/lib/scheduleRules.ts`
- Modify: `src/lib/__tests__/scheduleRules.test.ts`

**Interfaces:**
- Consumes: `ScheduleTaskForContinuity`, `ContinuousTaskSegmentMeta`, and `sortCalendarTasks` from `src/lib/scheduleRules.ts`.
- Produces: `CalendarTaskSection`, `CalendarTaskLayout<T>`, and `buildCalendarTaskLayout<T>(tasks, date, segments)` with ordered vertical rows.

- [ ] **Step 1: Write failing vertical-order tests**

Replace column assertions with the following behavior:

```typescript
it('orders connected/full-day, AM, then PM as full-width vertical rows', () => {
  const tasks = [
    task({ id: 'pm', time_slot: 'PM' }),
    task({ id: 'am', time_slot: 'AM' }),
    task({ id: 'full', time_slot: 'FULL_DAY' }),
  ];

  expect(buildCalendarTaskLayout(tasks, '2026-07-15', new Map())).toEqual([
    expect.objectContaining({ task: tasks[2], row: 0, section: 'full' }),
    expect.objectContaining({ task: tasks[1], row: 1, section: 'am' }),
    expect.objectContaining({ task: tasks[0], row: 2, section: 'pm' }),
  ]);
});

it('places connected fragments before ordinary full-day tasks', () => {
  const connected = task({ id: 'connected', time_slot: 'FULL_DAY' });
  const full = task({ id: 'full', time_slot: 'FULL_DAY' });
  const segments = new Map([
    ['connected|2026-07-15', {
      position: 'start' as const,
      continuousHours: 32,
      showLabel: true,
      groupId: 'group-a',
    }],
  ]);

  expect(buildCalendarTaskLayout([full, connected], '2026-07-15', segments).map(item => item.task.id))
    .toEqual(['connected', 'full']);
});
```

Keep the existing tests that hidden fragments are excluded and same-slot tasks have stable ordering.

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```powershell
npm test -- --run src/lib/__tests__/scheduleRules.test.ts
```

Expected: FAIL because the current result exposes `column: 'am' | 'pm' | 'full'` and pairs AM/PM into the same row.

- [ ] **Step 3: Implement the minimal vertical layout metadata**

Use these types and ordering rules:

```typescript
export type CalendarTaskSection = 'connected' | 'full' | 'am' | 'pm';

export interface CalendarTaskLayout<T> {
  task: T;
  row: number;
  section: CalendarTaskSection;
}

export function buildCalendarTaskLayout<T extends ScheduleTaskForContinuity>(
  tasks: T[],
  date: string,
  segments: Map<string, ContinuousTaskSegmentMeta>
): CalendarTaskLayout<T>[] {
  const visibleTasks = sortCalendarTasks(tasks, date, segments)
    .filter((task) => !segments.get(`${task.id}|${date}`)?.hidden);

  return visibleTasks
    .map((task) => {
      const segment = segments.get(`${task.id}|${date}`);
      const section: CalendarTaskSection = segment && segment.position !== 'single'
        ? 'connected'
        : (task.time_slot || 'FULL_DAY') === 'FULL_DAY'
          ? 'full'
          : task.time_slot === 'AM'
            ? 'am'
            : 'pm';
      return { task, section };
    })
    .sort((left, right) => {
      const rank = { connected: 0, full: 1, am: 2, pm: 3 } as const;
      return rank[left.section] - rank[right.section]
        || left.task.id.localeCompare(right.task.id);
    })
    .map((item, row) => ({ ...item, row }));
}
```

- [ ] **Step 4: Run focused tests and type checking**

```powershell
npm test -- --run src/lib/__tests__/scheduleRules.test.ts
npm run typecheck
```

Expected: all focused tests pass and `tsc` exits 0.

- [ ] **Step 5: Commit the vertical layout rule**

```powershell
git add src/lib/scheduleRules.ts src/lib/__tests__/scheduleRules.test.ts
git commit -m "feat: order calendar tasks vertically"
```

### Task 3: Wrap complete task names and measure connected first fragments

**Files:**
- Modify: `src/components/TaskCard.tsx`
- Modify: `src/components/__tests__/TaskCard.test.tsx`

**Interfaces:**
- Consumes: `ContinuousTaskSegmentMeta` and the existing `TaskCardTask`.
- Produces additions to `TaskCardProps`: `continuousHeight?: number` and `onContinuousHeightChange?: (groupId: string, height: number) => void`.

- [ ] **Step 1: Write failing wrapping and measurement tests**

Add tests with an explicit `ResizeObserver` stub:

```typescript
it('wraps the complete task name and renders metadata below it', () => {
  const { container } = render(
    <TaskCardCompact task={{ ...baseTask, task_name: 'Complete long task name', time_slot: 'AM', total_hours: 3.5 }} />
  );

  expect(screen.getByText('Complete long task name')).toHaveClass('whitespace-normal', 'break-words');
  expect(screen.getByText(/上午.*3.5h/)).toBeInTheDocument();
  expect(container.firstElementChild).not.toHaveClass('h-[26px]');
});

it('reports the first connected fragment height and applies the shared height', () => {
  const onHeight = vi.fn();
  const { container, rerender } = render(
    <TaskCardCompact
      task={baseTask}
      segmentMeta={{ position: 'start', continuousHours: 32, showLabel: true, groupId: 'group-a' }}
      onContinuousHeightChange={onHeight}
    />
  );
  const content = container.querySelector('[data-task-card-content]') as HTMLElement;
  vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({ height: 58 } as DOMRect);
  fireEvent(window, new Event('resize'));
  expect(onHeight).toHaveBeenCalledWith('group-a', 68);

  rerender(
    <TaskCardCompact
      task={baseTask}
      segmentMeta={{ position: 'middle', continuousHours: 32, showLabel: false, groupId: 'group-a' }}
      continuousHeight={68}
    />
  );
  expect(container.firstElementChild).toHaveStyle({ height: '68px' });
});
```

- [ ] **Step 2: Run the component test and observe RED**

```powershell
npm test -- --run src/components/__tests__/TaskCard.test.tsx
```

Expected: FAIL because the card still truncates names, fixes height at 26px, and has no measurement props.

- [ ] **Step 3: Implement complete wrapping and secondary metadata**

Update `TaskCardProps` and render visible content as:

```tsx
interface TaskCardProps {
  task: TaskCardTask;
  onClick?: () => void;
  className?: string;
  showEmployee?: boolean;
  segmentMeta?: ContinuousTaskSegmentMeta;
  continuousHeight?: number;
  onContinuousHeightChange?: (groupId: string, height: number) => void;
}

<div ref={contentRef} data-task-card-content>
  <div className="whitespace-normal break-words font-medium group-hover:font-semibold">
    {task.task_name}
  </div>
  <div className="mt-1 text-[9px] leading-tight opacity-80">
    {timeSlotLabel} · {displayHours}h · {statusConfig.label}
  </div>
</div>
```

Render that block only when `showLabel` is true. Middle/end fragments remain empty.

- [ ] **Step 4: Implement first-fragment measurement and shared height application**

Import `useCallback`, `useLayoutEffect`, and `useRef`, then use:

```typescript
const contentRef = useRef<HTMLDivElement>(null);
const isConnected = !!segmentMeta && segmentMeta.position !== 'single';

const reportNaturalHeight = useCallback(() => {
  if (!isConnected || !segmentMeta?.showLabel || !contentRef.current || !onContinuousHeightChange) return;
  const contentHeight = Math.ceil(contentRef.current.getBoundingClientRect().height);
  onContinuousHeightChange(segmentMeta.groupId, Math.max(26, contentHeight + 10));
}, [isConnected, onContinuousHeightChange, segmentMeta]);

useLayoutEffect(() => {
  reportNaturalHeight();
  window.addEventListener('resize', reportNaturalHeight);
  const observer = contentRef.current && typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(reportNaturalHeight)
    : null;
  if (contentRef.current) observer?.observe(contentRef.current);
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', reportNaturalHeight);
  };
}, [reportNaturalHeight]);
```

Remove `h-[26px]` and `truncate`. Apply:

```typescript
style={{
  backgroundColor: hexColor,
  borderColor: borderStyle,
  color: textColor,
  height: isConnected && continuousHeight ? continuousHeight : undefined,
  minHeight: 26,
}}
```

- [ ] **Step 5: Run TaskCard and CalendarDayTasks tests**

```powershell
npm test -- --run src/components/__tests__/TaskCard.test.tsx src/components/__tests__/CalendarDayTasks.test.tsx
npm run typecheck
```

Expected: all tests pass and no TypeScript errors.

- [ ] **Step 6: Commit complete-name cards**

```powershell
git add src/components/TaskCard.tsx src/components/__tests__/TaskCard.test.tsx
git commit -m "feat: wrap complete calendar task names"
```

### Task 4: Integrate vertical cells, 100px columns, and cross-date height sharing

**Files:**
- Modify: `src/components/CalendarDayTasks.tsx`
- Modify: `src/components/__tests__/CalendarDayTasks.test.tsx`
- Modify: `src/pages/Schedule.tsx`

**Interfaces:**
- Consumes: Task 2 `CalendarTaskLayout.section` and Task 3 `continuousHeight` / `onContinuousHeightChange` props.
- Produces: `CalendarDayTasksProps.continuousHeights: Record<string, number>` and `onContinuousHeightChange(groupId, height)` integration shared by all date cells.

- [ ] **Step 1: Write failing vertical renderer tests**

Replace two-column expectations with:

```typescript
it('renders connected/full-day, AM, and PM in full-width vertical order', () => {
  render(
    <CalendarDayTasks
      tasks={tasks}
      date="2026-07-15"
      segments={buildContinuousTaskSegments(tasks)}
      continuousHeights={{}}
      onContinuousHeightChange={vi.fn()}
    />
  );

  const root = screen.getByTestId('calendar-day-tasks');
  expect(root).toHaveClass('flex', 'flex-col');
  expect(root).not.toHaveClass('grid-cols-2');
  expect(screen.getAllByTestId(/calendar-task-/).map(element => element.dataset.calendarSection))
    .toEqual(['full', 'am', 'pm']);
});

it('passes one connected group height to every fragment', () => {
  render(
    <CalendarDayTasks
      tasks={[connectedTask]}
      date="2026-07-22"
      segments={connectedSegments}
      continuousHeights={{ 'group-a': 84 }}
      onContinuousHeightChange={vi.fn()}
    />
  );
  expect(screen.getByTitle(/Connected task/)).toHaveStyle({ height: '84px' });
});
```

- [ ] **Step 2: Run the renderer test and observe RED**

```powershell
npm test -- --run src/components/__tests__/CalendarDayTasks.test.tsx
```

Expected: FAIL because the renderer still uses `grid-cols-2`, column styles, and no shared-height props.

- [ ] **Step 3: Convert CalendarDayTasks to a vertical full-width container**

Use this prop contract and render structure:

```tsx
interface CalendarDayTasksProps {
  tasks: CalendarDayTask[];
  date: string;
  segments: Map<string, ContinuousTaskSegmentMeta>;
  continuousHeights: Record<string, number>;
  onContinuousHeightChange: (groupId: string, height: number) => void;
  onTaskClick?: (task: CalendarDayTask) => void;
}

<div data-testid="calendar-day-tasks" className="flex flex-col">
  {layout.map(({ task, section }) => {
    const segment = segments.get(`${task.id}|${date}`);
    return (
      <div
        key={task.id}
        className="task-card-compact w-full"
        data-testid={`calendar-task-${task.id}`}
        data-calendar-section={section}
      >
        <TaskCardCompact
          task={task}
          segmentMeta={segment}
          continuousHeight={segment ? continuousHeights[segment.groupId] : undefined}
          onContinuousHeightChange={onContinuousHeightChange}
          onClick={() => onTaskClick?.(task)}
        />
      </div>
    );
  })}
</div>
```

- [ ] **Step 4: Add the shared height registry to Schedule**

Import `useCallback`, then add:

```typescript
const [continuousTaskHeights, setContinuousTaskHeights] = useState<Record<string, number>>({});

const handleContinuousHeightChange = useCallback((groupId: string, height: number) => {
  setContinuousTaskHeights((current) => current[groupId] === height
    ? current
    : { ...current, [groupId]: height });
}, []);

useEffect(() => {
  setContinuousTaskHeights({});
}, [selectedDate]);
```

Pass both values to assigned and unassigned `CalendarDayTasks` instances.

- [ ] **Step 5: Change every calendar date column minimum width to 100px**

In `src/pages/Schedule.tsx`, replace the date header class:

```tsx
"... min-w-[100px]"
```

and add `min-w-[100px]` to both assigned and unassigned date body cells. Do not change the sticky engineer column or outer horizontal scrolling container.

- [ ] **Step 6: Run integration-focused tests and type checking**

```powershell
npm test -- --run src/components/__tests__/CalendarDayTasks.test.tsx src/components/__tests__/TaskCard.test.tsx src/lib/__tests__/scheduleRules.test.ts
npm run typecheck
```

Expected: all focused tests pass and `tsc` exits 0.

- [ ] **Step 7: Commit vertical calendar integration**

```powershell
git add src/components/CalendarDayTasks.tsx src/components/__tests__/CalendarDayTasks.test.tsx src/pages/Schedule.tsx
git commit -m "feat: stack calendar tasks by time slot"
```

### Task 5: Verify, deploy, and recheck Jetson

**Files:**
- Modify: `openspec/changes/update-calendar-half-day-positioning/tasks.md`
- Temporary only: `verification/vertical-calendar-firefox.mjs`
- Temporary only: `verification/vertical-calendar-firefox.png`

**Interfaces:**
- Consumes: completed implementation from Tasks 1-4 and the existing Jetson GitHub Actions workflow.
- Produces: completed OpenSpec checklist, merged `DEV`, successful GitHub Actions run, and Firefox evidence from local and deployed pages.

- [ ] **Step 1: Run the complete automated verification suite**

```powershell
npm test -- --run
npm run typecheck
npx eslint src/lib/scheduleRules.ts src/lib/__tests__/scheduleRules.test.ts src/components/TaskCard.tsx src/components/CalendarDayTasks.tsx src/components/__tests__/TaskCard.test.tsx src/components/__tests__/CalendarDayTasks.test.tsx
npm run build
openspec validate update-calendar-half-day-positioning --strict
git diff --check
```

Expected: 10 test files and at least 121 tests pass; type checking, focused lint, build, OpenSpec, and whitespace checks exit 0. Existing unrelated whole-file `Schedule.tsx` lint debt is compared against the baseline and must not increase.

- [ ] **Step 2: Verify the local implementation in Firefox**

Use the authenticated Firefox/Playwright flow against the local Vite build and real Jetson API data. Assert and capture:

```text
- date header and body width >= 100px
- each ordinary task card width equals the usable date-cell width
- AM card top < PM card top on the same date
- long ordinary task name scrollHeight == clientHeight (no clipped content)
- connected start contains the complete name and total hours
- connected middle/end text is empty
- start/middle/end heights are equal
- adjacent connected fragment edges differ by no more than 1px
- no Vite overlay, page error, or console error
```

Inspect the screenshot visually before continuing, then delete temporary verification files and restore dependencies with `npm ci`.

- [ ] **Step 3: Mark local verification tasks complete and commit**

Check the OpenSpec items for implementation, automated validation, and local Firefox verification, then run:

```powershell
git add openspec/changes/update-calendar-half-day-positioning/tasks.md
git commit -m "docs: record vertical calendar verification"
```

- [ ] **Step 4: Merge into DEV and verify the merged result**

From the main repository root, fast-forward `DEV` to the feature branch while preserving all unrelated dirty files. Run the full test suite, type checking, and production build again on the merged result before deleting the owned worktree and feature branch.

- [ ] **Step 5: Push DEV and monitor GitHub Actions**

```powershell
git push origin DEV
```

Monitor `.github/workflows/jetson-deploy.yml` for the pushed commit. Required results:

```text
代码质量检查: success
部署到 Jetson: success
```

- [ ] **Step 6: Recheck the deployed Jetson page in Firefox**

Open `http://10.70.80.183:3000/` with a cache-busting query, navigate to 日程管理, and repeat the Step 2 geometry/content assertions against the deployed page.

- [ ] **Step 7: Complete the deployment checklist**

Mark the final GitHub Actions and Jetson Firefox items complete, commit the documentation-only checklist update, and push it. The workflow ignores Markdown-only changes.
