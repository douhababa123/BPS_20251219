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

### Requirement: Traceable competency changes

The system SHALL record every successful competency save with the modification time, authenticated modifier and explicit before/after current and target Levels. Administrators SHALL be able to review all competency changes, while module Owners SHALL only be able to review changes in their owned modules. Ordinary users SHALL not have access to the change log.

#### Scenario: Save a changed cell
- **WHEN** an authorized user successfully changes a persisted competency cell
- **THEN** its immutable history row records the save time, modifier user ID, business version ID, previous current/target Levels and new current/target Levels

#### Scenario: Create a previously missing cell
- **WHEN** an authorized user saves an employee-skill cell that did not previously exist
- **THEN** the history row records NULL previous Levels and the submitted new Levels so the UI identifies the change as a new entry

#### Scenario: Review change content
- **WHEN** an administrator opens the competency change log
- **THEN** the page shows the modification time, affected employee, module and skill, current/target before-and-after content, and modifier name/email
- **WHEN** a module Owner opens the competency change log
- **THEN** it contains only changes for modules currently owned by that user

#### Scenario: Preserve pre-audit history
- **WHEN** the audit schema is added to a database with existing history
- **THEN** no existing row is updated or deleted
- **AND** unavailable previous values remain NULL and are presented as legacy or unknown values

#### Scenario: Rejected save creates no audit record
- **WHEN** a batch fails validation, authorization or optimistic concurrency checks
- **THEN** no version, latest projection or audit-history row is committed

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

### Requirement: Confirmed 2026 source-workbook conversion

The annual baseline importer SHALL require a worksheet named exactly `Current_Target states`, ignore every other worksheet, and automatically accept either the standard long-form template or the confirmed original wide C/T layout on that sheet. The 2026 wide-layout conversion SHALL read only the visible C/T values, map only uniquely identified active employees and active skills, omit resource-only employees Tyler Tan and Tong Zhifeng, and create preview rows without modifying the source workbook or any database record.

#### Scenario: Exact source sheet is present
- **WHEN** an administrator uploads a workbook containing `Current_Target states` and additional worksheets
- **THEN** the system reads only `Current_Target states` and reports that sheet name in the preview

#### Scenario: Exact source sheet is missing
- **WHEN** an administrator uploads a workbook without a worksheet named exactly `Current_Target states`
- **THEN** validation fails without writing business data
- **AND** the response identifies the required name and the worksheet names that were detected

#### Scenario: Convert each C/T value combination
- **WHEN** both C and T contain values
- **THEN** the pair is included subject to `0 <= C <= T <= 4`
- **WHEN** C is blank and T contains a value
- **THEN** the pair is included with C equal to 0
- **WHEN** C and T are both blank
- **THEN** the pair is treated as not applicable and omitted
- **WHEN** C contains a value and T is blank
- **THEN** conversion fails validation unless the missing target has been explicitly confirmed

#### Scenario: Apply the confirmed Xu Qingyue provisional target
- **WHEN** the converter reaches Xu Qingyue / Ship to line with C equal to 1 and blank T
- **THEN** it includes the row with annual target 2
- **AND** later edits to the current assessment target do not retroactively change the immutable 2026 baseline target

#### Scenario: Exclude resource-only employees from baseline
- **WHEN** the 2026 standard upload workbook is generated
- **THEN** it contains no baseline row for Tyler Tan or Tong Zhifeng
- **AND** their current competency data, if later entered, remains available to resource matching

### Requirement: Complete removable baseline preview

The administrator UI SHALL warn uploaders to verify the exact `Current_Target states` worksheet name before selection, SHALL display all converted rows through a paginated preview with source coordinates and conversion results, and SHALL allow an unconfirmed file and its preview to be removed without persistence. Validation failures SHALL be shown as actionable row, field and reason messages rather than a generic transport error.

#### Scenario: Preview original wide workbook
- **WHEN** an administrator uploads a valid confirmed wide workbook
- **THEN** the preview shows the source sheet, source employee count, imported count, omitted not-applicable count, error count and KPI aggregates
- **AND** every converted row is available in the paginated detail table before activation

#### Scenario: Remove a pending upload
- **WHEN** the administrator removes a selected file before activation
- **THEN** the file control, preview and validation messages are cleared
- **AND** no baseline or other business row is written

#### Scenario: Replace an active baseline from a new upload
- **WHEN** an administrator previews a new valid workbook and explicitly confirms replacement
- **THEN** the new version becomes the only active baseline for the year
- **AND** the former active version and its immutable details remain available as history

### Requirement: Guided active-baseline replacement

The administrator UI SHALL make modification of an active annual baseline an explicit immutable replacement workflow. It SHALL allow the administrator to download the complete active baseline as a populated, re-importable `Current_Target states` workbook and SHALL explain the required download, edit, preview and confirm steps.

#### Scenario: Download the active baseline for editing
- **WHEN** an administrator selects “下载当前基线” for a year with an active baseline
- **THEN** the system downloads only that active version's employee-skill cells with existing initial-current and annual-target values
- **AND** the workbook can be uploaded through the same validation-preview process after editing

#### Scenario: Start replacement from the current-status card
- **WHEN** an administrator selects “修改/替换年初基线”
- **THEN** the page directs focus to the upload area and shows the replacement steps
- **AND** no persisted data changes until a valid preview is explicitly confirmed

#### Scenario: Confirm replacement
- **WHEN** an administrator confirms a valid replacement preview while the expected active version is still current
- **THEN** the replacement becomes active, the previous version becomes historical and current assessments/history remain unchanged
