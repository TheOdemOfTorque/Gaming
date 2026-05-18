# Testing

**Analysis Date:** 2026-05-10

## Overview

Only `1x1-trainer/` has tests. `prime-empire/`, `space-invader-revibed/`, and `vibe-coding-demo-4-timm/` have zero test coverage. Tests live at the repo root, not inside any game directory.

Two frameworks:
- **Jest** — unit tests for pure functions extracted to `1x1-trainer/logic.js`
- **Playwright** — E2E browser tests for the 1x1-trainer UI

## Running Tests

```bash
npm test           # runs Jest (unit tests only)
npm run test:unit  # runs Jest tests/unit/
npm run test:e2e   # runs Playwright tests/e2e/
```

No combined "run all" script covering both unit and E2E.

## Directory Layout

```
tests/
  unit/
    blitz-logic.test.js      # Jest: pickBlitzReihe, addBlitzListeEntry, migrateBlitzState
    division-logic.test.js   # Jest: resolveRechenart, migrateDivState
  e2e/
    blitz.spec.js            # Playwright: Blitz-Modus picker UI flows
    division.spec.js         # Playwright: Rechenart-Toggle UI flows across all modes
```

## Unit Tests (Jest)

### What gets unit tested

Only functions in `1x1-trainer/logic.js`. When adding new business logic, extract to `logic.js` and add Jest tests — `index.html` cannot be `require()`d by Jest.

### File structure

```js
const { fnName } = require('../../1x1-trainer/logic.js');

describe('fnName', () => {
  test('beschreibung auf deutsch', () => {
    expect(fnName(input)).toBe(expected);
  });
});
```

- Import path: always `../../1x1-trainer/logic.js` (two levels up from `tests/unit/`)
- Test descriptions in German, matching the UI language
- `describe` block name matches the function name exactly
- No `beforeEach`, no setup/teardown — functions are pure

### Randomness testing

```js
test('gibt mult oder div zurück bei gemischt', () => {
  const results = new Set();
  for (let i = 0; i < 200; i++) results.add(resolveRechenart({ rechenart: 'gemischt' }));
  expect(results.has('mult')).toBe(true);
  expect(results.has('div')).toBe(true);
  expect(results.has('gemischt')).toBe(false);
});
```

### No mocking

No `jest.fn()`, no `jest.mock()`, no spies. All tested functions are pure.

### No coverage thresholds

No `coverageThreshold` in Jest config.

## E2E Tests (Playwright)

### Configuration (`playwright.config.js`)

```js
module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 390, height: 844 },  // iPhone-shaped, mobile-first
  },
  webServer: {
    command: 'python3 -m http.server 8080 --directory ...',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Known issue:** `webServer.command` still points to `.worktrees/feature-division` (stale — branch merged). Update to the gaming repo root before running E2E tests.

**Viewport:** 390×844 — always iPhone-shaped.

### beforeEach pattern

```js
test.beforeEach(async ({ page }) => {
  await page.goto('/1x1-trainer/');
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  // Handle first-run name screen if present
  const nameInput = page.locator('#name-input');
  if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameInput.fill('Test');
    await page.click('button:has-text("Los geht")');
  }
});
```

Always: navigate → clear state → reload → conditionally skip name screen. Copy this verbatim for any new E2E spec file.

### page.evaluate() escape hatch

When clicking a visually disabled element, call the app function directly:

```js
async function selectReihe(page, nth) {
  await page.evaluate((n) => {
    const btns = document.querySelectorAll('#blitz-reihe-grid .blitz-reihe-btn');
    toggleBlitzReihe(n + 1, btns[n]);
  }, nth);
}
```

### Test description language

All test descriptions in German:

```js
test('Blitz-Karte öffnet Reihen-Picker', ...)
test('Alle-Reihen ist nach erstem Start vorausgewählt', ...)
```

### No fixtures, no Page Object Model

Helper functions as plain `async function` at top of each spec file.

## What Is Not Tested

- `prime-empire/` — Phaser 3 game; no tests
- `space-invader-revibed/` — canvas game; no tests
- `vibe-coding-demo-4-timm/` — canvas game; no tests
- Service worker (`sw.js`) — not tested
- Audio (`AudioContext` synthesis) — not tested
- localStorage migrations below v3

## Adding New Tests

**New pure function in logic.js:**
1. Add function to `1x1-trainer/logic.js`
2. Add it to `module.exports` at bottom of `logic.js`
3. Add `describe` block in `tests/unit/*.test.js`
4. Descriptions in German, assertions using Jest `expect`

**New UI feature in 1x1-trainer:**
1. New spec in `tests/e2e/` or extend existing spec
2. Copy `beforeEach` reset pattern verbatim
3. Use `page.locator()` with CSS selectors matching existing ID/class conventions
4. Use `page.evaluate()` for app-internal state or disabled elements
5. Descriptions in German
