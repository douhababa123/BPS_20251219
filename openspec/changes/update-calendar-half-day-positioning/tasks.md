## 1. Layout rules

- [x] 1.1 Add failing tests for AM/PM/full-day columns, same-half stacking, AM/PM lane pairing, hidden fragments, and stable connected-task lanes.
- [x] 1.2 Implement the pure calendar-day lane builder and make its focused tests pass.

## 2. Calendar rendering

- [x] 2.1 Add a tested reusable date-cell task renderer with an invisible two-column grid.
- [x] 2.2 Replace assigned and unassigned date-cell task loops with the shared renderer.
- [x] 2.3 Preserve fixed card height, connected edges, leftmost-only labels, click behavior, truncation, and complete hover information.

## 3. Verification

- [x] 3.1 Run focused and full frontend tests, TypeScript checking, focused lint, and production build.
- [x] 3.2 Validate this OpenSpec change in strict mode.
- [x] 3.3 Verify AM-left, PM-right, FULL_DAY-full-width, same-day pairing, invisible partition, and connected bands in Firefox.

## 4. Deployment

- [ ] 4.1 Merge to `DEV`, push, and confirm code-quality and Jetson deployment jobs succeed.
- [ ] 4.2 Refresh the Jetson page in Firefox and confirm the deployed layout.
