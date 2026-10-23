## ADDED Requirements

### Requirement: Nonnegative business GAP with overachievement

The system SHALL accept required integer current and target levels from 0 through 4 independently. Business GAP SHALL equal max(target - current, 0) per skill before aggregation. Current at or above target SHALL display green achieved status. Saved actual levels and historical versions MUST remain intact.

#### Scenario: Overachievement must not cancel another skill deficit
- **WHEN** a person has current/target values 4/2 and 1/3
- **THEN** the two business GAP values are 0 and 2 and the total is 2
- **AND** the original values 4/2 and 1/3 remain saved

### Requirement: Assessment roster exclusions preserve access

The system SHALL omit Tong Zhifeng and Tyler Tan from the competency assessment participant roster without disabling either account or changing their roles, existing records, or resource-matching eligibility.

#### Scenario: Tyler remains an administrator
- **WHEN** Tyler opens competency assessment
- **THEN** his participant row is absent and his existing administrator access remains available
