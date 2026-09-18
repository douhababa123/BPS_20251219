## Context

The production SQL Server already keeps a latest competency projection and append-only per-cell history. It has nine module-owner names in `competency_definitions`, but no annual-baseline marker and no business-version grouping for a page save. The existing migration baseline is dated 2026-07-03 and cannot safely represent the start of 2026.

## Goals / Non-Goals

- Goals: annual-baseline KPI tracking, module-filtered monthly trends, staged batch saving, module-owner authorization, immutable baseline selection, `Others` task classification and deterministic matching gates.
- Non-goals: rewriting current/history values, automatic adoption of migration baselines, notification integrations, automatic conflict merging or redesigning competency-profile analytics.

## Decisions

### Reuse the current module-owner field

The backend resolves the authenticated user to an active employee and compares the normalized employee name with the single `owner_engineer` configured for the target module. Inconsistent, missing or inactive owner configuration fails closed. This avoids changing current owner records.

### Group future edits into business versions

A batch-save endpoint validates all changed cells and writes them in one transaction. A new version header groups the appended history rows. Existing history remains unchanged and may have a null version reference.

### Materialize annual baselines

An annual baseline has a header and immutable employee-skill detail rows. A baseline can be created from a validated Excel import or a selected saved version. Materialization provides stable formulas and avoids treating a per-cell migration timestamp as a coherent year-start snapshot.

The user has confirmed that the 2026 baseline must come from the separately confirmed year-start Excel, not the 2026-07-03 migration snapshot. Saved-version selection remains available for later years.

### Provide an explicit administrator upload workflow

Add a dedicated “年初基线管理” tab to the existing Admin page, separate from current-assessment and master-data imports. Administrators select a year, download a template, upload Excel, review validation and aggregate previews, and explicitly confirm activation. A missing-baseline Dashboard action opens this tab with the selected year. Normal users and module Owners cannot access baseline management APIs.

Every accepted workbook must contain a sheet whose name is exactly `Current_Target states`; all other sheets are ignored. The upload UI warns the administrator to verify this exact name before choosing the file, and a missing-sheet error reports the detected sheet names. The parser accepts the standard long-form template on that sheet and the confirmed original wide C/T layout. For the wide layout it maps employees and the 38 active skills deterministically, applies the confirmed four C/T rules, explicit legacy skill aliases and the Xu Qingyue / Ship to line exception, and never uses fuzzy matches for ambiguous master data.

The preview reports source sheet, source employee rows, importable cells, omitted not-applicable cells, errors and the KPI aggregates. It returns all converted rows for searchable, paginated display, with source cell coordinates and conversion rules. FastAPI validation arrays and business validation objects are normalized into actionable Chinese messages instead of exposing a generic HTTP 422 message.

Preview, removal of a selected file and cancellation write no business records. Removing a pending upload clears the native file control, preview, validation result and message. Confirmation revalidates the same previewed content, explicit year and authorization before atomically creating the immutable baseline. A year/file change requires a fresh preview. Existing annual baselines require explicit replacement confirmation and an expected active-version check; retain prior versions and allow only one active baseline per year. Persist file source, filename, confirmer and confirmation timestamp without treating upload time as the baseline's effective assessment date. Active baselines are never hard-deleted from this workflow.

Never reuse the current-assessment import write path: activation only writes baseline tables, does not modify existing assessments, history, employees, owners, accounts or tasks, and does not fabricate monthly edits. Refresh the selected year's Dashboard on successful activation. Invalid references block import; later integrity failures must be surfaced rather than silently shrinking a frozen denominator.

### Keep a fixed annual comparison cohort

The baseline detail rows define the year's denominator and comparison population. Missing records are excluded, while numeric zero participates. Month-end values carry forward from the latest save, beginning with baseline current values.

### Compare progress with the fixed annual target

Current GAP is `max(baseline_target - latest_current, 0)`. This keeps the target KPI, current GAP and close rate on one stable annual goal even if editable targets change later.

### Keep KPI presentation and selected-month trends synchronized

Add a statistical-month selector between year and module. Default to the current month for the current year and December when switching to a past year; disable future months. Use Asia/Shanghai month-end boundaries for completed months and a single response cutoff timestamp for the ongoing month. Changing month leaves the three baseline metrics unchanged and updates the three current/YTD metrics and January-through-selected-month trend.

At viewport widths of at least 1280px, display six equal-width KPI cards in the documented order on one row; allow ordered wrapping on smaller screens. Generate `YYYY` and two-digit `YTDMM` titles from the selected filters, not the wall-clock month. Label ongoing-month values as partial through the current query time.

The progress API accepts `year`, `month`, and optional `module_id`, returning KPI values and the monthly series together with filter echoes, baseline ID and cutoff. Reuse the final monthly GAP and close-rate calculation for current KPI values. Apply identical formatting to KPI and chart tooltip values, discard stale filter responses, and show synchronized loading/error states. A zero initial GAP yields unavailable close-rate KPI and line points, never false zero percent values.

### Apply matching gates before ranking

Full requested-slot availability, assessment presence, `current >= required`, and existing role gates are mandatory. Only eligible candidates are ranked using the existing weighted skill model.

## Risks / Trade-offs

- Owner names are text, so a rename can break authorization. Mitigation: fail closed and surface an admin configuration error; normalize to IDs only in a separately approved migration.
- Current data is incomplete across the active employee-skill cross product. Mitigation: the baseline explicitly defines the cohort and the API returns coverage counts.
- Fixed cohorts do not include mid-year hires. Mitigation: preserve comparable trends and add them at the next annual baseline unless the business later approves re-baselining.
- Imported 2026 data may not satisfy current validation. Mitigation: preview all errors and create no baseline until an administrator confirms a valid import.

## Migration Plan

1. Take a recoverable database backup and record current/history checksums and row counts.
2. Add version and annual-baseline tables, indexes and nullable history linkage without rewriting existing rows.
3. Verify all existing current/history/task data is unchanged using the recorded checksums and row counts.
4. Deploy the tested backend and UI together only after the schema is available, then run authenticated browser acceptance checks.
5. Import the separately confirmed 2026 year-start file through preview and explicit administrator confirmation when that file is available.

## Open Questions

- The database-driven KPI cohort, fixed-target and complete-candidate decisions are confirmed and implemented as documented in section 12 of the detailed design.
- The confirmed year-start Excel has been provided and its original `Current_Target states` layout validates to 17 employees, 38 skills and 427 baseline cells. Production activation remains an explicit administrator action after reviewing the web preview.
