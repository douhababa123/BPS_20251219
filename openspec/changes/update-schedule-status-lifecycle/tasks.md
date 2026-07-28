## 1. Backend lifecycle and permissions

- [x] 1.1 Add failing tests for past-task normalization, protected statuses, and same-day tasks.
- [x] 1.2 Persist eligible past self-entered and accepted tasks as completed before list responses.
- [x] 1.3 Add failing tests for assignee execution-status updates and protected task fields.
- [x] 1.4 Add a dedicated, validated assignee execution-status endpoint.

## 2. Frontend editing experience

- [x] 2.1 Add tested helpers for full self-schedule editing and assigned-task status-only permissions.
- [x] 2.2 Show full edit/delete actions for every status of a self-entered schedule.
- [x] 2.3 Show a status-only control for accepted tasks created by another user.
- [x] 2.4 Refresh task caches after execution-status changes and display API errors.

## 3. Verification and deployment

- [x] 3.1 Run focused backend and frontend tests.
- [x] 3.2 Run the complete frontend test suite, typecheck, production build, and selected backend regression suite.
- [x] 3.3 Verify the OpenSpec change with strict validation.
- [x] 3.4 Deploy through the existing GitHub Actions workflow and verify Jetson health and rendered permissions.

