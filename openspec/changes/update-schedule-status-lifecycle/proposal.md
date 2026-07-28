# Change: Update schedule status lifecycle and editing permissions

## Why

Past schedules remain indefinitely in `planned`, `in_progress`, or `confirmed`, forcing users to correct them manually. The schedule page also hides the edit action for self-entered schedules after they leave `pending_approval`, even though the backend already permits owners to modify them.

## What Changes

- Persist eligible past schedules as `completed` when schedules are loaded.
- Allow users to fully edit and delete their own self-entered schedules in every business status.
- Allow assignees to update only the execution status of tasks created by another user.
- Keep task content, dates, hours, assignment, and deletion protected for assignees who did not create the task.
- Preserve approval, rejection, cancellation, and unaccepted-assignment states from automatic completion.

## Impact

- Affected specs: `schedule-management`
- Affected code: `backend/routers/tasks.py`, task models and tests, `src/pages/Schedule.tsx`, `src/components/TaskDetailModal.tsx`, schedule permission utilities and tests.

