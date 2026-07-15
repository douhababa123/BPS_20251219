## 1. Specification and test baselines

- [x] 1.1 Add frontend aggregation tests for 0 values, module averages, total GAP, per-person distribution and name-sorted matrix.
- [x] 1.2 Add backend tests for 0–4 validation and quarter-end trend semantics.
- [x] 1.3 Add component tests for removed Ranking UI, data labels, dynamic skill counts and removed personal average GAP.

## 2. Four-level capability enforcement

- [x] 2.1 Restrict assessment edit controls and frontend validation to 0–4.
- [x] 2.2 Restrict backend request models and transactional save validation to 0–4.
- [x] 2.3 Add a preflighted migration that tightens current and history constraints to 0–4.

## 3. Current competency analytics

- [x] 3.1 Update pure aggregation so valid zero levels participate in averages and all GAP totals are direct sums.
- [x] 3.2 Add module/skill per-person GAP distribution aggregation.
- [x] 3.3 Convert the ranked employee/module matrix to a name-sorted GAP summary.

## 4. Quarter-end trend API

- [x] 4.1 Implement active employee/skill quarter-end snapshot aggregation with cross-quarter and cross-year carry-forward.
- [x] 4.2 Add module/skill validation, `hasData`, authenticated aggregate response and API tests.
- [x] 4.3 Add the frontend API client, types and React Query hook.

## 5. Competency profile UI

- [x] 5.1 Remove the Ranking tab and duplicate Gap Analysis radar while retaining the renamed GAP summary matrix.
- [x] 5.2 Make Gap Distribution show total GAP only.
- [x] 5.3 Add the option-A per-person distribution chart and filters.
- [x] 5.4 Add the quarterly total GAP trend and linked filters.
- [x] 5.5 Change Total Score charts to module averages on 0–4 axes with data labels while retaining KPI/detail totals.
- [x] 5.6 Remove personal module average GAP and use module total GAP.
- [x] 5.7 Split only the affected large page sections into focused components.

## 6. Verification and release

- [x] 6.1 Run focused frontend/backend tests, full relevant suites, typecheck and production build.
- [x] 6.2 Validate OpenSpec and record implementation evidence.
- [ ] 6.3 Push DEV to trigger the existing GitHub Actions Jetson deployment.
- [ ] 6.4 Verify Actions, Jetson health, 0–4 editing and competency profile behavior in Firefox.

