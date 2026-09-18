## ADDED Requirements

### Requirement: Chart optimization scope isolation

The system SHALL apply this chart presentation change only to Dashboard and Competency Profile, and MUST NOT change Schedule Management or the legacy Calendar page.

#### Scenario: Schedule pages remain unchanged
- **WHEN** the chart presentation change is implemented
- **THEN** `src/pages/Schedule.tsx` and `src/pages/Calendar.tsx` have no code or visual behavior changes from this change

### Requirement: Consistent chart visual language

Dashboard and Competency Profile charts SHALL use consistent semantic colors, typography, grid lines, legends, units, value formatting and tooltips. Current, target, GAP, close-rate and unavailable states MUST remain distinguishable without relying on color alone.

#### Scenario: Same metric appears across views
- **WHEN** the same metric is rendered in more than one in-scope chart
- **THEN** its label, value format, unit and semantic presentation are consistent across those charts

### Requirement: Readable category comparisons

Charts comparing long-named modules, skills or employees SHALL use a horizontal comparison layout that displays complete category names without rotated labels. Dense datasets MUST preserve all business data and MAY use an internally scrollable plot area.

#### Scenario: Thirty-eight skills are displayed
- **WHEN** the user selects the skill dimension with up to 38 skills
- **THEN** every skill remains available in the chart, labels are not rotated, and the page does not gain horizontal overflow from the plot

#### Scenario: Employee distribution is displayed
- **WHEN** the employee GAP distribution contains many employees
- **THEN** names remain readable and existing business sorting and missing-assessment meaning are preserved

### Requirement: Appropriate competency chart types

The system SHALL retain nine-module radar charts for module-level overview and SHALL retain their 0–4 domain. The existing personal skill-level radar chart MUST remain unchanged in chart type, layout, data and interaction.

#### Scenario: Personal module mode
- **WHEN** the user selects module mode in Personal View
- **THEN** the nine-module current/target radar remains available with readable labels and legend

#### Scenario: Personal skill mode
- **WHEN** the user selects skill mode in Personal View
- **THEN** the existing current/target skill radar chart is displayed without structural or presentation changes from this change

### Requirement: Dashboard trend clarity

The Dashboard GAP trend SHALL retain its GAP bar and close-rate line, identify both axes and units, order its legend by business reading order, and visually identify the selected YTD month. Chart values MUST remain identical to the corresponding selected-month KPI values.

#### Scenario: Selected month is inspected
- **WHEN** a user selects a year, month and module and inspects that month in the chart
- **THEN** the displayed GAP and close rate match the KPI cards using the same value formatting

### Requirement: Chart states and accessibility

Each in-scope chart SHALL expose a meaningful accessible name or summary, SHALL show an explicit empty/error state instead of an empty coordinate frame, and SHALL respect reduced-motion preferences.

#### Scenario: No chart data exists
- **WHEN** an in-scope chart receives no usable data
- **THEN** the user sees an explanatory empty state and no misleading zero-valued plot

#### Scenario: Assistive technology reads a chart
- **WHEN** a user navigates the page with assistive technology
- **THEN** the chart topic, filtered scope and represented series can be identified without interpreting color alone
