## ADDED Requirements

### Requirement: Matching eligibility gates

The system SHALL require active employee/account status, assessment presence for every requested competency, a valid competency-fit category, and existing role thresholds before candidate ranking. A requested competency has a valid fit when its target Level equals the required Level or its current Level is at least the required Level. Schedule conflicts SHALL affect availability priority rather than exclude an otherwise eligible candidate.

#### Scenario: Development-target candidate is eligible
- **WHEN** a candidate has current Level 2, target Level 3, the task requires Level 3 and all other gates pass
- **THEN** the candidate is eligible as a target-matched development candidate

#### Scenario: Exact-current candidate is eligible
- **WHEN** a candidate has current Level 3, target Level 4, the task requires Level 3 and all other gates pass
- **THEN** the candidate is eligible as an exact-current candidate

#### Scenario: Overqualified-current candidate is eligible
- **WHEN** a candidate has current Level 4, target Level 4, the task requires Level 3 and all other gates pass
- **THEN** the candidate is eligible as an overqualified-current candidate

#### Scenario: Candidate has no valid competency fit
- **WHEN** a candidate has current Level 2, target Level 4 and the task requires Level 3
- **THEN** the candidate is excluded before ranking

#### Scenario: Candidate has a partial time conflict
- **WHEN** an otherwise eligible candidate is available for only part of the requested working time
- **THEN** the candidate remains visible with the calculated time-fit percentage and conflict details

#### Scenario: Resource-only candidate is exempt from schedule conflicts
- **WHEN** Tyler Tan or Tong Zhifeng is an active candidate with valid competency fits for all requested competencies and passes the role gate
- **THEN** the candidate remains eligible regardless of existing schedule records
- **AND** the candidate is treated as 100% available for matching priority and explanation

### Requirement: Time-first deterministic candidate ranking

The system SHALL return all eligible candidates using lexicographic priority rather than a blended score. It SHALL compare time-fit percentage first; only equal time-fit candidates SHALL be compared by weighted target-Level exact-match rate, then weighted current-Level exact-match rate, then the smallest weighted current-Level overqualification. Key competencies SHALL have weight 2 and ordinary competencies weight 1. Suggested-user preference and employee name SHALL only break ties after all business priorities.

#### Scenario: Time outranks a better competency fit
- **WHEN** one candidate is 100% available but overqualified and another candidate is 80% available with target Level exactly matching the requirement
- **THEN** the 100%-available candidate ranks first

#### Scenario: All candidates have schedule conflicts
- **WHEN** no eligible candidate is 100% available
- **THEN** candidates are still returned in descending time-fit order
- **AND** competency fit is considered only between candidates with the same time-fit percentage

#### Scenario: Equal-time competency order
- **WHEN** candidates have equal time-fit percentages
- **THEN** a target-Level exact match ranks before a current-Level exact match
- **AND** a current-Level exact match ranks before a current Level above the requirement
- **AND** smaller overqualification ranks before larger overqualification

#### Scenario: Suggested user cannot override business priority
- **WHEN** the suggested user has a lower time-fit percentage than another eligible candidate
- **THEN** the candidate with the higher time-fit percentage ranks first

#### Scenario: More than five candidates qualify
- **WHEN** more than five candidates pass every eligibility gate
- **THEN** the API returns all qualified candidates
- **AND** the UI may initially show five while allowing the user to expand the complete list
