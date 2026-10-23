# Dependency hardening and Site approval release

## Scope and status

User requested dependency risk remediation before deploying the approved Site
approval and nonnegative competency GAP changes. On 2026-10-23 the user accepted
recording the residual Tailwind build-tool risks and deploying without a
Tailwind 4 migration. No unrelated chart UX changes are included in this release.

## Dependency changes

| Package | Selected version |
| --- | --- |
| xlsx | 0.20.3, local `vendor/xlsx-0.20.3.tgz` |
| axios | 1.20.0 |
| react-router-dom / react-router | 7.18.4 |
| ws (transitive) | 8.22.0 |
| vite | 6.4.5 (Node 18-compatible build tooling for Jetson) |
| @vitejs/plugin-react | 4.7.0 |
| vitest / @vitest/coverage-v8 | 4.1.12 (tests on Node 22) |

Compatible indirect dependencies were refreshed in the lockfile. npm 10's
dependency resolver failed with `edgesOut` while resolving Vitest optional peers;
npm 11.13.0 generated the lockfile successfully. `npm ci` with npm 10.9.3 / Node
22.20.0 subsequently installed it successfully. No `--force` or
`--legacy-peer-deps` was used. `.npmrc` disables install lifecycle scripts.

SheetJS archive source, received SHA-256 and verification limitations are recorded
in `vendor/README.md`. The archive has no install lifecycle scripts. It is shipped
with the repository so CI and Jetson do not require corporate CDN authentication.

## Audit and accepted residual risk

Audit results on 2026-10-23:

- Before: production npm audit 7 findings (6 high, 1 moderate); full npm audit
  43 findings (3 critical, 30 high, 8 moderate, 2 low).
- After: `npm audit --omit=dev` reports **0 findings**.
- Full audit: **7 findings**, 5 high and 2 moderate, all in the Tailwind build
  dependency chain. These are package/dependency-chain counts, not 7 independent
  vulnerabilities.
- Remaining roots: `braces` stack exhaustion
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) and
  `postcss-selector-parser` selector parsing CPU exhaustion
  ([GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)).
- Propagated findings: chokidar, micromatch, fast-glob, postcss-nested, tailwindcss.
- These are used to compile repository-owned sources and static glob patterns;
  the application does not expose a user-supplied glob/CSS compilation endpoint.
  They remain installed on the build host and therefore are **not claimed fixed**.
- Mitigation: build only reviewed source/configuration; do not feed untrusted
  patterns/CSS into the build. Retain Tailwind 3.4.19 to avoid an unreviewed
  site-wide visual migration. Schedule Tailwind 4 and visual regression separately.
- GitHub Actions now gates releases on the production npm audit. This is not a
  claim that Python dependencies, container images, or all security risks were audited.

## Regression checks

- Working-tree frontend suite: 27 files / 208 tests pass, including 10 new
  SheetJS compatibility/import validation cases; TypeScript and Vite build pass.
- A real import regression test exposed the active matrix parser's stale 1–5 /
  target>=current validation. It now accepts integer 0–4 independently and keeps
  original values, consistent with the approved business rules. Invalid numbers
  are rejected; historical data is not rewritten.
- Backend isolated unit suite: 151 tests pass. Real DB/API integration tests were
  excluded to avoid creating test data in the shared business database.
- Existing lint debt and build chunk-size/mixed-import warnings are not treated
  as resolved. No new lint bypass was added.
- Clean release worktree at commit `1597017622cd92d9af232bf6ba0e5aedad3ed5d6`:
  npm ci, TypeScript, 27 frontend test files / 208 tests, Vite production build,
  151 isolated backend tests, and strict OpenSpec validation all pass.
- Clean release ESLint reports 294 errors and 12 warnings; the newly added Excel
  regression file has zero errors/warnings. Lint remains nonblocking as in the
  existing workflow; this is not a clean-lint release.
- Deployment run: https://github.com/douhababa123/BPS_20251219/actions/runs/39890151969
  completed successfully at 2026-10-23 10:36 Asia/Shanghai. Both cloud CI and
  self-hosted Jetson deployment succeeded, including the new production audit gate.

## Database protection

Before migration on 2026-10-23, database `NAASWIGQM01P / DCCT_BPS_Debug`:

| Table (excluding new tasks.approval_version) | Rows | CHECKSUM_AGG(BINARY_CHECKSUM(...)) |
| --- | ---: | ---: |
| competency_assessments | 464 | 1666997958 |
| competency_assessment_history | 534 | 1297710477 |
| tasks | 680 | -1417446473 |
| employees | 29 | -2070071012 |
| users | 27 | -372401666 |

`approval_version` did not exist; legacy pending self-assigned schedules = 0.
COPY_ONLY full backup with CHECKSUM and compression completed at 10:28:53:

`D:\DATA01\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\Backup\DCCT_BPS_Debug_pre_site_approval_20261023_102852.bak`

SQL Server backup history confirms is_copy_only=1, has_backup_checksums=1,
backup_size=20,025,344 bytes. Restore verification is not claimed; the existing
application account lacks the previously documented RESTORE VERIFYONLY permission.
Migration 010 only removes target>=current constraints; migration 011 adds an
approval version with default 0. Original assessment values and history are retained.

## Post-deployment verification

- Jetson checkout: `1597017622cd92d9af232bf6ba0e5aedad3ed5d6`.
- `http://10.70.80.183:3000/`: HTTP 200; new frontend bundle
  `index-DubbnHmS.js`, stylesheet `index-VBHlh71m.css`.
- `/api/health`: healthy, database connected; backend container healthy and
  frontend container running.
- `/api/openapi.json`: deployed Task schema includes `approval_version`.
- Served frontend bundle includes `approval_version` and `can_approve`.
- Migration 011 column exists (INT / length 4); both target>=current constraints
  are gone; current/target 0–4 check constraints remain enabled.
- All five table counts and original-column checksums above are unchanged after
  deployment, including the 680 tasks. No test accounts/tasks/assessments created.
- Real-directory read-only check resolves all 15 configured engineers to their
  Site approver: SNa -> Wang Ning; SCh -> Tyler Tan.
- No authenticated browser role-by-role acceptance/reassignment flow was executed
  against production. Those behaviors have isolated automated regression coverage;
  live interaction testing that changes business tasks is not claimed.
