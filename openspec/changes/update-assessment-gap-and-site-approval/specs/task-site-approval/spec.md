## ADDED Requirements

### Requirement: Engineer Site determines approval routing

The system SHALL route SNa assignments to Wang Ning and SCh assignments to Tyler using the assigned engineer's configured Site, independent of task location and requester. Approval and rejection MUST be authorized server-side for the current assignment.

#### Scenario: Work at another Site
- **WHEN** an SNa engineer is assigned a task located in SCh
- **THEN** Wang Ning is the approver

#### Scenario: Approver is also the assigned engineer
- **WHEN** a task is assigned to Wang Ning through the assignment workflow
- **THEN** Wang Ning may approve it himself

### Requirement: Administrator assignments cannot bypass approval

The system SHALL require Site approval for all task assignments, including administrator initial assignments. The legacy force-assign API MUST use the same pending approval and Site routing rules; the UI SHALL NOT offer a skip-approval action.

#### Scenario: Legacy force assignment
- **WHEN** an administrator calls the legacy force-assign API for an SCh engineer
- **THEN** the task is pending approval by Tyler, not already approved or awaiting employee acceptance

#### Scenario: Administrator assigns themselves through matching
- **WHEN** Wang Ning assigns a task to himself through the task assignment workflow
- **THEN** it is pending Site approval and he can approve it explicitly

#### Scenario: Missing Site mapping
- **WHEN** a legacy force-assignment request selects an engineer without a valid Site approval route
- **THEN** the server rejects the request without creating a task or bypassing approval

### Requirement: Every reassignment requires new approval

The system SHALL return a task to pending approval whenever its assigned engineer changes, including changes within the same Site and administrator edits. Previous approval or acceptance SHALL NOT authorize the new assignment. Stale approval actions MUST NOT approve a changed assignment.

#### Scenario: Same Site reassignment
- **WHEN** an approved task changes from Xue Ting to Ye Youjun
- **THEN** it becomes pending approval by Wang Ning again

#### Scenario: Cross Site reassignment
- **WHEN** a task changes from Xue Ting to Chen Jianjun
- **THEN** it becomes pending approval by Tyler and the previous SNa approval cannot be applied

### Requirement: Preserve self schedule and employee acceptance

The system SHALL preserve initial self-entered schedules without approval and retain employee acceptance after assigned-task approval. It SHALL NOT grant global administrator privileges merely to enable Site approval.

#### Scenario: Initial self schedule
- **WHEN** a user initially creates a schedule assigned to their own employee record
- **THEN** the selected allowed execution status is preserved without Site approval
