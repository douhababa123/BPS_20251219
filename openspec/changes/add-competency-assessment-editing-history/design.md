## Context

The SQL Server-backed competency page currently reads `competency_assessments` directly. That table is unique per employee, skill and year, while the new behavior needs one global latest value plus every edit as auditable quarterly history. The change also crosses React UI, FastAPI authorization and a production data migration.

## Goals / Non-Goals

- Goals: safe matrix editing, `0–5` validation, `target >= current`, role/self authorization, atomic latest-plus-history writes, quarterly history queries and lossless baseline migration.
- Non-goals: history timeline UI, card/table editing, approvals, bulk editing, real-time collaboration or automatic conflict merging.

## Decisions

### Current projection plus append-only history

Keep `competency_assessments` as the latest projection and add `competency_assessment_history` for immutable snapshots. Existing analytics continue to read a single record per employee and skill, while history queries never affect GAP totals.

Alternatives rejected: making the existing table append-only would require every consumer to implement latest-row selection; JSON audit payloads would weaken validation and quarterly querying.

### Unified save endpoint

Use `PUT /competency-assessments/employee/{employee_id}/skill/{skill_id}` for both first entry and later edits. The backend validates permissions and values, locks the current key, upserts the projection and inserts one history snapshot in one transaction.

Use a dedicated `GET /competency-assessments/matrix` endpoint to return all active employees, all active skills, nullable assessment cells and row-level `can_edit`. Keep `/full` limited to persisted assessments so Dashboard, analytics and matching never mistake an empty matrix cell for an assessment.

### Server-derived authorization and quarter

The JWT user is authoritative. Admins may edit/query all employees; normal users are linked to employees by normalized email and may edit/query only themselves. `can_edit` returned to the UI is a hint only. Year and quarter are derived from the server write timestamp so clients cannot place changes in arbitrary quarters.

### Zero is data, absence is missing

An existing record with current or target 0 is complete data. UI and aggregation code must distinguish record absence from numeric zero and include zero in averages and GAP calculations.

## Risks / Trade-offs

- Production records may contain multiple years for one employee/skill. Mitigation: copy every row to history before deterministic current-table deduplication and validate counts in the same transaction.
- A schema rollback after new writes could discard history. Mitigation: require a recoverable backup and prefer forward-compatible application rollback that leaves the history table intact.
- Existing consumers may assume yearly rows. Mitigation: test Dashboard, competency analytics and matching against the latest projection and retain assessment year/date on the projection.
- Frontend permission hints can become stale. Mitigation: every write and history query is independently authorized on the server.

## Migration Plan

1. Confirm a Jetson database backup or restore point.
2. Create the history table and indexes.
3. Copy every existing row as `MIGRATION_BASELINE`, deriving its historical quarter from the best available original timestamp.
4. Retain the deterministic latest current row per employee/skill and associate all baselines with that retained row.
5. Remove duplicate current projections, replace level and unique constraints, and validate row counts and constraints.
6. Deploy the compatible backend and frontend, then run API and browser smoke tests.

## Open Questions

None. The user approved the editing scope, permissions, level controls, history visibility, baseline migration and current-plus-history architecture.
