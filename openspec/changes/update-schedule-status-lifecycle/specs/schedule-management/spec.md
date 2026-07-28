## ADDED Requirements

### Requirement: Past Schedule Automatic Completion
The system SHALL persist eligible schedules as `completed` after their end date has passed.

#### Scenario: Past self-entered planned schedule
- **WHEN** a schedule was created by and assigned to the same user
- **AND** its status is `planned`
- **AND** its `end_date` is earlier than the server's current date
- **THEN** the system changes its persisted status to `completed`

#### Scenario: Past active accepted task
- **WHEN** a task status is `in_progress` or `confirmed`
- **AND** its `end_date` is earlier than the server's current date
- **THEN** the system changes its persisted status to `completed`

#### Scenario: Task has not ended
- **WHEN** a task's `end_date` is today or later
- **THEN** the system does not automatically change its status

#### Scenario: Protected workflow state
- **WHEN** a past task is `pending_approval`, `rejected`, `employee_rejected`, or `cancelled`
- **THEN** the system does not automatically change it to `completed`

#### Scenario: Assigned task still awaits acceptance
- **WHEN** a past `planned` task was created by a different user than its assigned employee
- **THEN** the system leaves it in `planned` for explicit acceptance or rejection handling

### Requirement: Schedule Editing by Ownership
The system SHALL distinguish full editing of self-entered schedules from status-only updates of tasks assigned by another creator.

#### Scenario: Owner edits self-entered schedule in any status
- **WHEN** a user opens a task that the same user created and assigned to themselves
- **THEN** the page offers full edit and delete actions regardless of whether the status is `planned`, `in_progress`, `completed`, `cancelled`, or `confirmed`
- **AND** the backend permits changes to the task content, dates, hours, assignment, and status

#### Scenario: Assignee updates execution status
- **WHEN** a task was created by another user and assigned to the current employee
- **AND** the task has been accepted
- **THEN** the assignee can change only its execution status among `confirmed`, `in_progress`, and `completed`

#### Scenario: Assignee attempts to edit assigned task content
- **WHEN** an assignee who did not create the task attempts to change its name, type, location, dates, hours, engineer, notes, or deletion state
- **THEN** the system rejects the operation

#### Scenario: Assignment awaits acceptance
- **WHEN** an assigned task is still waiting for the assignee to accept or reject it
- **THEN** the page uses the existing accept/reject workflow and does not expose the execution-status control

#### Scenario: Administrator manages any task
- **WHEN** an administrator opens any task
- **THEN** full edit and delete actions remain available
