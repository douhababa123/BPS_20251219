# BPS Compass Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every user-visible legacy platform name with `BPS Compass` and consistently display `Guide the Right people to the Right projects.` on primary brand surfaces.

**Architecture:** Store the approved name, Slogan, and footer in one immutable TypeScript constant consumed by React surfaces. Keep `index.html` static and add source-level regression tests that prevent legacy platform names from returning while leaving BPS business vocabulary untouched.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library

## Global Constraints

- Platform name MUST be exactly `BPS Compass`.
- Slogan MUST be exactly `Guide the Right people to the Right projects.` including capitalization and punctuation.
- Footer MUST be exactly `© 2026 Bosch BPS Compass`.
- Do not rename `BPS elements`, `BPS Engineer`, `BPS_ENGINEER`, functional page titles, imported business data, historical reports, or screenshots.
- Do not change database schema, backend APIs, authorization, colors, fonts, logo graphics, or layout structure.

---

### Task 1: Central brand copy

**Files:**
- Create: `src/lib/branding.ts`
- Create: `src/lib/__tests__/branding.test.ts`

**Interfaces:**
- Produces: `BRAND.name`, `BRAND.slogan`, and `BRAND.footer` as readonly string literals.
- Consumes: No project-specific interfaces.

- [ ] **Step 1: Write the failing constant test**

```ts
import { describe, expect, it } from 'vitest';
import { BRAND } from '../branding';

describe('BPS Compass brand copy', () => {
  it('exposes the approved user-visible copy', () => {
    expect(BRAND).toEqual({
      name: 'BPS Compass',
      slogan: 'Guide the Right people to the Right projects.',
      footer: '© 2026 Bosch BPS Compass',
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/__tests__/branding.test.ts`

Expected: FAIL because `src/lib/branding.ts` does not exist.

- [ ] **Step 3: Add the immutable brand constant**

```ts
export const BRAND = {
  name: 'BPS Compass',
  slogan: 'Guide the Right people to the Right projects.',
  footer: '© 2026 Bosch BPS Compass',
} as const;
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/__tests__/branding.test.ts`

Expected: 1 test passed.

- [ ] **Step 5: Commit the central brand copy**

```powershell
git add -- src/lib/branding.ts src/lib/__tests__/branding.test.ts
git commit -m "feat: centralize BPS Compass branding"
```

---

### Task 2: Replace React user-facing platform names

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/LoginScreen.tsx`
- Modify: `src/components/SimpleLoginScreen.tsx`
- Modify: `src/components/BindEmailScreen.tsx`
- Modify: `src/components/ProfileSetupScreen.tsx`
- Modify: `src/components/SignupScreen.tsx`
- Modify: `src/components/OTPLogin.tsx`
- Modify: `src/pages/auth/PasswordLoginPage.tsx`
- Modify: `src/pages/auth/RegisterPage.tsx`
- Modify: `src/lib/__tests__/branding.test.ts`

**Interfaces:**
- Consumes: `BRAND` from `src/lib/branding.ts`.
- Produces: React brand surfaces with approved name, Slogan, and footer and no legacy platform-name phrases.

- [ ] **Step 1: Add a failing source regression test**

Add `readFileSync` to the import block, then append the test data and test:

```ts
import { readFileSync } from 'node:fs';

const reactBrandSurfaces = [
  '../../components/Sidebar.tsx',
  '../../components/LoginScreen.tsx',
  '../../components/SimpleLoginScreen.tsx',
  '../../components/BindEmailScreen.tsx',
  '../../components/ProfileSetupScreen.tsx',
  '../../components/SignupScreen.tsx',
  '../../components/OTPLogin.tsx',
  '../../pages/auth/PasswordLoginPage.tsx',
  '../../pages/auth/RegisterPage.tsx',
];

const legacyPlatformNames = [
  'BPS 能力与排程平台',
  'BPS Capacity & Scheduling',
  'BPS 能力管理系统',
  'BPS 管理系统',
  'BPS 系统',
];

