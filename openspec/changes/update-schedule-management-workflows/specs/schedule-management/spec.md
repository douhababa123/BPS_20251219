## ADDED Requirements

### Requirement: Descending Competence Hour Bars
The schedule page SHALL display team and personal competence-hour distributions as bar charts ordered from highest total hours to lowest.

#### Scenario: Competence totals are displayed
- **WHEN** the selected schedule contains tasks in multiple competence areas
- **THEN** the system aggregates task hours by competence area
- **AND** renders the areas as bars in descending hour order
- **AND** uses the configured competence color for each bar

### Requirement: Task Form Location and Optional Status
The task form SHALL offer `Supplier` instead of `GPU-SU` for new tasks and SHALL allow task status to remain unselected.

#### Scenario: Create a standard task
- **WHEN** a user opens the new-task form
- **THEN** Location includes `Supplier` and excludes `GPU-SU`
- **AND** task status is a non-required select
- **AND** submitting an empty status persists `planned`

#### Scenario: Edit a legacy location
- **WHEN** an existing task has Location `GPU-SU`
- **THEN** the edit form preserves the current legacy value until the user changes it

### Requirement: Leave Task Form Mode
The task form SHALL enforce Leave-specific automatic values and prevent irrelevant input.

#### Scenario: Select Leave
- **WHEN** task type changes to `Leave`
- **THEN** task name becomes `Leave`
- **AND** Location becomes `out of office`
- **AND** competence, competence item, assigned engineer, status, and notes are cleared and disabled
- **AND** task type, start date, end date, and time slot remain editable
- **AND** disabled fields do not block submission validation

#### Scenario: Leave mode is exited
- **WHEN** task type changes from `Leave` to another type
- **THEN** automatically generated task name and Location are cleared
- **AND** ordinary fields become editable again

### Requirement: Connected Continuous Task Bands
The calendar SHALL render work exceeding 8 continuous hours as a connected band only when all records belong to the same engineer, task name, and task type and their date/time slots are adjacent.

#### Scenario: Full day continues next morning
- **WHEN** the same task covers FULL_DAY on one date and AM on the next natural date
- **THEN** the system treats the slots as an 11.5h continuous segment
- **AND** renders connected start and end fragments across the two date cells
- **AND** shows the task name and 11.5h total only on the start fragment

#### Scenario: Next-day afternoon has a gap
- **WHEN** the same task covers FULL_DAY on one date and PM on the next natural date
- **THEN** the missing next-day AM interrupts continuity
- **AND** the calendar renders independent 8h and 4.5h task cards

#### Scenario: Identity differs
- **WHEN** adjacent slots have a different engineer, task name, or task type
- **THEN** they are not combined into one continuous band

#### Scenario: Continuous duration does not exceed eight hours
- **WHEN** a continuous segment totals 8h or less
- **THEN** the calendar keeps the ordinary per-slot task-card presentation

#### Scenario: Interact with a connected fragment
- **WHEN** a user hovers or clicks any fragment of a connected band
- **THEN** the fragment exposes the complete task information
- **AND** clicking opens the associated task detail without modifying persisted task records
