# Change: Position half-day calendar tasks horizontally

## Why

AM and PM tasks currently use the same full-width calendar-card placement, so users must read an icon to understand whether work occurs in the morning or afternoon. The calendar should communicate time-of-day through position while preserving its current uncluttered grid appearance.

## What Changes

- Position AM task cards in an invisible left half of each date cell.
- Position PM task cards in an invisible right half of each date cell.
- Keep FULL_DAY task cards at full width.
- Pair one AM and one PM task on the same horizontal lane; stack additional tasks within their own half.
- Preserve connected-task alignment, fixed height, stable ordering, and leftmost-only labels.
- Add no visible half-day divider, background, heading, or sub-cell border.

## Impact

- Affected specs: `schedule-management`
- Related active change: `enhance-schedule-and-competency` (this change supersedes only its earlier upper/lower visual placement for AM/PM cards)
- Affected code: `src/lib/scheduleRules.ts`, `src/pages/Schedule.tsx`, `src/components/TaskCard.tsx`, a focused calendar-day renderer, and related tests
- Backend/API/database impact: none
