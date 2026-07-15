## ADDED Requirements

### Requirement: Vertical half-day task positioning and complete labels

The system SHALL render calendar tasks in full-width vertical time-slot order and SHALL display every visible task name in full.

#### Scenario: Morning and afternoon tasks
- **WHEN** a date contains AM and PM tasks
- **THEN** every card occupies the complete usable width of the date cell
- **AND** AM cards appear above PM cards
- **AND** no visible AM/PM sub-grid is rendered

#### Scenario: Complete ordinary task name
- **WHEN** a task name exceeds the available width of its 100px-minimum date column
- **THEN** the name wraps without truncation or line clamping
- **AND** the task card and engineer row grow to contain the complete name

#### Scenario: Full-day task
- **WHEN** a date contains a FULL_DAY task
- **THEN** the card occupies the complete usable width of the date cell
- **AND** its complete visible name wraps when necessary

#### Scenario: Connected task label and height
- **WHEN** a connected task crosses one or more date boundaries
- **THEN** its first fragment wraps the complete task name within the first date cell
- **AND** middle and end fragments omit repeated text
- **AND** every fragment uses the measured height of the first fragment
- **AND** adjacent fragments connect without a visible gap

#### Scenario: Multiple tasks in one slot
- **WHEN** multiple tasks occupy the same AM, PM, or FULL_DAY slot
- **THEN** the tasks stack vertically in stable order

#### Scenario: Complete interactions
- **WHEN** any ordinary or connected task fragment is clicked or hovered
- **THEN** clicking opens the same task detail behavior as before
- **AND** hover information exposes complete task details
