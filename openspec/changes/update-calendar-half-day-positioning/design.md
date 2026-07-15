## Context

The team calendar uses a table cell for every engineer/date intersection. Half-width AM/PM cards made task labels unreadable. The approved design returns each card to the complete date-cell width and communicates time through vertical order.

## Goals / Non-Goals

- Goals: 100px minimum date columns; complete wrapped labels; connected/FULL_DAY -> AM -> PM order; seamless connected fragments whose height follows the first fragment.
- Non-goals: change time-slot values, persisted tasks, continuity identity, workload calculations, APIs, or database structures.

## Decisions

### Single-column vertical flow

Each date cell uses one full-width column. Connected and ordinary FULL_DAY cards render first, AM cards next, and PM cards last. Same-slot tasks stack in stable task order. No visible sub-grid is introduced.

### Complete labels and natural height

Visible task names use normal wrapping and long-word breaking without truncation or line clamps. Status, slot, and hours move to a smaller second line. Card and engineer-row heights grow naturally.

### Connected first-fragment measurement

The first connected fragment wraps its complete name inside only the first date cell. It reports its rendered content height under `groupId`. `Schedule` shares the latest height with every date cell so middle/end fragments render empty at exactly the same height. Layout-stage measurement and `ResizeObserver` updates cover initial rendering and later width/font changes.

### Connected edges

The first fragment keeps only left rounding, middle fragments keep no side rounding, and the end keeps only right rounding. Existing edge overlap removes date-cell padding gaps. Every fragment remains independently clickable and points to the same task behavior.

## Risks / Trade-offs

- Complete names increase row height. This is intentional and bounded horizontally by 100px minimum date columns.
- Height measurement can cause a brief mismatch. Layout-stage measurement updates before paint; 26px is only a safe initial minimum.
- More column width increases horizontal scrolling. The existing calendar scroll container remains authoritative.

## Migration Plan

No data migration is required. Deploy the frontend through the existing `DEV` GitHub Actions workflow. Rollback is a normal frontend revert.
