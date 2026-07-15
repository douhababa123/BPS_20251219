## 1. Specification and test baselines

- [ ] 1.1 Add frontend aggregation tests for 0 values, module averages, total GAP, per-person distribution and name-sorted matrix.
- [ ] 1.2 Add backend tests for 0–4 validation and quarter-end trend semantics.
- [ ] 1.3 Add component tests for removed Ranking UI, data labels, dynamic skill counts and removed personal average GAP.

## 2. Four-level capability enforcement

- [ ] 2.1 Restrict assessment edit controls and frontend validation to 0–4.
- [ ] 2.2 Restrict backend request models and transactional save validation to 0–4.
- [ ] 2.3 Add a preflighted migration that tightens current and history constraints to 0–4.

## 3. Current competency analytics

- [ ] 3.1 Update pure aggregation so valid zero levels participate in averages and all GAP totals are direct sums.
- [ ] 3.2 Add module/skill per-person GAP distribution aggregation.
- [ ] 3.3 Convert the ranked employee/module matrix to a name-sorted GAP summary.

## 4. Quarter-end trend API

- [ ] 4.1 Implement active employee/skill quarter-end snapshot aggregation with cross-quarter and cross-year carry-forward.
- [ ] 4.2 Add module/skill validation, `hasData`, authenticated aggregate response and API tests.
- [ ] 4.3 Add the frontend API client, types and React Query hook.

## 5. Competency profile UI

- [ ] 5.1 Remove the Ranking tab and duplicate Gap Analysis radar while retaining the renamed GAP summary matrix.
- [ ] 5.2 Make Gap Distribution show total GAP only.
- [ ] 5.3 Add the option-A per-person distribution chart and filters.
- [ ] 5.4 Add the quarterly total GAP trend and linked filters.
- [ ] 5.5 Change Total Score charts to module averages on 0–4 axes with data labels while retaining KPI/detail totals.
- [ ] 5.6 Remove personal module average GAP and use module total GAP.
- [ ] 5.7 Split only the affected large page sections into focused components.

## 6. Verification and release

- [ ] 6.1 Run focused frontend/backend tests, full relevant suites, typecheck and production build.
- [ ] 6.2 Validate OpenSpec and record implementation evidence.
- [ ] 6.3 Push DEV to trigger the existing GitHub Actions Jetson deployment.
- [ ] 6.4 Verify Actions, Jetson health, 0–4 editing and competency profile behavior in Firefox.

