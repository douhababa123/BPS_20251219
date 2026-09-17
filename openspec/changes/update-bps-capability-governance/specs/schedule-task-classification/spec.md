## ADDED Requirements

### Requirement: Others schedule competence

The system SHALL provide `Others` as a schedule task competence category without creating a competency skill or requiring a competence item.

#### Scenario: Create an Others task
- **WHEN** a user selects `Others` while creating or editing a non-Leave task
- **THEN** the competence item is marked not applicable
- **AND** the freely entered task name describes the work
- **AND** the task persists the canonical competence value `Others`

#### Scenario: Aggregate Others schedule hours
- **WHEN** schedule competence hours are calculated
- **THEN** `Others` tasks are included as their own schedule category
- **AND** they are excluded from competency assessment and dashboard KPI calculations

#### Scenario: Preserve existing tasks
- **WHEN** the new category is deployed
- **THEN** no existing task competence value is rewritten
