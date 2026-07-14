# Change: Optimize schedule management workflows

## Why

The schedule page currently presents competence hours in an unsorted pie chart, exposes an outdated location, treats status as mandatory, lacks Leave-specific form behavior, and renders long continuous work as disconnected daily cards.

## What Changes

- Display team and personal competence-hour distributions as descending bar charts.
- Replace the standard `GPU-SU` task location option with `Supplier` while retaining legacy edit compatibility.
- Make task status an optional select with a `planned` fallback.
- Apply automatic values and input locking when task type is Leave.
- Identify truly continuous work from AM/PM/FULL_DAY slots and connect same-task segments exceeding 8 hours across calendar days.

## Impact

- Affected specs: schedule-management
- Affected code: `src/pages/Schedule.tsx`, `src/components/TaskCard.tsx`, `src/lib/taskTypeConfig.ts`, new schedule rule utilities and tests.
- No API or database migration is required.
