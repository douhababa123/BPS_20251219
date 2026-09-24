## ADDED Requirements

### Requirement: Annual competency progress KPIs

The system SHALL display year-start Level, target Level, current Level, year-start total GAP, current total GAP and GAP close rate from one active annual baseline and saved competency values as of the selected statistical month's cutoff, using month-end for completed months and query time for the ongoing month in Asia/Shanghai.

#### Scenario: Calculate annual KPIs
- **WHEN** a user opens a year with an active annual baseline
- **THEN** year-start and target Level use the baseline current and target values
- **AND** current Level uses the latest saved current values before the selected cutoff for the same baseline cells, excluding later edits
- **AND** Level 0 participates while missing baseline cells do not enter the denominator
- **AND** current GAP compares latest current values with the fixed baseline targets

#### Scenario: Year-start GAP is zero
- **WHEN** the baseline total GAP is zero
- **THEN** the close rate is displayed as unavailable rather than dividing by zero

#### Scenario: Baseline is missing
- **WHEN** the selected year has no active annual baseline
- **THEN** the system displays a missing-baseline state and does not substitute migration history

#### Scenario: Resource-only employees are outside competency development KPIs
- **WHEN** Tyler Tan or Tong Zhifeng has current competency assessments for resource matching
- **THEN** those assessments do not enter annual Level, GAP, close-rate or trend calculations because neither employee is present in the annual baseline scope

### Requirement: Monthly GAP and close-rate trend

The system SHALL display month-end total GAP as bars and YTD GAP close rate as a line in one dual-axis chart with consecutive natural months from January through the selected statistical month.

#### Scenario: Month has no changes
- **WHEN** no competency save occurs during a month
- **THEN** the month-end snapshot carries forward the latest earlier value, beginning with the annual baseline

#### Scenario: View the current year
- **WHEN** the user selects the current year
- **THEN** completed months use month-end snapshots
- **AND** the current month uses the latest saved values
- **AND** future months have no plotted value

### Requirement: Linked annual month and module filters

The system SHALL apply the selected year, statistical month and either all modules or one of the nine competency modules to all six KPIs and the monthly trend. The three baseline metrics SHALL remain unchanged when only the month changes.

#### Scenario: Select a module
- **WHEN** the user selects one competency module
- **THEN** every KPI and monthly point is recalculated only from baseline cells in that module
- **AND** the schedule-only `Others` category is not available in this filter

#### Scenario: Select a statistical month
- **WHEN** the user selects June for an available year
- **THEN** current/YTD metrics use June's cutoff and the trend displays January through June
- **AND** the year and module remain unchanged
- **AND** edits after June do not affect June's current values

#### Scenario: Defaults and future periods
- **WHEN** the user initially opens the Dashboard or switches years
- **THEN** the current year defaults to its current month and a past year defaults to December
- **AND** future months cannot be selected and future years, if listed, show a not-started state without progress values
- **AND** the ongoing month is labeled as through the current cutoff, not a completed month-end result

### Requirement: Baseline employee filter

The system SHALL offer all people and individual employees from the selected year's active baseline. The selected employee SHALL constrain the same baseline employee-skill cells and saved history for all six KPIs, every monthly trend point and the displayed baseline-cell count. It SHALL preserve the fixed annual targets and existing calculation rules.

#### Scenario: Select one employee
- **WHEN** a user selects an employee from the annual baseline
- **THEN** all six KPIs and every trend point include only that employee's baseline cells
- **AND** the scope label and baseline-cell count identify that employee's scope

#### Scenario: Combine employee and module filters
- **WHEN** a user selects an employee and a competency module
- **THEN** results include only that employee's cells within that module
- **AND** an empty intersection displays no baseline data rather than zero-valued KPIs

#### Scenario: Select all people or switch year
- **WHEN** a user selects all people
- **THEN** existing team-wide calculations remain unchanged
- **AND** switching the year resets employee selection to all people until that year's baseline employees are available

### Requirement: Ordered KPI layout and dynamic titles

The system SHALL display six equal-width KPI cards on one row at viewport widths of at least 1280px in the order year-start Level, target Level, current Level, year-start GAP, current GAP and close rate, with ordered wrapping at smaller widths. Titles SHALL reflect the selected year and two-digit statistical month.

#### Scenario: June labels and responsive layout
- **WHEN** the user selects 2026 and June
- **THEN** current Level is labeled with `2026 YTD06`, current GAP is labeled `GAP YTD06`, and close rate is labeled with `2026 YTD06`
- **AND** a shared scope label identifies the year, module and cutoff
- **AND** resizing to a narrow viewport wraps cards without truncating values or losing their order

### Requirement: Consistent KPI and chart snapshots

The system SHALL return all KPI values and monthly points from one consistent response with selected filters, baseline ID and cutoff. Current GAP and close-rate KPIs MUST reuse the final selected-month series values with identical display formatting in chart tooltips. Stale responses MUST NOT overwrite current filter results.

#### Scenario: June GAP closure example
- **WHEN** baseline GAP is 200 and June GAP is 160 for the selected scope
- **THEN** `GAP YTD06` and the June bar are both 160
- **AND** the close-rate KPI and June line point both display 20 percent
- **AND** these equalities continue to hold after module filtering

#### Scenario: Rapid filter changes or request failure
- **WHEN** filters change with overlapping requests or a request fails
- **THEN** the page displays synchronized loading or error states rather than new labels with old values
- **AND** only a response matching the current filter selection may populate the KPI cards and chart

#### Scenario: Zero baseline GAP has no close-rate point
- **WHEN** the selected scope has zero baseline GAP
- **THEN** the close-rate KPI displays `—` and the corresponding line points are unavailable, not zero percent
- **AND** the tooltip explains that the rate is not applicable
