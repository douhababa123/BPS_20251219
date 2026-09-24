## ADDED Requirements

### Requirement: Monthly GAP composition drill-down

The Dashboard SHALL let the user open a drawer by selecting a monthly GAP bar. The drawer MUST show the selected month's competency-skill GAP composition for the same year, annual baseline, module and employee scope as the chart, including employee, module, skill, current level, annual target and GAP. Its skill GAP sum MUST equal the selected bar value.

#### Scenario: Historical month selected
- **WHEN** the user selects a historical month bar
- **THEN** the drawer displays skill levels as of that month's end and a GAP sum equal to the bar height

#### Scenario: Current month selected
- **WHEN** the user selects the ongoing month's bar
- **THEN** the drawer labels the result as partial, uses the current cutoff time and does not claim to represent month-end data

#### Scenario: Filters or baseline change
- **WHEN** the selected month, year, module, person or annual baseline differs between chart and drawer data
- **THEN** the drawer MUST NOT display the mismatched detail as if it belonged to the selected bar

#### Scenario: Accessible inspection
- **WHEN** a keyboard user inspects a month bar
- **THEN** they can open the drawer, read the contents and close it with Escape or the close control
