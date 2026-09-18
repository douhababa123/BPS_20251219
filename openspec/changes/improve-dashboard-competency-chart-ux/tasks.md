## 1. Regression baselines

- [x] 1.1 Capture desktop and narrow-content screenshots for Dashboard and all Competency chart modes.
- [x] 1.2 Add/adjust component tests that lock current chart data, order, 0–4 domains and filter behavior.
- [x] 1.3 Record a no-change diff check for `src/pages/Schedule.tsx` and `src/pages/Calendar.tsx`.

## 2. Shared chart presentation

- [x] 2.1 Add the minimal shared chart semantic colors, tooltip presentation and empty-state helpers used by at least two in-scope components.
- [x] 2.2 Apply consistent typography, grid, axis, legend, value formatting and reduced-motion behavior.
- [x] 2.3 Add accessible chart names/summaries without changing business data.

## 3. Dashboard chart

- [x] 3.1 Improve the GAP/close-rate combination chart axis units, legend order, selected-month emphasis and tooltip hierarchy.
- [x] 3.2 Verify the selected month chart values still equal the corresponding KPI values.

## 4. Competency team charts

- [x] 4.1 Convert module/skill GAP distribution to a readable horizontal comparison layout with full labels.
- [x] 4.2 Convert employee GAP distribution to a readable horizontal layout while preserving no-assessment semantics.
- [x] 4.3 Improve quarterly trend labels, missing-quarter explanation, Tooltip and responsive layout.

## 5. Competency total and personal charts

- [x] 5.1 Improve nine-module radar spacing, wrapped labels, legend and series distinction while retaining the 0–4 scale and data labels.
- [x] 5.2 Convert module-average comparison to a horizontal grouped bar chart with 0–4 scale and direct labels.
- [x] 5.3 Keep the personal skill radar unchanged, retain the personal module radar, and convert only the personal GAP distribution to horizontal bars.
- [x] 5.4 Add meaningful empty states for missing module, skill or employee data.

## 6. Verification

- [x] 6.1 Run focused component tests, the full frontend test suite, TypeScript typecheck and production build.
- [x] 6.2 Perform authenticated browser visual checks at 1440×1000 and 1024×768 for all in-scope chart modes.
- [x] 6.3 Confirm `Schedule.tsx` and `Calendar.tsx` remain byte-for-byte unchanged.
- [x] 6.4 Confirm the personal skill radar retains its existing chart type, layout, data and interaction.
- [ ] 6.5 Deploy through the existing GitHub Actions Jetson workflow only when separately requested or confirmed.
