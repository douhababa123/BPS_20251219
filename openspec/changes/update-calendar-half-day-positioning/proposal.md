# Change: Stack calendar tasks vertically with complete names

## Why

Horizontal half-day cards leave too little width for task names. Users need to distinguish morning and afternoon work while reading every task name directly in the calendar, including the first fragment of a connected cross-day task.

## What Changes

- Increase every date column minimum width from 80px to 100px.
- Render task cards in one full-width vertical flow: connected/FULL_DAY, then AM, then PM.
- Wrap every visible task name without truncation and allow the engineer row to grow.
- Show connected-task text only in the first date cell, then synchronize that measured height to empty middle/end fragments.
- Preserve seamless connected edges, complete hover information, clicking, double-click-to-add, continuity identity, and hour calculations.
- Add no visible AM/PM sub-grid, divider, heading, or separate background.

## Impact

- Affected specs: `schedule-management`
- Related active change: `enhance-schedule-and-competency`
- Affected code: `src/lib/scheduleRules.ts`, `src/components/TaskCard.tsx`, `src/components/CalendarDayTasks.tsx`, `src/pages/Schedule.tsx`, and focused tests
- Backend/API/database impact: none
