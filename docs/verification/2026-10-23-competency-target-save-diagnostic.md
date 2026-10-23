# Competency target save diagnostic (2026-10-23, Asia/Shanghai)

## Scope

User reports targets disappearing after logout/login, including changes by Liu Kui,
and requested Zhang Fanmin as an example. Production checks were read-only. No
assessment, account, permission, or historical record was changed or restored.

## Confirmed reproduction

Used the real MatrixView and AssessmentEditDialog components with a local mocked
persistence callback and Zhang Fanmin's read-only sample: Leading in a BPS Plant,
current 3 / target 3. Changed target to 4 in the local test only.

Command executed twice (generic fixture, then Zhang Fanmin fixture):

`npm test -- src/components/__tests__/TargetPersistence.diagnostic.test.tsx --reporter=verbose`

| Local interaction | Persistence callback count | Simulated server target | New target survives remount |
| --- | ---: | ---: | --- |
| Dialog Save only | 0 | 3 | No; assertion fails |
| Dialog Save, then page Save | 1 | 4 | Yes; assertion passes |

The temporary diagnostic test was removed after capturing this evidence. It was
not a live HTTP write or live login test; the successful control does not prove
that every production save request succeeds.

## Mechanism

- AssessmentEditDialog labels its submit button `保存`, but explains in smaller
  text that edits first enter a page draft.
- MatrixView's onSave stores the edit in React `drafts` state and closes the dialog.
  The edited number immediately appears in the matrix.
- Only the separate page Save calls `onSaveAssessments`, which calls
  `/competency-assessments/batch-save` from CompetencyAssessment.
- Drafts are not persisted across component remount or logout. There is no
  beforeunload/route-leave guard in MatrixView. Both buttons use the same label.

This confirms a UI flow that produces the reported symptom, but the user's exact
click sequence and any failed production HTTP response have not been captured.

## Production read-only observations

- No saved business versions or competency history dated October 22 or 23 were
  found. Latest saved batch is October 21. The query included October 21 onward
  to cover possible server timezone differences; SQL clock was UTC+8, whereas
  application-created naive timestamps can differ by server timezone.
- Zhang Fanmin has no duplicate current rows for the same skill. Latest history
  timestamp is 2026-08-31 05:50:55.621224 (stored raw timestamp); 25 history rows.
- Leading in a BPS Plant currently remains 3 / 3; no sample test write was made.
- Two Liu Kui-related accounts exist: `liu.kui@bosch.com` is an enabled normal
  user with no editable modules under the current Owner rule;
  `kui.liu3@bshg.com` is an enabled administrator with all-module edit permission.
  No rights were changed. Which account the user actually used is unconfirmed.

## Proposed correction at diagnosis time

Retain approved batch/version semantics, rename dialog action to `加入待保存修改`,
make a persistent page action `保存全部修改`, show an explicit server-confirmed
success/version message, and warn before navigation/logout with unsaved drafts.
If the user already clicked both Save buttons, capture the failing response and
account used before attributing the incident solely to draft handling.

Follow-up: the user approved the correction. Local implementation and validation
are recorded in [assessment-save-ux](2026-10-23-assessment-save-ux.md); deployment
and a live account persistence test are not part of that validation.
