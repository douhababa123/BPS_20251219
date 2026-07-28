## Context

Self-entered schedules and assigned tasks share the `tasks` table, but their ownership and state transitions differ. A `planned` self-entered schedule is normal work, while a `planned` task created by someone else is still waiting for the assignee to accept it. The current frontend permission check only exposes editing for `pending_approval`, which is inconsistent with backend ownership rules.

## Goals / Non-Goals

- Goals:
  - Persist completed status for eligible tasks whose `end_date` is earlier than the server's current date.
  - Expose full editing for self-entered schedules regardless of their current business status.
  - Expose status-only execution updates for accepted tasks assigned by someone else.
- Non-Goals:
  - Do not allow assignees to change another creator's task content, schedule, hours, engineer, or deletion state.
  - Do not auto-complete approval, rejection, cancellation, or unaccepted assignment records.
  - Do not add a new scheduler service or database job.

## Decisions

- Add an idempotent backend normalization function invoked before `/api/tasks/` returns data. It updates eligible rows in the same request transaction, so the database and subsequent filters agree with the displayed status.
- Auto-complete rows whose `end_date` is earlier than `CAST(GETDATE() AS date)` when:
  - status is `in_progress` or `confirmed`; or
  - status is `planned` and requester resolves to the assigned employee, identifying a self-entered schedule.
- Leave `pending_approval`, `rejected`, `employee_rejected`, `cancelled`, and `planned` assignments awaiting acceptance unchanged.
- Keep the existing full task update endpoint for admins, self-entered schedule owners, and requesters editing a pending assignment.
- Add a dedicated execution-status endpoint for assignees of tasks created by another account. It accepts only `confirmed`, `in_progress`, or `completed` and cannot mutate other fields.
- Move frontend permission decisions into tested schedule-rule helpers. The task detail modal shows the full edit/delete actions for self-entered schedules and a separate execution-status control for accepted assigned tasks.

## Risks / Trade-offs

- Automatic completion occurs when an authenticated client loads the task list rather than at midnight exactly. The first load after midnight persists the transition, which meets display and database consistency without another long-running service.
- Server date is authoritative. Jetson and SQL Server must retain the configured local business date.
- Bulk automatic transitions do not create one audit-log entry per task; `updated_at` records when normalization occurred.

## Migration Plan

No schema migration is required. Deployment through the existing `DEV` GitHub Actions workflow activates normalization on the first task-list request. Rollback is performed by reverting the feature commits; already completed tasks remain completed and can be corrected by their owner or an admin.

