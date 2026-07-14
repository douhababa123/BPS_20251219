## Context

The existing schedule page combines chart aggregation, form transitions, and calendar rendering in one page component. Continuous work must be inferred from existing AM/PM/FULL_DAY slots without adding timestamp fields or changing persisted records.

## Goals / Non-Goals

- Goals: implement requirements 2.1–2.5 with deterministic, testable frontend rules.
- Non-goals: database migration, timestamp-level scheduling, historical `GPU-SU` rewriting, or status-enum changes.

## Decisions

- Put aggregation, form transitions, and slot-continuity calculations in pure utility functions.
- Expand FULL_DAY into AM and PM slots for continuity analysis.
- Group only records with the same engineer, task name, and task type, then split groups wherever time slots are not adjacent.
- Render connected work as date-local start/middle/end fragments so the existing calendar table structure remains intact.
- Preserve original records and route clicks from every fragment to the underlying task.

## Risks / Trade-offs

- Table cell boundaries can create visible seams. Connected fragments remove facing margins, radii, and borders to mitigate this.
- Natural-day adjacency includes weekends because the current calendar displays and schedules every date. This preserves existing date semantics.
- Multiple underlying records can form one visual band; the first segment owns the visible label while each fragment retains its own task click target.

## Migration Plan

No persisted data migration. Deploy frontend changes through the existing `DEV` GitHub Actions workflow and roll back by reverting the feature commit if needed.
