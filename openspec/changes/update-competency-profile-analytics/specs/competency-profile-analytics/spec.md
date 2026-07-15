## ADDED Requirements

### Requirement: Team competency analysis structure
The system SHALL remove the independent Ranking subview and SHALL retain the employee-by-module GAP summary inside Gap Analysis without ranks or ranking order.

#### Scenario: View team competency analysis
- **WHEN** a user opens the team competency profile
- **THEN** only Gap Analysis and Total Score subviews are available
- **AND** Gap Analysis contains an employee/module GAP summary sorted by employee name with employee, module and team totals

### Requirement: Total Score module averages
The system SHALL show current and target averages for all nine competency modules in the Total Score radar and bar charts on a fixed 0 through 4 scale and SHALL display one-decimal data labels on both charts.

#### Scenario: Render Total Score charts
- **WHEN** current-year competency assessments are available
- **THEN** each active assessment, including level 0, participates in its module average
- **AND** the radar and bar axes have a maximum of 4
- **AND** current and target values are visible as chart labels
- **AND** existing total KPI cards and the total detail table remain available

### Requirement: Total GAP distribution
The system SHALL display direct GAP totals, and not average GAP, in the team Gap Distribution chart for both module and skill dimensions.

#### Scenario: Switch distribution dimension
- **WHEN** a user switches Gap Distribution between modules and skills
- **THEN** the chart shows direct total GAP for every available item in the selected dimension
- **AND** it does not show an average GAP series

### Requirement: Per-person GAP distribution
The system SHALL allow a user to choose module or skill dimension and one item, then compare the selected item's GAP across all current active engineers with one bar per engineer.

#### Scenario: Compare an item across engineers
- **WHEN** a user selects a module or skill
- **THEN** every current active engineer is represented
- **AND** bars sort by GAP descending with employee name as a stable tie-breaker
- **AND** engineers with zero GAP remain visible

### Requirement: Quarter-end total GAP trend
The system SHALL show Q1 through Q4 total GAP for the selected year using complete quarter-end snapshots and linked module and skill filters.

#### Scenario: Carry a value into an unchanged quarter
- **WHEN** an employee and skill have no modification in a quarter but have an earlier valid history record
- **THEN** the quarter-end snapshot uses that earlier record, including a record from a previous year

#### Scenario: Filter the trend
- **WHEN** a user selects a module and optionally an active skill in that module
- **THEN** one trend line shows the quarter-end total GAP within that filter
- **AND** changing module resets an incompatible skill selection

#### Scenario: Distinguish no baseline from zero GAP
- **WHEN** a quarter has no historical baseline for the selected scope
- **THEN** the API returns total GAP 0 with `hasData` false
- **AND** a genuine zero GAP snapshot returns `hasData` true

### Requirement: Personal module total GAP
The system SHALL use direct module total GAP in the personal profile and SHALL NOT display module average GAP.

#### Scenario: View a personal profile
- **WHEN** a user selects an engineer and views module-level GAP analysis
- **THEN** the module chart shows total GAP
- **AND** the module summary table has no average GAP column
- **AND** skill-level analysis continues to show each skill's individual GAP

