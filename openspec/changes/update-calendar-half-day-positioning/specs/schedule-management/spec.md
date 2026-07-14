## ADDED Requirements

### Requirement: Horizontal half-day task positioning

The system SHALL communicate half-day timing through task-card position inside each calendar date cell without rendering a visible sub-grid.

#### Scenario: Morning task
- **WHEN** a date contains an AM task
- **THEN** the task card occupies the left 50 percent of the date cell
- **AND** no visible half-cell divider, background, or heading is added

#### Scenario: Afternoon task
- **WHEN** a date contains a PM task
- **THEN** the task card occupies the right 50 percent of the date cell
- **AND** the unused left half remains visually empty

#### Scenario: Full-day task
- **WHEN** a date contains a FULL_DAY task
- **THEN** the task card spans the complete usable width of the date cell

#### Scenario: Morning and afternoon on the same date
- **WHEN** one AM task and one PM task occur on the same date for the same engineer
- **THEN** the two cards share one horizontal lane in the left and right halves respectively
- **AND** each card remains independently clickable

#### Scenario: Multiple tasks in one half-day
- **WHEN** multiple tasks occupy the same AM or PM half-day
- **THEN** the tasks stack vertically within that half
- **AND** the half is not subdivided horizontally again

#### Scenario: Connected task compatibility
- **WHEN** a connected task over 8h crosses a date boundary
- **THEN** each fragment uses the horizontal position implied by its time slot
- **AND** all fragments remain the same height and on a stable lane
- **AND** the task name and total continuous hours appear only on the leftmost fragment

#### Scenario: Truncated half-width label
- **WHEN** a half-width card cannot display its complete label
- **THEN** the visible label is truncated
- **AND** hover information exposes the complete task details
