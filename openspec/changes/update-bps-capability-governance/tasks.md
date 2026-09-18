## 1. Safety baselines

- [x] 1.1 Back up the Jetson SQL Server database before schema work.
- [x] 1.2 Record checksums/counts for current assessments, history, tasks and module-owner configuration.
- [x] 1.3 Add regression fixtures for Level 0, missing cells and the existing migration baseline.

## 2. Data model

- [x] 2.1 Add an idempotent assessment-version header migration and nullable history version reference.
- [x] 2.2 Add idempotent annual-baseline header/detail tables and one-active-baseline-per-year enforcement.
- [x] 2.3 Verify the migration does not update or delete existing business rows.

## 3. Competency authorization and saving

- [x] 3.1 Resolve module Owner permissions from authenticated employee and module configuration.
- [x] 3.2 Remove normal-user self-edit authorization at the backend and UI boundaries.
- [x] 3.3 Add draft tracking, discard and one atomic batch-save endpoint.
- [x] 3.4 Add optimistic conflict detection and tests.
- [x] 3.5 Record immutable modification time, modifier and explicit before/after Levels for every successful save; add administrator/all and Owner/module-scoped change-log review without rewriting legacy history.

## 4. Annual baseline administration

- [x] 4.1 Obtain the confirmed year-start Excel and verify its layout against the proposed employee/skill ID and score template.
- [x] 4.2 Add the Admin “年初基线管理” tab with year selection, active-baseline metadata, template download and revision inspection; link the Dashboard missing-baseline action with the selected year.
- [x] 4.3 Add Excel upload validation and row-level errors plus detail/aggregate preview without business-data persistence; never populate baseline scores from current values or fill missing cells with zero.
- [x] 4.4 Add administrator-confirmed atomic activation with server revalidation of previewed content and year; require Excel for 2026 and permit saved-version selection for later years.
- [x] 4.5 Require explicit replacement confirmation and active-version concurrency checks; retain immutable prior revisions and record source, filename, confirmer and time.
- [x] 4.6 Test non-admin API rejection, invalid/duplicate/missing rows, valid zero, canceled preview, year/file changes, rollback, concurrent activation and refusal to use the July migration snapshot as the 2026 baseline.
- [x] 4.7 Verify upload/activation leaves current assessments, history, employees, module Owners, accounts and tasks unchanged; refresh year-specific Dashboard results only after successful activation.
- [x] 4.8 Require the exact `Current_Target states` sheet, automatically convert its confirmed wide C/T layout, show complete paginated preview metadata, allow pending-file removal and surface actionable validation errors instead of generic 422 messages.
- [x] 4.9 Add a guided active-baseline replacement workflow with populated current-baseline download, explicit edit/preview/confirm steps and retained immutable revisions.

## 5. Dashboard

- [x] 5.1 Add backend selected-month KPI and January-through-selected-month carry-forward aggregation with Asia/Shanghai boundaries; return filter echoes, baseline ID and one cutoff with the combined result.
- [x] 5.2 Replace current Dashboard content with six ordered KPI cards on one wide-screen row, responsive wrapping, selected-year/YTDMM titles and the combined trend chart.
- [x] 5.3 Add linked year/month/module filters, current/past-year defaults, disabled future months, ongoing-month cutoff labels, coverage and missing-baseline states.
- [x] 5.4 Add formula-level backend and frontend tests including 200 initial GAP / 160 June GAP / 20% close rate, matching KPI and chart values, module filters, zero GAP and unchanged baseline metrics across months.
- [x] 5.5 Test historical cutoffs exclude later edits, unchanged months carry forward, responsive card order, synchronized loading/errors and rejection of stale filter responses.

## 6. Schedule Others

- [x] 6.1 Add synthetic `Others` to the task competence-module selector.
- [x] 6.2 Make competence item not applicable for `Others` and persist the canonical value.
- [x] 6.3 Verify existing tasks and Leave behavior remain unchanged.

## 7. Matching

- [x] 7.1 Apply availability, assessment, level and role hard gates before ranking.
- [x] 7.2 Return all eligible candidates with stable score/name ordering.
- [x] 7.3 Add controlled L2/L3/L4 and conflicting-date tests for Huang Lanping's Logistic index scenario.
- [x] 7.4 Exempt Tyler Tan and Tong Zhifeng from schedule-conflict matching gates while retaining active-account, competency and role gates.
- [x] 7.5 Verify both resource-only employees remain available in the suggested-user selector and are excluded from annual KPI baseline rows.

## 8. Verification and release

- [x] 8.1 Run backend unit/integration tests and focused frontend tests.
- [x] 8.2 Compare pre/post migration data checksums and row counts.
- [ ] 8.3 Run authenticated browser acceptance checks for admin, each Owner scope and normal user.
- [x] 8.4 Deploy through the existing DEV GitHub Actions workflow only after proposal approval.
- [x] 8.5 Generate the confirmed 427-row 2026 baseline workbook without activating it or modifying current business data.
