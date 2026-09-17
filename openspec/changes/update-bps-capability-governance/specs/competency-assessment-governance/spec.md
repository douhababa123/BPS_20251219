## ADDED Requirements

### Requirement: Module-scoped competency editing

The system SHALL allow administrators to edit all competency cells, module Owners to edit all employees only within their owned modules, and normal users to edit no competency cells.

#### Scenario: Module Owner edits owned module
- **WHEN** an authenticated active employee is the configured Owner of a skill's module
- **THEN** the employee may save valid changes for any employee in that module

#### Scenario: Module Owner edits another module
- **WHEN** a module Owner submits a change for a skill outside the owned module
- **THEN** the server returns HTTP 403 and changes no current, version or history data

#### Scenario: Normal user edits self
- **WHEN** a normal user attempts to edit the user's own competency
- **THEN** the UI exposes no edit action and the server rejects a bypassed request

#### Scenario: Owner configuration is invalid
- **WHEN** the configured Owner is ambiguous, missing, inactive or has no active account
- **THEN** the system fails closed for Owner editing and reports a configuration error to administrators

### Requirement: Drafted atomic batch save

The system SHALL keep edits as client-side drafts until Save is selected and SHALL persist all changed cells as one atomic business version.

#### Scenario: Save several cells
- **WHEN** an authorized user saves several valid changed cells
- **THEN** the system creates one version, updates every latest projection and appends every history row in one transaction

#### Scenario: One cell is invalid or unauthorized
- **WHEN** any cell in a batch fails value, permission or concurrency validation
- **THEN** the system rolls back the complete batch and leaves all persisted data unchanged

#### Scenario: Discard drafts
- **WHEN** the user discards unsaved changes
- **THEN** the page restores persisted values and creates no database record

### Requirement: Immutable annual competency baseline

The system SHALL allow only administrators to create an annual baseline from a validated Excel import or, for years after 2026, a selected saved competency version and SHALL retain immutable baseline detail rows. The 2026 baseline MUST come from a business-confirmed year-start Excel, never from the 2026-07-03 migration snapshot.

#### Scenario: Import the 2026 baseline
- **WHEN** an administrator previews and confirms a valid 2026 year-start file
- **THEN** the system creates a 2026 baseline without changing current assessments or existing history

#### Scenario: Select a future annual baseline
- **WHEN** an administrator selects a saved version for a later year
- **THEN** the system reconstructs that version and materializes its employee-skill cells as the year's baseline

#### Scenario: Replace an active baseline
- **WHEN** an administrator explicitly confirms replacement with another baseline for the same year and the expected active version is still current
- **THEN** the previous baseline remains auditable but becomes inactive
- **AND** exactly one baseline is active for the year

### Requirement: Administrator year-start Excel entry

The system SHALL provide an administrator-only “年初基线管理” tab within the existing Admin page with year selection, baseline status, template download, Excel upload, validation preview, explicit activation and revision inspection. The management APIs MUST enforce administrator authorization independently of the UI.

#### Scenario: Navigate from an unset Dashboard year
- **WHEN** an administrator selects “设置年初基线” for a Dashboard year without a baseline
- **THEN** the system opens baseline management with that year selected
- **AND** ordinary users see a contact-administrator message instead of the management action

#### Scenario: Non-admin bypasses the UI
- **WHEN** an authenticated non-administrator, including a module Owner, requests a baseline management API
- **THEN** the server returns HTTP 403 and makes no business-data changes

#### Scenario: Download a template
- **WHEN** an administrator downloads the year-start Excel template
- **THEN** it supplies employee/skill identifiers and verification labels with blank initial-current and annual-target score fields
- **AND** it does not prefill current assessment values as year-start scores

### Requirement: Validated and isolated baseline import

The system SHALL preview uploaded year-start Excel without writing business records and SHALL activate only after explicit administrator confirmation and server revalidation of the same previewed content and selected year. Each populated employee-skill row MUST have known identifiers, no duplicate pair, and numeric values satisfying `0 <= initial_current <= annual_target <= 4`. Errors MUST identify the row, field and reason and block the entire import.

#### Scenario: Invalid uploaded data
- **WHEN** the file is unreadable, lacks required columns or valid rows, or contains unknown identifiers, duplicate pairs, missing scores, nonnumeric scores, out-of-range scores or target below current
- **THEN** the system reports validation errors and permits no activation or partial import
- **AND** it does not create employees or skills to repair the file

#### Scenario: Zero and missing cells differ
- **WHEN** a file includes a valid current score of zero and omits other employee-skill pairs
- **THEN** zero participates in the preview and eventual baseline
- **AND** omitted pairs are not automatically created with zero scores

#### Scenario: Preview or cancel
- **WHEN** an administrator uploads and previews a file but has not confirmed activation, or cancels
- **THEN** no baseline business rows are persisted and all existing business records remain unchanged

#### Scenario: Change the year or file
- **WHEN** the administrator changes the selected year or file after preview
- **THEN** a new preview is required before activation

#### Scenario: Import a year-start file later in the year
- **WHEN** an administrator explicitly confirms a valid 2026 year-start Excel uploaded after January
- **THEN** it creates a baseline belonging to the selected year 2026 and records filename, source, confirmer and confirmation time
- **AND** it does not replace initial values with the July migration snapshot, overwrite current assessments, append or rewrite assessment history, modify other business records, or fabricate monthly changes
- **AND** the Dashboard refreshes using the newly active baseline

#### Scenario: Activation fails or races with another administrator
- **WHEN** baseline creation fails or the expected active version changed after preview
- **THEN** the complete activation is rejected or rolled back, retaining the previous active baseline
- **AND** a concurrency conflict requires the administrator to review the updated state before confirming again
