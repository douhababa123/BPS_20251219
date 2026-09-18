## ADDED Requirements

### Requirement: Matching eligibility gates

The system SHALL apply employee/account status, full requested-slot availability, assessment presence, `current_level >= required_level`, and existing role thresholds before candidate ranking.

#### Scenario: Candidate meets a lower requirement
- **WHEN** a candidate has current Level 3, the task requires Level 2 and all other gates pass
- **THEN** the candidate is eligible for ranking

#### Scenario: Candidate meets the exact requirement
- **WHEN** a candidate has current Level 3, the task requires Level 3 and all other gates pass
- **THEN** the candidate is eligible for ranking

#### Scenario: Candidate is below the requirement
- **WHEN** a candidate has current Level 3 and the task requires Level 4
- **THEN** the candidate is excluded before scoring

#### Scenario: Candidate has a time conflict
- **WHEN** any required task slot conflicts with a non-cancelled, non-completed assignment
- **THEN** the candidate is excluded regardless of competency Level

#### Scenario: Resource-only candidate is exempt from schedule conflicts
- **WHEN** Tyler Tan or Tong Zhifeng is an active candidate with all requested assessments at or above the required Levels and passes the role gate
- **THEN** the candidate remains eligible regardless of existing schedule records
- **AND** the candidate is treated as fully available for matching score and explanation
- **AND** all other candidates continue to be excluded when their requested slots conflict

### Requirement: Complete deterministic eligible ranking

The system SHALL return all eligible candidates ordered by the existing weighted skill score with employee name as a stable tie-breaker, while a suggested-user preference SHALL NOT bypass eligibility gates.

#### Scenario: More than five candidates qualify
- **WHEN** more than five candidates pass every eligibility gate
- **THEN** the API returns all qualified candidates
- **AND** the UI may initially show five while allowing the user to expand the complete list
