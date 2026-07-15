## 1. Approved design and specification

- [x] 1.1 Confirm 100px columns, vertical AM/PM order, complete wrapping, and connected first-fragment height synchronization.
- [x] 1.2 Update the design document and implementation plan.
- [x] 1.3 Validate the updated OpenSpec change in strict mode.

## 2. Vertical layout rules

- [ ] 2.1 Add failing tests for connected/FULL_DAY, AM, and PM vertical ordering.
- [ ] 2.2 Replace half-column packing with stable full-width vertical rows.

## 3. Complete task cards and connected height

- [ ] 3.1 Add failing component tests for complete wrapping, secondary metadata, height reporting, and shared height application.
- [ ] 3.2 Implement natural-height task cards and first-fragment measurement.

## 4. Calendar integration

- [ ] 4.1 Add failing renderer tests for single-column full-width cards and shared connected height.
- [ ] 4.2 Convert assigned and unassigned date cells to vertical rendering.
- [ ] 4.3 Set header and body date cells to a 100px minimum width.

## 5. Verification and deployment

- [ ] 5.1 Run focused/full tests, TypeScript, focused lint, build, whitespace, and strict OpenSpec validation.
- [ ] 5.2 Verify complete names, vertical order, and connected equal-height seamless bands locally in Firefox.
- [ ] 5.3 Merge to `DEV`, rerun merged verification, and push.
- [ ] 5.4 Confirm GitHub Actions code-quality and Jetson deployment jobs succeed.
- [ ] 5.5 Recheck the deployed Jetson calendar in Firefox.