it('removes legacy platform names from React brand surfaces', () => {
  for (const path of reactBrandSurfaces) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const legacyName of legacyPlatformNames) {
      expect(source, `${path} still contains ${legacyName}`).not.toContain(legacyName);
    }
  }
});
```

- [ ] **Step 2: Run the source regression test and verify RED**

Run: `npm test -- src/lib/__tests__/branding.test.ts`

Expected: FAIL and identify React surfaces that still contain legacy platform names.

- [ ] **Step 3: Import the brand constant into component surfaces**

Use this import in files under `src/components`:

```ts
import { BRAND } from '../lib/branding';
```

Use this import in files under `src/pages/auth`:

```ts
import { BRAND } from '../../lib/branding';
```

- [ ] **Step 4: Update the sidebar brand block**

Replace the sidebar heading and subtitle with:

```tsx
<h1 className="text-lg font-bold text-blue-900">{BRAND.name}</h1>
<p className="text-xs text-gray-500 mt-1 leading-relaxed">{BRAND.slogan}</p>
```

- [ ] **Step 5: Update authentication and onboarding brand blocks**

Where an existing heading is the platform name, render:

```tsx
<h1 className="text-3xl font-bold text-gray-900 mb-2">{BRAND.name}</h1>
<p className="text-gray-600 text-sm">{BRAND.slogan}</p>
```

Where the main heading is an action such as “欢迎回来” or “创建账号”, keep that action heading and replace the old platform-description line with:

```tsx
<p className="text-gray-700 font-medium">{BRAND.name}</p>
<p className="text-gray-500 text-sm mt-1">{BRAND.slogan}</p>
```

Replace each platform footer with:

```tsx
<p className="text-xs text-center text-gray-500">{BRAND.footer}</p>
```

Keep step instructions such as email/OTP guidance as separate text below the brand copy.

- [ ] **Step 6: Run focused tests and type checking**

Run: `npm test -- src/lib/__tests__/branding.test.ts`

Expected: 2 branding tests pass.

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 7: Commit React brand surfaces**

```powershell
git add -- src/components/Sidebar.tsx src/components/LoginScreen.tsx src/components/SimpleLoginScreen.tsx src/components/BindEmailScreen.tsx src/components/ProfileSetupScreen.tsx src/components/SignupScreen.tsx src/components/OTPLogin.tsx src/pages/auth/PasswordLoginPage.tsx src/pages/auth/RegisterPage.tsx src/lib/__tests__/branding.test.ts
git commit -m "feat: apply BPS Compass across user surfaces"
```

---

### Task 3: Browser title and final regression verification

**Files:**
- Modify: `index.html`
- Modify: `src/lib/__tests__/branding.test.ts`

**Interfaces:**
- Consumes: Approved static platform name.
- Produces: Browser document title `BPS Compass` and a repository-level guard for user-facing source files.

- [ ] **Step 1: Add a failing browser-title test**

Append the following test to `src/lib/__tests__/branding.test.ts`:

```ts
it('uses BPS Compass as the browser title', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  expect(html).toContain('<title>BPS Compass</title>');
  expect(html).not.toContain('BPS Capacity Scheduling Platform');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/__tests__/branding.test.ts`

Expected: FAIL with 1 failed browser-title test because `index.html` still contains `BPS Capacity Scheduling Platform`.

- [ ] **Step 3: Replace the static browser title**

```html
<title>BPS Compass</title>
```

- [ ] **Step 4: Verify no user-facing legacy platform name remains**

Run:

```powershell
rg -n 'BPS 能力与排程平台|BPS Capacity & Scheduling|BPS 能力管理系统|BPS 管理系统|BPS Capacity Scheduling Platform' src index.html
```

Expected: no matches. Matches in documentation, reports, screenshots, `BPS elements`, role names, and functional page titles are outside scope.

- [ ] **Step 5: Run complete frontend verification**

Run: `npm test`

Expected: all test files pass.

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: production build completes successfully; existing chunk-size warnings are acceptable.

- [ ] **Step 6: Commit the browser title and regression guard**

```powershell
git add -- index.html src/lib/__tests__/branding.test.ts
git diff --cached --check
git commit -m "feat: finish BPS Compass browser branding"
```

---

### Task 4: Deployment verification

**Files:**
- No source files expected.

**Interfaces:**
- Consumes: Completed commits from Tasks 1–3 and the existing `DEV` GitHub Actions workflow.
- Produces: Verified Jetson deployment of the exact pushed commit.

- [ ] **Step 1: Confirm only intended source changes are committed**

Run: `git status --short`

Expected: no staged branding files; unrelated pre-existing cache, screenshot, export, and documentation changes may remain unstaged.

- [ ] **Step 2: Push the implementation commits**

Run: `git push origin DEV`

Expected: `DEV` advances to the local HEAD and triggers `jetson-deploy.yml`.

- [ ] **Step 3: Watch the exact deployment run**

```powershell
$sha = git rev-parse HEAD
$run = gh run list --workflow jetson-deploy.yml --branch DEV --commit $sha --limit 1 --json databaseId | ConvertFrom-Json
gh run watch $run.databaseId --interval 10 --exit-status
```

Expected: code-quality and Jetson deployment jobs both complete successfully for `$sha`.

- [ ] **Step 4: Verify the deployed application**

Run:

```powershell
(Invoke-WebRequest -Uri 'http://10.70.80.183:3000/' -UseBasicParsing).StatusCode
(Invoke-RestMethod -Uri 'http://10.70.80.183:8000/api/health').status
```

Expected: frontend HTTP status `200` and backend status `healthy`.

- [ ] **Step 5: Verify deployed branding in a browser**

Open `http://10.70.80.183:3000/` and confirm the browser title, authentication surface, and authenticated sidebar show `BPS Compass`; confirm primary brand regions show the complete Slogan and no legacy platform name.
