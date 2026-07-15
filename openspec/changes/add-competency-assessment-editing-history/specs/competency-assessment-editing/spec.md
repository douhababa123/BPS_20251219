## ADDED Requirements

### Requirement: Authorized matrix editing
The system SHALL allow an administrator to edit every employee's assessment and SHALL allow a normal engineer to edit only the assessment associated with the engineer's own employee record. Editing SHALL be available only from the default competency matrix in this phase.

#### Scenario: Administrator edits another employee
- **WHEN** an authenticated administrator opens an employee and skill cell in the matrix
- **THEN** the system allows the administrator to save the assessment

#### Scenario: Engineer edits own assessment
- **WHEN** an authenticated normal user opens a cell belonging to the employee matched by the user's email
- **THEN** the system allows the user to save the assessment

#### Scenario: Engineer attempts to edit another employee
- **WHEN** a normal user submits an assessment for any other employee
- **THEN** the server rejects the request with HTTP 403 and changes no current or historical data

#### Scenario: Non-matrix views remain read-only
- **WHEN** the user switches to the card view or table view
- **THEN** the system does not expose an assessment editing action

### Requirement: Valid competency levels
The system SHALL require integer current and target levels from 0 through 5 inclusive, SHALL treat current level 0 as valid data, and SHALL require target level to be greater than or equal to current level.

#### Scenario: Save zero current level
- **WHEN** an authorized user selects current level 0 and a target level from 0 through 5
- **THEN** the system saves and displays current level 0 as an assessed value

#### Scenario: Target below current
- **WHEN** a request contains a target level below its current level
- **THEN** the client prevents normal selection and the server rejects a bypassed request with HTTP 422

#### Scenario: Current level changes above selected target
- **WHEN** the user raises the current level above the previously selected target in the edit dialog
- **THEN** the system clears the target, displays a validation error and disables saving until a valid target is selected

#### Scenario: Missing required level
- **WHEN** current or target is missing
- **THEN** the system disables or rejects saving and leaves stored data unchanged

### Requirement: Uniform GAP presentation
The system SHALL show an assessed matrix cell in green when target equals current and SHALL show it in red with the exact GAP when target is greater than current. It SHALL NOT vary the color according to the positive GAP magnitude.

#### Scenario: Target equals current
- **WHEN** an assessment has equal current and target levels
- **THEN** its cell is green and does not display a GAP label

#### Scenario: Positive GAP
- **WHEN** an assessment target is greater than its current level
- **THEN** its cell is red and displays `GAP N`, where N is target minus current

#### Scenario: Valid zero values
- **WHEN** an existing assessment contains level 0
- **THEN** the matrix displays 0 and includes it in averages and GAP calculations rather than treating it as missing

### Requirement: Atomic current and history persistence
The system SHALL maintain one latest assessment per employee and skill and SHALL append exactly one complete history snapshot for every successful web save in the same database transaction.

#### Scenario: First assessment entry
- **WHEN** an authorized user saves a valid employee and skill combination that has no current record
- **THEN** the system creates one current record and one matching history snapshot

#### Scenario: Existing assessment update
- **WHEN** an authorized user saves a valid change to an existing assessment
- **THEN** the system updates the single current record and appends one history snapshot without overwriting earlier snapshots

#### Scenario: Persistence failure
- **WHEN** either the current update or history insert fails
- **THEN** the transaction rolls back both operations and returns an error

### Requirement: Quarterly history
The system SHALL retain every assessment modification, assign it to a server-derived calendar year and quarter, and provide an authenticated API for full history and the final version in each quarter.

#### Scenario: Multiple changes in one quarter
- **WHEN** an assessment is changed multiple times during the same quarter
- **THEN** all snapshots remain queryable and the quarterly-final query returns the one with the latest change timestamp

#### Scenario: Changes across a quarter boundary
- **WHEN** saves occur on opposite sides of a calendar quarter boundary
- **THEN** the system assigns them to different quarters based on their server timestamps

#### Scenario: History permissions
- **WHEN** a normal user requests another employee's history
- **THEN** the server returns HTTP 403, while an administrator may query that history

#### Scenario: Main page latest version
- **WHEN** a newer assessment has been saved in any quarter
- **THEN** the main competency page displays that globally latest current version

### Requirement: Existing data baseline migration
The system SHALL migrate every existing competency assessment into history before consolidating the current table to one latest row per employee and skill.

#### Scenario: Multiple legacy yearly rows
- **WHEN** an employee and skill have multiple existing yearly records
- **THEN** every legacy record becomes a migration-baseline history snapshot and only the deterministically latest record remains in the current table

#### Scenario: Migration validation failure
- **WHEN** baseline counts, uniqueness or level constraints fail validation
- **THEN** the migration transaction rolls back without deleting or consolidating the original records
