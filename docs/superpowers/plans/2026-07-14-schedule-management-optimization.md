# Schedule Management Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement requirements 2.1–2.5 for schedule charts, task form behavior, and connected continuous-task bands, then deploy the verified `DEV` branch to Jetson.

**Architecture:** Add pure scheduling rules in `src/lib/scheduleRules.ts` so chart ordering, Leave normalization, optional status handling, and continuous AM/PM segment detection are independently testable. `Schedule.tsx` consumes these rules for data preparation and form behavior; `TaskCardCompact` receives segment presentation metadata and remains responsible only for rendering.

**Tech Stack:** React 18, TypeScript 5.5, Recharts, Vitest, React Testing Library, OpenSpec, GitHub Actions.

## Global Constraints

- Preserve the existing API and database schema.
- Use existing slots exactly: AM = 3.5h, PM = 4.5h, FULL_DAY = 8h.
- A continuous task requires the same engineer, task name, task type, and adjacent date/time slots.
- Only continuous segments totaling more than 8h render as connected bands.
- Leave keeps task type, dates, and time slot editable; all other inputs are disabled.
- Existing `GPU-SU` records remain editable, while new standard options use `Supplier`.

---

### Task 1: Pure chart and form rules

**Files:**
- Create: `src/lib/scheduleRules.ts`
- Create: `src/lib/__tests__/scheduleRules.test.ts`
- Modify: `src/lib/taskTypeConfig.ts`

**Interfaces:**
- Produces: `sortHourStats`, `getTaskLocationOptions`, `applyTaskTypeChange`, `normalizeOptionalStatus`.

- [ ] **Step 1: Write failing tests** for descending/stable hour sorting, `Supplier` replacing `GPU-SU`, legacy location compatibility, Leave field normalization, leaving Leave mode, and empty status defaulting to `planned`.
- [ ] **Step 2: Run tests to verify RED** with `npm test -- src/lib/__tests__/scheduleRules.test.ts` and confirm failures identify missing exports/behavior.
- [ ] **Step 3: Implement minimal pure functions** and update the standard task location list.
- [ ] **Step 4: Run tests to verify GREEN** with the same focused command.
- [ ] **Step 5: Commit** with `git commit -m "feat: add schedule chart and form rules"`.

### Task 2: Continuous task segment engine

**Files:**
- Modify: `src/lib/scheduleRules.ts`
- Modify: `src/lib/__tests__/scheduleRules.test.ts`

**Interfaces:**
- Produces: `buildContinuousTaskSegments(tasks)` returning per-task/per-date metadata containing `position: 'single' | 'start' | 'middle' | 'end'`, `continuousHours`, `showLabel`, and a stable group identifier.

- [ ] **Step 1: Write failing tests** for AM→PM, PM→next-day AM, FULL_DAY→next-day AM, multi-day FULL_DAY continuity, and the four identity conditions.
- [ ] **Step 2: Write failing interruption tests** for AM→next day, FULL_DAY→next-day PM, different engineer/name/type, missing slots, and segments totaling exactly 8h.
- [ ] **Step 3: Run focused tests to verify RED** and confirm current implementation cannot generate segment metadata.
- [ ] **Step 4: Implement slot expansion and grouping** by expanding FULL_DAY to AM+PM, ordering slots, splitting at gaps, summing slot hours, and emitting connected metadata only above 8h.
- [ ] **Step 5: Run focused tests to verify GREEN** and refactor only after all boundary cases pass.
- [ ] **Step 6: Commit** with `git commit -m "feat: identify continuous schedule task bands"`.

### Task 3: Schedule charts and task form UI

**Files:**
- Modify: `src/pages/Schedule.tsx`
- Create: `src/pages/__tests__/ScheduleTaskForm.test.tsx` if the modal can be isolated without excessive mocking; otherwise export a focused form component and test it at its new path.

**Interfaces:**
- Consumes: Task 1 rules.

- [ ] **Step 1: Write failing UI tests** asserting both competence charts are bars with descending data, status is a non-required select, `Supplier` is offered, and selecting Leave produces/locks the specified values.
- [ ] **Step 2: Run focused tests to verify RED** and record the expected missing controls/behavior.
- [ ] **Step 3: Replace team and personal competence pie charts** with colored bar charts consuming sorted statistics.
- [ ] **Step 4: Replace status buttons with an optional select** and normalize empty values to `planned` on submission.
- [ ] **Step 5: Wire Leave mode** so task name/location auto-fill, non-time inputs clear and disable, required constraints are removed while disabled, and switching away restores normal editing.
- [ ] **Step 6: Run focused tests to verify GREEN**.
- [ ] **Step 7: Commit** with `git commit -m "feat: optimize schedule charts and task form"`.

### Task 4: Connected calendar task bands

**Files:**
- Modify: `src/pages/Schedule.tsx`
- Modify: `src/components/TaskCard.tsx`
- Modify: `src/components/__tests__/TaskCard.test.tsx`

**Interfaces:**
- Consumes: `buildContinuousTaskSegments` from Task 2.
- Extends: `TaskCardCompact` with optional segment presentation metadata.

- [ ] **Step 1: Write failing component tests** for start/middle/end border radii, label shown only on start, continuous hours shown only on start, and click behavior preserved on every segment.
- [ ] **Step 2: Run component tests to verify RED**.
- [ ] **Step 3: Generate segment metadata once per calendar view** and attach the correct date-specific metadata to each rendered compact card.
- [ ] **Step 4: Implement connected visual styling** with shared colors, joined edges, no duplicate labels, and full tooltip/click behavior.
- [ ] **Step 5: Run focused rule and component tests to verify GREEN**.
- [ ] **Step 6: Commit** with `git commit -m "feat: connect continuous tasks in schedule calendar"`.

### Task 5: Full verification and deployment

**Files:**
- Modify: `openspec/changes/update-schedule-management-workflows/tasks.md`

- [ ] **Step 1: Run the full frontend suite** with `npm test` and require zero failures.
- [ ] **Step 2: Run static verification** with `npm run typecheck`, `npm run lint`, and `npm run build`.
- [ ] **Step 3: Run strict spec verification** with `openspec validate update-schedule-management-workflows --strict`.
- [ ] **Step 4: Verify the rendered schedule page** for requirements 2.1–2.5 using local browser tooling or Playwright, including screenshots of chart ordering, normal/Leave forms, and connected/non-connected task examples.
- [ ] **Step 5: Mark implementation/verification tasks complete**, merge the feature branch to `DEV`, rerun tests on merged `DEV`, and clean up the owned worktree.
- [ ] **Step 6: Push `DEV` and monitor** the matching Jetson GitHub Actions run until code-quality and deployment jobs both succeed.
- [ ] **Step 7: Mark deployment complete** in OpenSpec using a documentation-only commit, then push without retriggering deployment.
