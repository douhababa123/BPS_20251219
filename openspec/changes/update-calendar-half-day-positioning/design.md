## Context

The team calendar renders each engineer/date intersection as one table cell and currently stacks task cards vertically. Existing rules already identify AM, PM, FULL_DAY, and connected segments over 8h. A previous fix also keeps connected fragments on a stable lane and at a fixed 26px height.

## Goals / Non-Goals

- Goals: make AM/PM visually distinguishable by horizontal position; allow AM and PM to share a lane; retain connected-band behavior; keep the half-cell structure invisible.
- Non-goals: change time-slot values, use 3.5/4.5 proportional widths, add hour ticks, change persisted records, or alter workload calculations.

## Decisions

### Invisible two-column layout

Each date cell uses a CSS grid with two equal columns and no column gap or visible decoration. AM occupies column 1, PM occupies column 2, and FULL_DAY spans columns 1–2.

### Greedy stable lane packing

Tasks first use the existing stable calendar ordering. A full-day task always creates an exclusive row. An AM task uses the earliest row without a full-day or AM task, and a PM task uses the earliest row without a full-day or PM task. This lets AM and PM share a row while stacking multiple tasks in the same half.

### Connected bands

Existing connected-segment metadata remains authoritative. Stable ordering places the same connected group on the same earliest lane across dates. PM-to-next-AM and FULL_DAY-to-next-AM fragments meet at the date boundary through the existing connected-edge styles. Labels remain visible only on the leftmost fragment.

## Risks / Trade-offs

- Half-width cards have less text space. Existing truncation and complete hover text mitigate this.
- Independent day-cell layout can drift if ordering is unstable. The renderer must consume the existing stable sort before packing lanes.
- Visible gaps would undermine the time-band metaphor. The two grid columns must have no gap or divider; only task-card position communicates AM/PM.

## Migration Plan

No data migration is required. Deploy the frontend change through the existing `DEV` GitHub Actions workflow. Rollback is a normal revert of the frontend commit.
