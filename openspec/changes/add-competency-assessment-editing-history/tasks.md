## 1. Database migration and models

- [x] 1.1 Add migration tests/preflight checks for existing row counts, duplicate employee-skill keys and legacy constraints.
- [x] 1.2 Add an idempotent SQL Server migration that creates history, copies all baselines, consolidates current records and replaces uniqueness/level constraints transactionally.
- [x] 1.3 Update `SQLSERVER_SCHEMA.sql` and Pydantic models for levels 0–5, save payloads and history responses.
- [x] 1.4 Verify migration baseline counts, current uniqueness, indexes and rollback behavior.

## 2. Backend authorization and persistence

- [x] 2.1 Add focused backend tests for admin/all, engineer/self and engineer/other authorization.
- [x] 2.2 Add focused backend tests for level validation, first entry, update, exactly-one history append and transactional rollback.
- [x] 2.3 Implement the unified employee-skill save endpoint and reusable employee identity authorization helper.
- [x] 2.4 Add history list/latest-per-quarter endpoint with the same scope restrictions.
- [x] 2.5 Add the dedicated complete matrix endpoint with `can_edit`, and verify existing `/full` reads still return only persisted latest rows.

## 3. Frontend matrix editing

- [x] 3.1 Add API/types and unit tests for save requests, `can_edit`, history types and zero-inclusive matrix aggregation.
- [x] 3.2 Add an accessible assessment edit dialog with linked 0–5 current/target selects, validation, notes, error retention and duplicate-submit protection.
- [x] 3.3 Make authorized matrix cells mouse/keyboard editable, including missing records, while keeping unauthorized cells and non-matrix views read-only.
- [x] 3.4 Replace GAP magnitude colors with equal-green and positive-red rules and make zero an assessed value everywhere on the assessment page.
- [x] 3.5 Refresh assessments, matrix and summaries after saving and cover the full interaction with component tests.

## 4. Regression, migration and deployment verification

- [x] 4.1 Run backend focused tests, frontend unit tests, TypeScript, targeted ESLint and production build.
- [x] 4.2 Verify Dashboard, competency analytics and matching continue to consume the latest projection without duplicate or missing zero values.
- [x] 4.3 Run migration preflight against the deployment database after confirming a backup/restore point.
- [ ] 4.4 Deploy through the existing GitHub Actions Jetson workflow and verify administrator and engineer flows in Firefox.
- [ ] 4.5 Confirm one current row and one new history snapshot for a smoke-test save, then record rollback and release evidence.
