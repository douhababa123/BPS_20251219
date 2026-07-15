## ADDED Requirements

### Requirement: Four-level competency scale
The system SHALL accept only integer current and target levels from 0 through 4 inclusive at the user interface, API and database boundaries, SHALL treat 0 as valid, and SHALL require target to be greater than or equal to current.

#### Scenario: Enter a valid level
- **WHEN** an authorized user selects current and target levels satisfying `0 <= current <= target <= 4`
- **THEN** the system saves the current projection and one history snapshot

#### Scenario: Attempt to save level 5
- **WHEN** a client submits current or target level 5
- **THEN** the server rejects the request with HTTP 422 and changes no current or historical data

#### Scenario: Tighten existing database constraints
- **WHEN** the deployment migration verifies that current and history records contain no level above 4
- **THEN** it replaces the prior 0-through-5 constraints with 0-through-4 constraints without rewriting assessment values
- **AND** it aborts without changing constraints if preflight validation fails

