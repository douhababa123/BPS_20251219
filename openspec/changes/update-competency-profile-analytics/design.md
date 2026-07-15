## Context

Current competency analytics are computed mostly in the frontend from the latest assessment projection. Quarterly trend data requires append-only history and quarter-end carry-forward semantics, while the current charts need only deterministic client-side aggregation.

## Goals / Non-Goals

- Goals: remove ranking semantics without losing GAP summaries; use module averages on a 0–4 scale; add per-person distribution and quarter-end trend; remove personal average GAP; enforce 0–4 at every write boundary.
- Non-Goals: historical organization membership, multiple trend series, new competency definitions, or a new history timeline UI.

## Decisions

### Split current and historical aggregation

Current-view aggregation remains in pure TypeScript functions. Quarter-end snapshots are aggregated by a new authenticated backend endpoint so raw employee history is not downloaded to browsers.

### Define a quarter as an as-of snapshot

For every current active employee and active skill, the backend selects the latest history record at or before the quarter end. The search crosses year boundaries. Missing baseline and genuine zero GAP are distinguished by `hasData`.

### Remove ranking semantics, preserve the matrix

The Ranking tab and rank column are removed. The employee/module matrix moves into Gap Analysis, sorts by employee name, and retains employee totals, module totals, and the team grand total.

### Enforce four levels at the source

The UI, API models, transaction boundary and SQL constraints all enforce integer levels 0–4 and `target >= current`. No display-only clamping is used.

## Risks / Trade-offs

- Quarter-end SQL can be expensive as history grows. Mitigation: filter to active employees/skills, use existing history indexes, return four aggregate rows, and add an execution-oriented test/query review.
- Radar labels can overlap. Mitigation: separate current/target label offsets and retain Tooltip.
- Tightening the constraint is breaking. Mitigation: preflight validation aborts if any level exceeds 4; current production data has already been checked and contains no 5.

## Migration Plan

1. Validate that current and history tables contain no level above 4.
2. Replace current/history level check constraints with 0–4 constraints in one transaction.
3. Deploy backend and frontend through the existing DEV GitHub Actions workflow.
4. Verify health, API validation and browser behavior on Jetson.

Rollback restores the previous code and, only when necessary, the previous 0–5 constraints with reviewed SQL. History rows are never deleted.

