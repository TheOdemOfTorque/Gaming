# Testable-Logic-Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pure Funktionen aus `1x1-trainer/index.html` nach `1x1-trainer/logic.js` extrahieren, sodass sie mit Jest testbar werden — ohne das aktuelle Browser-Verhalten zu ändern.

**Architecture:** Klassisches Behavior-Preserving Refactoring. Reihenfolge: erst Sicherheitsnetz aufbauen (Playwright-Smoke), dann `logic.js` in den Browser laden, dann gruppenweise Funktionen extrahieren mit Unit-Tests pro Gruppe. Drei Funktions-Klassen: pure (direkter Move), state-lesend (API-Änderung), state-mutierend (Wrapper bleibt). Jeder Commit ist atomar und smoke-getestet.

**Tech Stack:** Vanilla JS (kein Build-Step), Jest für Unit-Tests, Playwright für E2E, Service Worker für PWA-Cache.

**Spec-Referenz:** `docs/superpowers/specs/2026-05-16-testable-logic-extraction-design.md` — bei Unklarheit über *Warum* zuerst dort lesen.

---

## File Structure

### Zu modifizieren

| Datei | Zweck der Änderung |
|---|---|
| `1x1-trainer/index.html` | `<script src="logic.js">` einfügen; ~13 Funktionen + 3 Konstanten löschen; ~17 Call-Sites für Klasse-2 anpassen; `APP_VERSION` bumpen |
| `1x1-trainer/logic.js` | ~13 neue Funktionen + 3 Konstanten hinzufügen; 2 alte Funktionen (`migrateBlitzState`, `migrateDivState`) entfernen |
| `1x1-trainer/sw.js` | `CACHE` von `v18` auf `v19` |
| `playwright.config.js` | `webServer.command` branch-unabhängig machen |
| `tests/unit/blitz-logic.test.js` | Tests für `migrateBlitzState` entfernen |
| `tests/unit/division-logic.test.js` | Tests für `migrateDivState` entfernen |

### Neu zu erstellen

| Datei | Verantwortlich für |
|---|---|
| `tests/unit/state-defaults.test.js` | `defaultSettings`, `defaultReiheStats`, `defaultState`, `defaultQS` |
| `tests/unit/state-migrations.test.js` | `migrateState`, `STATE_MIGRATIONS[0..3]` |
| `tests/unit/level-progression.test.js` | `getLevelInfo`, `LEVELS`-Boundaries |
| `tests/unit/leitner.test.js` | `getMaxReihe`, `getMaxFactor`, `getQuestionWeight`, `pickWeightedFactor` |
| `tests/unit/random-helpers.test.js` | `shuffle`, `rnd` |
| `tests/e2e/refactoring-smoke.spec.js` | E2E-Smoke-Suite als Sicherheitsnetz während Refactoring |

---

## Wave 0: Setup & Sicherheitsnetz

### Task 0.1: Branch anlegen

**Files:**
- (none — git operation)

- [ ] **Step 1: Aktuelle Branch verifizieren**

```bash
git -C /Users/marco/dev/gaming branch --show-current
```

Expected: `main`. Falls anders: `git checkout main` bevor weiter.

- [ ] **Step 2: Feature-Branch anlegen und auschecken**

```bash
git -C /Users/marco/dev/gaming checkout -b feature/testable-logic
```

Expected: `Switched to a new branch 'feature/testable-logic'`

- [ ] **Step 3: Verify**

```bash
git -C /Users/marco/dev/gaming branch --show-current
```

Expected: `feature/testable-logic`

### Task 0.2: `playwright.config.js` branch-unabhängig machen

**Files:**
- Modify: `playwright.config.js`

- [ ] **Step 1: Aktuellen Inhalt prüfen**

Datei sollte `webServer.command` mit hartkodiertem `.worktrees/feature-division`-Pfad enthalten.

- [ ] **Step 2: Datei anpassen**

Ersetze die `webServer`-Sektion durch:

```js
webServer: {
  command: 'python3 -m http.server 8080 --directory .',
  cwd: __dirname,
  url: 'http://localhost:8080',
  reuseExistingServer: !process.env.CI,
},
```

Vollständige Datei sieht dann so aus:

```js
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'python3 -m http.server 8080 --directory .',
    cwd: __dirname,
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Sanity-Check — bestehende E2E-Tests laufen noch**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/blitz.spec.js --reporter=line
```

Expected: alle bestehenden Tests grün. Falls rot: vor weiterem Vorgehen ursache finden — Refactoring darf nicht auf rotem Smoke aufsetzen.

- [ ] **Step 4: Commit**

```bash
git -C /Users/marco/dev/gaming add playwright.config.js
git -C /Users/marco/dev/gaming commit -m "chore(playwright): make webServer branch-independent

Replace hardcoded worktree path with cwd: __dirname so config works
on any branch/worktree without manual editing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 0.3: Baseline Playwright-Smoke-Suite anlegen

**Files:**
- Create: `tests/e2e/refactoring-smoke.spec.js`

- [ ] **Step 1: Smoke-Suite mit Baseline-Tests schreiben**

Datei `tests/e2e/refactoring-smoke.spec.js` anlegen mit:

```js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/1x1-trainer/');
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  const nameInput = page.locator('#name-input');
  if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nameInput.fill('Test');
    await page.click('button:has-text("Los geht")');
  }
});

test('App lädt ohne Console-Errors', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/1x1-trainer/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('Home-Screen zeigt Trainingskarten', async ({ page }) => {
  await expect(page.locator('.mode-card.training')).toBeVisible();
  await expect(page.locator('.mode-card.blitz')).toBeVisible();
});

test('Training-Flow: Reihe 3 öffnen, Frage erscheint', async ({ page }) => {
  await page.click('.mode-card.training');
  await page.click('.training-reihe-btn:has-text("3")');
  await page.click('button:has-text("Los")');
  await expect(page.locator('#question-text')).toBeVisible();
  const text = await page.locator('#question-text').textContent();
  expect(text).toMatch(/3\s*[×x]\s*\d+|^\d+\s*[÷:]\s*3/);
});

test('Migration: leerer State erzeugt v4-Schema', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('henry_einmaleins'));
  await page.reload();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('henry_einmaleins') || 'null'));
  if (state) {
    expect(state._version).toBe(4);
    expect(state.settings).toBeDefined();
    expect(state.blitzConfig).toBeDefined();
  }
});

test('Service Worker registriert', async ({ page }) => {
  await page.goto('/1x1-trainer/');
  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg;
  });
  expect(swReady).toBe(true);
});
```

- [ ] **Step 2: Smoke-Suite laufen lassen**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle 5 Tests grün. Falls rot: Bug in Test (häufig Selector-Drift) — fixen bevor weiter, nicht überspringen.

- [ ] **Step 3: Commit**

```bash
git -C /Users/marco/dev/gaming add tests/e2e/refactoring-smoke.spec.js
git -C /Users/marco/dev/gaming commit -m "test(e2e): baseline smoke suite for refactoring

Captures current behavior (app loads, training flow works, migration
produces v4 schema, service worker registers) as a safety net before
behavior-preserving refactoring begins.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 0.4: Bestehende Tests als Baseline grün bestätigen

**Files:**
- (none — verification only)

- [ ] **Step 1: Jest komplett**

```bash
cd /Users/marco/dev/gaming && npm test 2>&1 | tail -20
```

Expected: alle Unit-Tests grün. Notiere die Zahl der Tests (z.B. „12 passed").

- [ ] **Step 2: Playwright komplett**

```bash
cd /Users/marco/dev/gaming && npm run test:e2e 2>&1 | tail -20
```

Expected: alle E2E-Tests grün (inkl. die neu angelegte Smoke-Suite). Notiere die Zahl.

- [ ] **Step 3: Falls irgendwas rot — Stop**

Refactoring darf NICHT auf rotem Test-Stand aufsetzen. Erst Ursache klären (auch wenn unrelated zum Refactoring) und mit User klären, wie damit umgegangen werden soll.

---

## Wave 1: `logic.js` in den Browser laden

### Task 1.1: `<script src="logic.js">` in `index.html` einfügen

**Files:**
- Modify: `1x1-trainer/index.html`

- [ ] **Step 1: Position des `<script>`-Inline-Blocks finden**

```bash
grep -n "<script>" /Users/marco/dev/gaming/1x1-trainer/index.html | head -3
```

Expected: erstes `<script>` bei Zeile 881 (inline-Block-Start).

- [ ] **Step 2: Vor Zeile 881 die Script-Referenz einfügen**

Im `index.html`, **vor** der Zeile `<script>` (Z. 881), eine neue Zeile hinzufügen:

```html
<script src="logic.js"></script>
<script>
```

D.h. die existierende `<script>`-Zeile bleibt, davor kommt eine neue Zeile mit `<script src="logic.js"></script>`.

- [ ] **Step 3: Smoke-Suite laufen**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün (logic.js-Funktionen sind jetzt zusätzlich zu den Inline-Versionen geladen, was zu keinen Konflikten führt weil function-Deklarationen sich überschreiben).

- [ ] **Step 4: Console-Test ergänzen**

In `tests/e2e/refactoring-smoke.spec.js` einen weiteren Test anhängen:

```js
test('logic.js geladen — Funktions-Symbole verfügbar', async ({ page }) => {
  await page.goto('/1x1-trainer/');
  const fns = await page.evaluate(() => ({
    pickBlitzReihe: typeof pickBlitzReihe,
    resolveRechenart: typeof resolveRechenart,
    addBlitzListeEntry: typeof addBlitzListeEntry,
  }));
  expect(fns.pickBlitzReihe).toBe('function');
  expect(fns.resolveRechenart).toBe('function');
  expect(fns.addBlitzListeEntry).toBe('function');
});
```

- [ ] **Step 5: Smoke nochmal**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: 6 Tests grün.

- [ ] **Step 6: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/index.html tests/e2e/refactoring-smoke.spec.js
git -C /Users/marco/dev/gaming commit -m "feat(1x1-trainer): load logic.js in index.html

Until now, logic.js was unloaded (vapor — only Jest used it). Adding
<script src=\"logic.js\"></script> before the inline script makes its
function decls available globally; subsequent waves can remove the
inline duplicates safely.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Wave 2: Vapor-Tests durch echte Tests ersetzen — Duplikate auflösen

### Task 2.1: `resolveRechenart`-Duplikat entfernen

**Files:**
- Modify: `1x1-trainer/index.html` (Z. 1783-1787 löschen)

- [ ] **Step 1: Identische Implementierung verifizieren**

```bash
grep -A 4 "function resolveRechenart" /Users/marco/dev/gaming/1x1-trainer/index.html /Users/marco/dev/gaming/1x1-trainer/logic.js
```

Expected: beide Bodies sind funktional identisch (gleicher Algorithmus). Falls Unterschied entdeckt: STOP und Spec konsultieren — Iron Rule sagt HTML gewinnt.

- [ ] **Step 2: Inline-Definition löschen**

Aus `1x1-trainer/index.html` die Zeilen 1783-1787 löschen (inkl. trailing newline):

```js
function resolveRechenart(cfg) {
  const r = (cfg && cfg.rechenart) || 'mult';
  if (r === 'gemischt') return Math.random() < 0.5 ? 'mult' : 'div';
  return r;
}
```

(Die Funktion aus `logic.js` übernimmt jetzt — gleiche Signatur, gleiche Implementierung.)

- [ ] **Step 3: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 4: Jest (bestehende Tests grün?)**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/division-logic.test.js --reporter=line
```

Expected: alle `resolveRechenart`-Tests in `division-logic.test.js` grün — sie testen jetzt die einzige existierende Definition (in logic.js).

- [ ] **Step 5: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/index.html
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): remove inline resolveRechenart duplicate

logic.js version is identical and now actually used by the browser.
Inline duplicate was vapor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: `pickBlitzReihe`-API reconcilen

**Files:**
- Modify: `1x1-trainer/index.html` (Z. 1777-1781 löschen, Z. 1800 anpassen)

- [ ] **Step 1: Aktuelle Inline-Definition lesen**

`index.html:1777-1781`:
```js
function pickBlitzReihe() {
  const cfg = state.blitzConfig;
  if (cfg.alleReihen || !cfg.reihen.length) return rnd(1, getMaxReihe());
  return cfg.reihen[rnd(0, cfg.reihen.length - 1)];
}
```

Call-Site bei `index.html:1800`: `a = pickBlitzReihe();`

- [ ] **Step 2: Inline-Definition löschen**

Aus `1x1-trainer/index.html` die Zeilen 1777-1781 löschen.

- [ ] **Step 3: Call-Site anpassen — Z. 1800**

Aktuelle Zeile:
```js
a = pickBlitzReihe(); b = rnd(1, getMaxFactor(a));
```

Ändern zu:
```js
a = pickBlitzReihe(state.blitzConfig, getMaxReihe()) ?? rnd(1, getMaxReihe()); b = rnd(1, getMaxFactor(a));
```

(Note: `getMaxFactor(a)` bleibt vorerst — wird in Wave 5 angepasst, wenn `getMaxFactor` extrahiert wird.)

- [ ] **Step 4: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 5: Manueller Blitz-Smoke**

```bash
cd /Users/marco/dev/gaming && python3 -m http.server 8080 &
```

Browser: `http://localhost:8080/1x1-trainer/`. „Blitz" klicken → Reihen 3 und 5 wählen → Spiel starten → ein paar Fragen beantworten → Verhalten wie heute. Server stoppen mit `kill %1`.

- [ ] **Step 6: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/index.html
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): reconcile pickBlitzReihe with logic.js API

Inline version was () => number; logic.js version is (cfg, max) => number|null.
Switch call-site to use pure API with explicit fallback rnd(1, max).
Behavior identical: when no rows configured, random row is picked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.3: `addBlitzListeEntry`-Verwendung im Browser-Code finden und einbauen

**Files:**
- Modify: `1x1-trainer/index.html` (falls Inline-Variante gefunden wird)

- [ ] **Step 1: Aktuelle Browser-Verwendung finden**

```bash
grep -n "blitzListe\|addBlitzListeEntry" /Users/marco/dev/gaming/1x1-trainer/index.html
```

Expected output enthält Schreibzugriffe auf `state.highScores.blitzListe` (z.B. `.push(...)`, `.sort(...)`, `.slice(...)`). Notiere die Zeilennummern.

- [ ] **Step 2: Diff analysieren**

Vergleiche den gefundenen Inline-Code mit der `addBlitzListeEntry`-Implementierung aus `logic.js`:

```js
function addBlitzListeEntry(liste, entry) {
  const neu = [...liste, entry];
  neu.sort((a, b) => b.score - a.score);
  return neu.slice(0, 5);
}
```

Wenn der Inline-Code semantisch identisch ist (Push + Sort desc by score + Slice top 5), ist es eine sichere Ersetzung. Wenn anders: STOP, Spec konsultieren.

- [ ] **Step 3: Inline-Implementierung durch Aufruf ersetzen**

Beispiel-Pattern (genaue Anpassung ergibt sich aus Schritt 1):

```js
// vorher (illustrativ):
state.highScores.blitzListe.push(entry);
state.highScores.blitzListe.sort((a, b) => b.score - a.score);
state.highScores.blitzListe = state.highScores.blitzListe.slice(0, 5);

// nachher:
state.highScores.blitzListe = addBlitzListeEntry(state.highScores.blitzListe, entry);
```

- [ ] **Step 4: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 5: Manueller Blitz-Highscore-Test**

Server starten → Blitz spielen → fertig spielen → Highscore-Seite öffnen → Eintrag erscheint, Liste sortiert korrekt.

- [ ] **Step 6: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/index.html
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): use addBlitzListeEntry from logic.js

Inline implementation in index.html replaced by call to the pure
function. Behavior identical (push + sort desc + top 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Wave 3: Toten Code in `logic.js` entfernen

### Task 3.1: `migrateBlitzState` aus `logic.js` und Tests entfernen

**Files:**
- Modify: `1x1-trainer/logic.js` (Funktion + module.exports-Eintrag)
- Modify: `tests/unit/blitz-logic.test.js` (describe-Block für migrateBlitzState)

- [ ] **Step 1: Verify, dass die Funktion nirgendwo aufgerufen wird**

```bash
grep -rn "migrateBlitzState" /Users/marco/dev/gaming/1x1-trainer/ /Users/marco/dev/gaming/tests/
```

Expected: nur Treffer in `logic.js` (Definition + export) und `tests/unit/blitz-logic.test.js` (Test-Importe + Tests). Falls Aufruf in `index.html`: STOP — die Funktion ist nicht tot, Spec-Annahme war falsch.

- [ ] **Step 2: Funktion aus `logic.js` entfernen**

Aus `1x1-trainer/logic.js` die `migrateBlitzState`-Funktion löschen (Z. 16-21):

```js
function migrateBlitzState(s) {
  if (!s.blitzConfig) s.blitzConfig = { reihen: [], alleReihen: true };
  if (!s.highScores) s.highScores = {};
  if (!s.highScores.blitzListe) s.highScores.blitzListe = [];
  return s;
}
```

Und aus dem `module.exports` (Z. 53) den Eintrag `migrateBlitzState` entfernen.

- [ ] **Step 3: Tests entfernen**

Aus `tests/unit/blitz-logic.test.js`:
- `migrateBlitzState` aus dem `require(...)`-Import in Z. 1 entfernen
- Den kompletten `describe('migrateBlitzState', ...)`-Block (Z. 48-66) löschen

- [ ] **Step 4: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/blitz-logic.test.js --reporter=line
```

Expected: alle verbleibenden Tests grün.

- [ ] **Step 5: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js tests/unit/blitz-logic.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): remove dead migrateBlitzState

Duplicate of STATE_MIGRATIONS[2] (v2->v3) in index.html. Never called
from browser code. STATE_MIGRATIONS is single source; will be extracted
to logic.js in Wave 4 with its own tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.2: `migrateDivState` aus `logic.js` und Tests entfernen

**Files:**
- Modify: `1x1-trainer/logic.js`
- Modify: `tests/unit/division-logic.test.js`

- [ ] **Step 1: Verify, dass nicht aufgerufen**

```bash
grep -rn "migrateDivState" /Users/marco/dev/gaming/1x1-trainer/ /Users/marco/dev/gaming/tests/
```

Expected: nur in `logic.js` (Definition + export) und `tests/unit/division-logic.test.js`.

- [ ] **Step 2: Aus `logic.js` entfernen**

`migrateDivState`-Funktion (`logic.js:32-50`) komplett löschen. Aus `module.exports` den Eintrag entfernen.

- [ ] **Step 3: Aus `division-logic.test.js` entfernen**

- `migrateDivState` aus dem `require(...)`-Import entfernen
- Den kompletten `describe('migrateDivState', ...)`-Block löschen

- [ ] **Step 4: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/division-logic.test.js --reporter=line
```

Expected: alle verbleibenden Tests grün.

- [ ] **Step 5: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js tests/unit/division-logic.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): remove dead migrateDivState

Duplicate of STATE_MIGRATIONS[3] (v3->v4). Never called from browser.
STATE_MIGRATIONS is single source.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Wave 4: Extract Klasse 1 (pure, keine API-Änderung)

### Task 4.1: `shuffle` und `rnd` extrahieren

**Files:**
- Create: `tests/unit/random-helpers.test.js`
- Modify: `1x1-trainer/logic.js` (Funktionen + export)
- Modify: `1x1-trainer/index.html` (Z. 1728-1732 löschen)

- [ ] **Step 1: Test schreiben (failing)**

`tests/unit/random-helpers.test.js`:

```js
const { shuffle, rnd } = require('../../1x1-trainer/logic.js');

describe('shuffle', () => {
  test('Länge bleibt gleich', () => {
    expect(shuffle([1,2,3,4,5])).toHaveLength(5);
  });

  test('alle Elemente bleiben (mengentheoretisch)', () => {
    const result = shuffle([1,2,3,4,5]);
    expect(result.sort()).toEqual([1,2,3,4,5]);
  });

  test('mutiert Input (bewusst)', () => {
    const input = [1,2,3];
    const result = shuffle(input);
    expect(result).toBe(input); // identische Referenz
  });

  test('leeres Array bleibt leer', () => {
    expect(shuffle([])).toEqual([]);
  });
});

describe('rnd', () => {
  test('Ergebnis liegt in [min, max]', () => {
    for (let i = 0; i < 100; i++) {
      const r = rnd(1, 10);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(10);
      expect(Number.isInteger(r)).toBe(true);
    }
  });

  test('min === max liefert min', () => {
    expect(rnd(5, 5)).toBe(5);
  });
});
```

- [ ] **Step 2: Run fail**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/random-helpers.test.js --reporter=line
```

Expected: FAIL — `shuffle is not a function` (logic.js exportiert sie nicht). Ergebnis nutzen wir als Baseline.

- [ ] **Step 3: Funktionen in `logic.js` einfügen**

In `1x1-trainer/logic.js`, vor dem `module.exports`-Block, einfügen:

```js
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
```

Im `module.exports`-Block hinzufügen: `shuffle, rnd`.

- [ ] **Step 4: Inline-Versionen aus `index.html` löschen**

`index.html:1728-1732`:
```js
function shuffle(a) {
  for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function rnd(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
```

Diese 5 Zeilen entfernen.

- [ ] **Step 5: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/random-helpers.test.js --reporter=line
```

Expected: alle 6 Tests grün.

- [ ] **Step 6: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 7: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js 1x1-trainer/index.html tests/unit/random-helpers.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): extract shuffle + rnd helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.2: Konstanten `STATE_VERSION`, `STAR_COSTS`, `LEVELS` extrahieren

**Files:**
- Modify: `1x1-trainer/logic.js` (Konstanten + export)
- Modify: `1x1-trainer/index.html` (Z. 883-896, 976 löschen)

- [ ] **Step 1: Konstanten in `logic.js` einfügen**

Am Anfang von `1x1-trainer/logic.js`, vor den existierenden Funktionen:

```js
var STATE_VERSION = 4;
var STAR_COSTS = [800, 1400, 2000, 2800];
var LEVELS = [
  { xp:    0, title: '⭐ Anfänger',           avatar: '🚀' },
  { xp:  200, title: '🌟 Lehrling',           avatar: '🌱' },
  { xp:  500, title: '📚 Schüler',            avatar: '📖' },
  { xp:  900, title: '🔢 Fleißiger Rechner',  avatar: '🧮' },
  { xp: 1400, title: '🎯 Mathe-Fan',          avatar: '🎯' },
  { xp: 2000, title: '🦸 Zahlen-Held',        avatar: '🦸' },
  { xp: 2800, title: '⚔️ Rechen-Ritter',      avatar: '⚔️' },
  { xp: 3800, title: '🗡️ Mathe-Krieger',      avatar: '🗡️' },
  { xp: 5000, title: '🏆 Zahlen-Meister',     avatar: '🏆' },
  { xp: 6500, title: '👑 Einmaleins-Legende', avatar: '👑' },
];
```

(`var` statt `const` — siehe Spec, ist beabsichtigt für globale Sichtbarkeit zwischen `<script>`-Tags.)

Im `module.exports` hinzufügen: `STATE_VERSION, STAR_COSTS, LEVELS`.

- [ ] **Step 2: Inline-Definitionen aus `index.html` löschen**

`index.html:883`: `const STAR_COSTS = [800, 1400, 2000, 2800];` — Zeile löschen.

`index.html:885-896`: Den kompletten `const LEVELS = [ ... ];`-Block löschen (12 Zeilen).

`index.html:976`: `const STATE_VERSION = 4;` — Zeile löschen.

- [ ] **Step 3: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün. **Falls rot mit `STATE_VERSION is not defined` o.ä.**: Hinweis, dass `var` vs. `const` Sichtbarkeit zwischen Scripts unterschiedlich behandeln — prüfen, dass in logic.js wirklich `var` steht.

- [ ] **Step 4: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js 1x1-trainer/index.html
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): extract STATE_VERSION, STAR_COSTS, LEVELS

Constants moved to logic.js (as var, for cross-script visibility in
classic <script> contexts).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.3: Pure Factories extrahieren + `defaultQS` einführen

**Files:**
- Create: `tests/unit/state-defaults.test.js`
- Modify: `1x1-trainer/logic.js` (Funktionen + export)
- Modify: `1x1-trainer/index.html` (Z. 940-973 löschen; `getQS` anpassen)

- [ ] **Step 1: Test schreiben**

`tests/unit/state-defaults.test.js`:

```js
const { defaultSettings, defaultReiheStats, defaultState, defaultQS, STATE_VERSION } = require('../../1x1-trainer/logic.js');

describe('defaultSettings', () => {
  test('Shape mit grosses1x1=false, inputMode=both, reiheMax[1..20]=20', () => {
    const s = defaultSettings();
    expect(s.grosses1x1).toBe(false);
    expect(s.inputMode).toBe('both');
    expect(s.reiheMax[1]).toBe(20);
    expect(s.reiheMax[20]).toBe(20);
    expect(Object.keys(s.reiheMax)).toHaveLength(20);
  });
});

describe('defaultReiheStats', () => {
  test('20 Einträge, alle Felder auf 0', () => {
    const s = defaultReiheStats();
    expect(Object.keys(s)).toHaveLength(20);
    expect(s[1].sessions).toBe(0);
    expect(s[1].consecutivePerfect).toBe(0);
    expect(s[1].divConsecutivePerfect).toBe(0);
    expect(s[1].divCorrect).toBe(0);
    expect(s[20].totalCorrect).toBe(0);
  });
});

describe('defaultState', () => {
  test('_version === STATE_VERSION', () => {
    expect(defaultState()._version).toBe(STATE_VERSION);
  });

  test('hat alle Top-Level-Felder', () => {
    const s = defaultState();
    expect(s.xp).toBe(0);
    expect(s.name).toBe('');
    expect(s.highScores).toBeDefined();
    expect(s.blitzConfig).toBeDefined();
    expect(s.trainingConfig).toBeDefined();
    expect(s.turnierConfig).toBeDefined();
  });
});

describe('defaultQS', () => {
  test('liefert frisches QS-Objekt', () => {
    expect(defaultQS()).toEqual({ correct: 0, wrong: 0, consecutiveCorrect: 0 });
  });

  test('zwei Aufrufe liefern unterschiedliche Objekt-Referenzen', () => {
    expect(defaultQS()).not.toBe(defaultQS());
  });
});
```

- [ ] **Step 2: Run fail**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/state-defaults.test.js --reporter=line
```

Expected: FAIL (Funktionen existieren noch nicht in logic.js).

- [ ] **Step 3: Funktionen in `logic.js` einfügen**

Nach den Konstanten und vor den existierenden Funktionen:

```js
function defaultSettings() {
  const reiheMax = {};
  for (let i = 1; i <= 20; i++) reiheMax[i] = 20;
  return { grosses1x1: false, reiheMax, inputMode: 'both' };
}

function defaultReiheStats() {
  const s = {};
  for (let i = 1; i <= 20; i++) s[i] = {
    sessions: 0, totalCorrect: 0, totalQuestions: 0, consecutivePerfect: 0,
    divConsecutivePerfect: 0, divCorrect: 0, divWrong: 0
  };
  return s;
}

function defaultState() {
  return {
    _version: STATE_VERSION, name: '', xp: 0, achievements: [], totalCorrect: 0, totalGames: 0,
    streak: 0, lastPlayDate: null,
    highScores: { blitz: 0, turnier: 0, blitzListe: [],
                  blitzDiv: 0, blitzGemischt: 0,
                  turnierDiv: 0, turnierGemischt: 0 },
    blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
    trainingConfig: { rechenart: 'mult' },
    turnierConfig: { rechenart: 'mult' },
    settings: defaultSettings(), reiheStats: defaultReiheStats(),
    questionStats: {}, stars: 0, gameSecondsLeft: 0,
    streakFreezeUsedDate: null, streakFreezeTotal: 0,
  };
}

function defaultQS() { return { correct: 0, wrong: 0, consecutiveCorrect: 0 }; }
```

**Achtung**: Die `defaultState`-Body genau aus `index.html:955-973` übernehmen — die obige Vorlage ist ein Skelett. Konkret kopieren, nicht abtippen. Falls beim Kopieren `STATE_VERSION` als ungekanntes Symbol auftaucht: das ist OK, weil `STATE_VERSION` im selben Modul aus Task 4.2 schon definiert ist.

Im `module.exports` ergänzen: `defaultSettings, defaultReiheStats, defaultState, defaultQS`.

- [ ] **Step 4: Inline aus `index.html` löschen**

`index.html:940-973`: Den kompletten Block `function defaultSettings()`, `function defaultReiheStats()`, `function defaultState()` (~34 Zeilen) löschen.

- [ ] **Step 5: `getQS`-Wrapper anpassen**

`index.html:1737-1741` (originaler `getQS`):
```js
function getQS(reihe, factor) {
  if (!state.questionStats[reihe]) state.questionStats[reihe] = {};
  if (!state.questionStats[reihe][factor]) state.questionStats[reihe][factor] = { correct:0, wrong:0, consecutiveCorrect:0 };
  return state.questionStats[reihe][factor];
}
```

Ersetzen durch:
```js
function getQS(reihe, factor) {
  if (!state.questionStats[reihe]) state.questionStats[reihe] = {};
  if (!state.questionStats[reihe][factor]) state.questionStats[reihe][factor] = defaultQS();
  return state.questionStats[reihe][factor];
}
```

- [ ] **Step 6: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/state-defaults.test.js --reporter=line
```

Expected: alle 7 Tests grün.

- [ ] **Step 7: Smoke + Manual State-Check**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

Manueller Check: Server starten, `localStorage.removeItem('henry_einmaleins')` in DevTools, reload, `JSON.parse(localStorage.henry_einmaleins)` zeigt frisches v4-Schema.

- [ ] **Step 8: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js 1x1-trainer/index.html tests/unit/state-defaults.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): extract default factories + defaultQS

defaultSettings, defaultReiheStats, defaultState, and a new defaultQS()
move to logic.js. getQS wrapper in index.html now calls defaultQS()
instead of inlining the {correct,wrong,consecutiveCorrect} literal —
keeps reference-identity behavior intact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.4: `STATE_MIGRATIONS` und `migrateState` extrahieren

**Files:**
- Create: `tests/unit/state-migrations.test.js`
- Modify: `1x1-trainer/logic.js`
- Modify: `1x1-trainer/index.html` (Z. 978-1038 löschen)

- [ ] **Step 1: Test schreiben**

`tests/unit/state-migrations.test.js`:

```js
const { migrateState, STATE_MIGRATIONS, STATE_VERSION } = require('../../1x1-trainer/logic.js');

describe('migrateState', () => {
  test('leerer State {} bekommt komplettes v4-Schema', () => {
    const result = migrateState({});
    expect(result._version).toBe(4);
    expect(result.settings).toBeDefined();
    expect(result.settings.grosses1x1).toBe(false);
    expect(result.settings.inputMode).toBe('both');
    expect(result.blitzConfig.rechenart).toBe('mult');
    expect(result.trainingConfig.rechenart).toBe('mult');
    expect(result.highScores.blitzDiv).toBe(0);
    expect(result.highScores.blitzListe).toEqual([]);
  });

  test('v1-State mit inputMode=tap wird auf both migriert', () => {
    const v1 = { _version: 1, settings: { grosses1x1: false, inputMode: 'tap', reiheMax: { 1: 20 } } };
    const result = migrateState(v1);
    expect(result._version).toBe(4);
    expect(result.settings.inputMode).toBe('both');
  });

  test('idempotent: v4-State unverändert', () => {
    const baseline = migrateState({});
    const again = migrateState({ ...baseline });
    expect(again._version).toBe(baseline._version);
    expect(again.settings).toEqual(baseline.settings);
  });

  test('unbekannte Felder bleiben erhalten', () => {
    const input = { _version: 4, customField: 'hello', name: 'Henry' };
    const result = migrateState(input);
    expect(result.customField).toBe('hello');
    expect(result.name).toBe('Henry');
  });

  test('_version > STATE_VERSION wird nicht zurück-migriert', () => {
    const future = { _version: 99, foo: 'bar' };
    const result = migrateState(future);
    expect(result._version).toBe(99);
    expect(result.foo).toBe('bar');
  });
});

describe('STATE_MIGRATIONS', () => {
  test('Anzahl entspricht STATE_VERSION', () => {
    expect(STATE_MIGRATIONS.length).toBe(STATE_VERSION);
  });

  test('Migration 2 (v2->v3) legt blitzConfig + blitzListe an', () => {
    const v2 = { _version: 2, highScores: { blitz: 0 } };
    const result = STATE_MIGRATIONS[2](v2);
    expect(result.blitzConfig).toBeDefined();
    expect(result.blitzConfig.alleReihen).toBe(true);
    expect(result.highScores.blitzListe).toEqual([]);
  });

  test('Migration 3 (v3->v4) legt rechenart + Division-Felder an', () => {
    const v3 = { _version: 3, blitzConfig: { reihen: [], alleReihen: true } };
    const result = STATE_MIGRATIONS[3](v3);
    expect(result.blitzConfig.rechenart).toBe('mult');
    expect(result.trainingConfig).toEqual({ rechenart: 'mult' });
    expect(result.turnierConfig).toEqual({ rechenart: 'mult' });
    expect(result.highScores.blitzDiv).toBe(0);
  });
});
```

- [ ] **Step 2: Run fail**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/state-migrations.test.js --reporter=line
```

Expected: FAIL.

- [ ] **Step 3: `STATE_MIGRATIONS` + `migrateState` in `logic.js` einfügen**

Aus `index.html:978-1038` den kompletten Block kopieren (ohne die `let state = ...`-IIFE, die bleibt im HTML). Konkret die Funktionsdefinitionen `STATE_MIGRATIONS` (Z. 978-1029) und `function migrateState(s)` (Z. 1031-1038).

In `logic.js` nach `defaultState` einfügen.

Wichtig: `STATE_MIGRATIONS` als `var STATE_MIGRATIONS = [ ... ];` (nicht `const`) — globale Sichtbarkeit-Konvention.

Im `module.exports` ergänzen: `STATE_MIGRATIONS, migrateState`.

- [ ] **Step 4: Inline aus `index.html` löschen**

`index.html:978-1038`: Den kompletten Block (STATE_MIGRATIONS-Array + migrateState-Funktion) löschen.

Die `let state = ...`-IIFE direkt darunter (jetzt vermutlich Z. 1040) bleibt — sie ruft `migrateState` auf, was jetzt aus `logic.js` kommt.

- [ ] **Step 5: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/state-migrations.test.js --reporter=line
```

Expected: alle 7 Tests grün.

- [ ] **Step 6: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün — insbesondere der „Migration: leerer State erzeugt v4-Schema"-Test deckt jetzt logic.js-Code ab.

- [ ] **Step 7: Manual Migration-Check**

Server starten. DevTools Console:
```js
localStorage.setItem('henry_einmaleins', JSON.stringify({ _version: 1, settings: { grosses1x1: false, inputMode: 'tap', reiheMax: {1:20} } }));
location.reload();
```
Nach Reload: `JSON.parse(localStorage.henry_einmaleins)._version` === `4`, `settings.inputMode` === `"both"`.

- [ ] **Step 8: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js 1x1-trainer/index.html tests/unit/state-migrations.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): extract STATE_MIGRATIONS + migrateState

State-version migrations now live in logic.js with full test coverage
including idempotency, unknown-field preservation, and future-version
non-rollback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.5: `getLevelInfo` extrahieren

**Files:**
- Create: `tests/unit/level-progression.test.js`
- Modify: `1x1-trainer/logic.js`
- Modify: `1x1-trainer/index.html` (Z. 1059-1067 löschen)

- [ ] **Step 1: Test schreiben**

`tests/unit/level-progression.test.js`:

```js
const { getLevelInfo, LEVELS, STAR_COSTS } = require('../../1x1-trainer/logic.js');

describe('LEVELS', () => {
  test('10 Level, aufsteigend nach xp sortiert', () => {
    expect(LEVELS).toHaveLength(10);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].xp).toBeGreaterThan(LEVELS[i-1].xp);
    }
  });

  test('LEVELS[0].xp === 0', () => {
    expect(LEVELS[0].xp).toBe(0);
  });
});

describe('STAR_COSTS', () => {
  test('4 Werte aufsteigend', () => {
    expect(STAR_COSTS).toHaveLength(4);
    for (let i = 1; i < STAR_COSTS.length; i++) {
      expect(STAR_COSTS[i]).toBeGreaterThan(STAR_COSTS[i-1]);
    }
  });
});

describe('getLevelInfo', () => {
  test('xp=0 → Level 1', () => {
    expect(getLevelInfo(0).level).toBe(1);
  });

  test('xp=200 → Level 2 (Boundary unten)', () => {
    expect(getLevelInfo(200).level).toBe(2);
  });

  test('xp=199 → Level 1 (Boundary oben Level 1)', () => {
    expect(getLevelInfo(199).level).toBe(1);
  });

  test('xp=6500 → Level 10 (Top), progress=1, kein next-Level-Bedarf', () => {
    const info = getLevelInfo(6500);
    expect(info.level).toBe(10);
    expect(info.progress).toBe(1);
  });

  test('xp=100 → progress reflects 100/200', () => {
    const info = getLevelInfo(100);
    expect(info.level).toBe(1);
    expect(info.xpIn).toBe(100);
    expect(info.xpNeed).toBe(200);
    expect(info.progress).toBeCloseTo(0.5);
  });

  test('returnt title und avatar aus LEVELS', () => {
    const info = getLevelInfo(0);
    expect(info.title).toBe(LEVELS[0].title);
    expect(info.avatar).toBe(LEVELS[0].avatar);
  });
});
```

- [ ] **Step 2: Run fail**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/level-progression.test.js --reporter=line
```

Expected: FAIL — `getLevelInfo` nicht in exports.

- [ ] **Step 3: Funktion in `logic.js` einfügen**

Nach `migrateState`:

```js
function getLevelInfo(xp) {
  let lvl = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) { if (xp >= LEVELS[i].xp) { lvl = i; break; } }
  const cur = LEVELS[lvl], nxt = LEVELS[lvl + 1] || null;
  const xpIn = xp - cur.xp;
  const xpNeed = nxt ? nxt.xp - cur.xp : 1;
  return { level: lvl + 1, title: cur.title, avatar: cur.avatar,
           xpIn, xpNeed, progress: nxt ? Math.min(xpIn / xpNeed, 1) : 1 };
}
```

Im `module.exports` ergänzen: `getLevelInfo`.

- [ ] **Step 4: Inline aus `index.html` löschen**

`index.html:1059-1067`: Den `getLevelInfo`-Block löschen (9 Zeilen).

- [ ] **Step 5: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/level-progression.test.js --reporter=line
```

Expected: alle 9 Tests grün.

- [ ] **Step 6: Smoke + Manual Level-Check**

Server starten, DevTools:
```js
state.xp = 250; updateHomeUI();
```
Erwartung: Level-Anzeige im Home-Screen ändert sich entsprechend (Level 2 mit Progress).

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 7: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js 1x1-trainer/index.html tests/unit/level-progression.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): extract getLevelInfo

Pure function for XP → level info. Edge cases (xp=0, top level,
boundary values) covered in level-progression.test.js.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Wave 5: Extract Klasse 2 (state-lesend, API-Änderung)

### Task 5.1: `getMaxReihe` + `getMaxFactor` extrahieren

**Files:**
- Create: `tests/unit/leitner.test.js` (initial, weitere Funktionen in Task 5.2 ergänzt)
- Modify: `1x1-trainer/logic.js`
- Modify: `1x1-trainer/index.html` (Z. 1734-1735 löschen, ~15 Call-Sites updaten)

- [ ] **Step 1: Test schreiben — Anfang `leitner.test.js`**

`tests/unit/leitner.test.js`:

```js
const { getMaxReihe, getMaxFactor } = require('../../1x1-trainer/logic.js');

describe('getMaxReihe', () => {
  test('grosses1x1=false → 10', () => {
    expect(getMaxReihe({ grosses1x1: false })).toBe(10);
  });

  test('grosses1x1=true → 20', () => {
    expect(getMaxReihe({ grosses1x1: true })).toBe(20);
  });
});

describe('getMaxFactor', () => {
  test('grosses1x1=false → 10 unabhängig von reihe', () => {
    expect(getMaxFactor({ grosses1x1: false, reiheMax: {} }, 5)).toBe(10);
  });

  test('grosses1x1=true → reiheMax[reihe]', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: { 3: 15 } }, 3)).toBe(15);
  });

  test('grosses1x1=true, reiheMax[reihe] fehlt → 20 (Fallback)', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: {} }, 7)).toBe(20);
  });

  test('grosses1x1=true, reiheMax[reihe]=0 → 20 (`|| 20`-Fallback)', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: { 3: 0 } }, 3)).toBe(20);
  });
});
```

- [ ] **Step 2: Run fail**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/leitner.test.js --reporter=line
```

Expected: FAIL.

- [ ] **Step 3: Funktionen in `logic.js`**

Nach `getLevelInfo`:

```js
function getMaxReihe(settings) { return settings.grosses1x1 ? 20 : 10; }
function getMaxFactor(settings, reihe) {
  if (!settings.grosses1x1) return 10;
  return settings.reiheMax[reihe] || 20;
}
```

Im `module.exports` ergänzen: `getMaxReihe, getMaxFactor`.

- [ ] **Step 4: Inline aus `index.html` löschen**

`index.html:1734-1735` (2 Zeilen).

- [ ] **Step 5: Call-Sites in `index.html` updaten — `getMaxReihe()` → `getMaxReihe(state.settings)`**

10 Stellen (Liste in der vorbereitenden Analyse — alle ohne Argumente):

```bash
grep -n "getMaxReihe()" /Users/marco/dev/gaming/1x1-trainer/index.html
```

Aktuelle Zeilen (Stand vor Refactoring; Zeilennummern können nach den vorherigen Edits verschoben sein):
- `1379:  const maxReihe = getMaxReihe();`
- `1381:  ... ${getMaxReihe()} ...`
- `1486:  for (let i = 1; i <= getMaxReihe(); i++) {`
- `1554:  const maxR = getMaxReihe();`
- `1779:  if (cfg.alleReihen || !cfg.reihen.length) return rnd(1, getMaxReihe());` — **Zeile gelöscht in Task 2.2**, irrelevant
- `1802:  ... getMaxReihe()`
- `2146:  give('allreihen',  trainedSet.size >= getMaxReihe());`
- `2253:  for (let i = 1; i <= getMaxReihe(); i++) {`
- `2277:  ... / getMaxReihe() * 100`
- `2278:  ... / ${getMaxReihe()}`

Jeden Call ersetzen: `getMaxReihe()` → `getMaxReihe(state.settings)`.

Auch eventuelle Stellen in Task-2.2-Anpassung (Z. 1800 ist heute `pickBlitzReihe(state.blitzConfig, getMaxReihe()) ?? rnd(1, getMaxReihe())`) auf `pickBlitzReihe(state.blitzConfig, getMaxReihe(state.settings)) ?? rnd(1, getMaxReihe(state.settings))` ändern.

Empfehlung: per Editor mit „Find All Occurrences"-Funktion alle `getMaxReihe()` auf einmal ersetzen — kontrolliert prüfen.

- [ ] **Step 6: Call-Sites — `getMaxFactor(reihe)` → `getMaxFactor(state.settings, reihe)`**

```bash
grep -n "getMaxFactor(" /Users/marco/dev/gaming/1x1-trainer/index.html
```

Erwartete Stellen (Stand vor Refactoring):
- `1762: const maxF = getMaxFactor(reihe);`
- `1765: ... getMaxFactor(reihe) ...` (Funktions-Aufruf in pickWeightedFactor — wird in Task 5.2 nochmal angefasst, jetzt aber Signatur anpassen)
- `1770: const maxF = getMaxFactor(reihe);`
- `1800: ... rnd(1, getMaxFactor(a));` (in Blitz-Spielcode)
- `1803: ... getMaxFactor(a) ...`
- `2215: const maxF = getMaxFactor(reihe);`

Jeden Call ersetzen: `getMaxFactor(X)` → `getMaxFactor(state.settings, X)`.

- [ ] **Step 7: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/leitner.test.js --reporter=line
```

Expected: alle 6 Tests grün.

- [ ] **Step 8: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 9: Manueller Reihen-Picker-Smoke**

Server starten. Trainings-Reihen-Picker öffnen — bei kleinem 1×1 sind Reihen 1-10 sichtbar; bei großem 1×1 (in Settings umschalten) erscheinen 1-20. Falls Picker leer oder mit Fehler: Call-Site übersehen.

- [ ] **Step 10: Verify keine Call-Sites übersehen**

```bash
grep -n "getMaxReihe()\|getMaxFactor([^s]" /Users/marco/dev/gaming/1x1-trainer/index.html
```

Expected: keine Treffer (alle Calls mit `state.settings`-Argument). Falls Treffer: Stelle finden und fixen, bevor commit.

- [ ] **Step 11: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js 1x1-trainer/index.html tests/unit/leitner.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): extract getMaxReihe + getMaxFactor with settings param

Pure variants take settings explicitly. ~15 call-sites in index.html
updated to pass state.settings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5.2: `getQuestionWeight` + `pickWeightedFactor` extrahieren

**Files:**
- Modify: `tests/unit/leitner.test.js` (erweitern)
- Modify: `1x1-trainer/logic.js`
- Modify: `1x1-trainer/index.html` (Z. 1743-1758 löschen, Call-Sites updaten)

- [ ] **Step 1: Top-level `require` in `leitner.test.js` erweitern**

Den existierenden ersten `require`-Statement in `tests/unit/leitner.test.js` (aus Task 5.1) ändern von:

```js
const { getMaxReihe, getMaxFactor } = require('../../1x1-trainer/logic.js');
```

zu:

```js
const { getMaxReihe, getMaxFactor, getQuestionWeight, pickWeightedFactor } = require('../../1x1-trainer/logic.js');
```

- [ ] **Step 2: Tests am Ende von `leitner.test.js` anhängen**

```js
describe('getQuestionWeight', () => {
  test('fehlende Stats → 5 (Neuling-Default)', () => {
    expect(getQuestionWeight({}, 3, 4)).toBe(5);
  });

  test('correct=0, wrong=0 → 5', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:0, wrong:0, consecutiveCorrect:0 } } }, 3, 4)).toBe(5);
  });

  test('consecutiveCorrect=6 → 1', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:6, wrong:0, consecutiveCorrect:6 } } }, 3, 4)).toBe(1);
  });

  test('consecutiveCorrect=5 → 2', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:5, wrong:0, consecutiveCorrect:5 } } }, 3, 4)).toBe(2);
  });

  test('consecutiveCorrect=3 → 3', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:3, wrong:0, consecutiveCorrect:3 } } }, 3, 4)).toBe(3);
  });

  test('consecutiveCorrect=1 → 5', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:1, wrong:0, consecutiveCorrect:1 } } }, 3, 4)).toBe(5);
  });

  test('nie korrekt, wrong=3 → min(4 + 3*2, 12) = 10', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:0, wrong:3, consecutiveCorrect:0 } } }, 3, 4)).toBe(10);
  });

  test('nie korrekt, wrong=20 → 12 (Cap)', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:0, wrong:20, consecutiveCorrect:0 } } }, 3, 4)).toBe(12);
  });
});

describe('pickWeightedFactor', () => {
  afterEach(() => jest.restoreAllMocks());

  test('Math.random=0 → erster Faktor (1)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickWeightedFactor({}, 3, 5)).toBe(1);
  });

  test('Math.random=0.999 → letzter Faktor (maxF)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(pickWeightedFactor({}, 3, 5)).toBe(5);
  });

  test('Statistik: gleiche Weights → Gleichverteilung über 1000 Runs', () => {
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) counts[pickWeightedFactor({}, 3, 5) - 1]++;
    counts.forEach(c => expect(c).toBeGreaterThan(150)); // erwartet ~200, ±25% Toleranz
  });
});
```

- [ ] **Step 3: Run fail**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/leitner.test.js --reporter=line
```

Expected: zusätzliche 11 Tests FAIL (Funktionen noch nicht in exports).

- [ ] **Step 4: Funktionen in `logic.js`**

Nach `getMaxFactor`:

```js
function getQuestionWeight(questionStats, reihe, factor) {
  const qs = questionStats[reihe]?.[factor];
  if (!qs || (qs.correct === 0 && qs.wrong === 0)) return 5;
  if (qs.consecutiveCorrect >= 6) return 1;
  if (qs.consecutiveCorrect === 5) return 2;
  if (qs.consecutiveCorrect >= 3) return 3;
  if (qs.consecutiveCorrect >= 1) return 5;
  return Math.min(4 + qs.wrong * 2, 12);
}

function pickWeightedFactor(questionStats, reihe, maxF) {
  const weights = Array.from({length: maxF}, (_, i) => getQuestionWeight(questionStats, reihe, i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < maxF; i++) { r -= weights[i]; if (r <= 0) return i + 1; }
  return maxF;
}
```

Im `module.exports` ergänzen: `getQuestionWeight, pickWeightedFactor`.

- [ ] **Step 5: Inline aus `index.html` löschen**

`index.html:1743-1758` (die zwei Funktions-Definitionen, ~16 Zeilen).

- [ ] **Step 6: Call-Sites in `index.html` updaten**

Erwartete Treffer (Stand vor Refactoring):
- `1754: const weights = Array.from({length: maxF}, (_, i) => getQuestionWeight(reihe, i + 1));` — diese Zeile war IM `pickWeightedFactor`-Body, der jetzt gelöscht ist → irrelevant
- `1765: const extras = Array.from({length: totalQ - maxF}, () => pickWeightedFactor(reihe, maxF));`

Eine echte Call-Site außerhalb der gerade gelöschten Funktionen finden:

```bash
grep -n "pickWeightedFactor\|getQuestionWeight" /Users/marco/dev/gaming/1x1-trainer/index.html
```

Erwartet: nur noch der eine `pickWeightedFactor`-Aufruf in `generateTrainingSequence`.

Diesen anpassen: `pickWeightedFactor(reihe, maxF)` → `pickWeightedFactor(state.questionStats, reihe, maxF)`.

Falls `getQuestionWeight` woanders aufgerufen wird (nicht erwartet): analog mit `state.questionStats` als erstem Argument.

- [ ] **Step 7: Jest grün?**

```bash
cd /Users/marco/dev/gaming && npx jest tests/unit/leitner.test.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 8: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 9: Manueller Leitner-Smoke**

Server starten. Training in Reihe 3 starten. Mehrere Fragen falsch beantworten (z.B. immer 3×4 falsch). Erwartung: die falsch beantwortete Frage taucht **häufiger** wieder auf als andere — die Gewichtung wirkt.

- [ ] **Step 10: Commit**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/logic.js 1x1-trainer/index.html tests/unit/leitner.test.js
git -C /Users/marco/dev/gaming commit -m "refactor(1x1-trainer): extract getQuestionWeight + pickWeightedFactor

Leitner-system core moves to logic.js with explicit questionStats param.
Weight thresholds (consecutiveCorrect 6/5/3/1, wrong-count formula)
covered by tests including statistical distribution check.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Wave 6: Verifizierung Klasse 3 (getQS-Wrapper)

### Task 6.1: `getQS`-Verhalten via Smoke verifizieren

**Files:**
- (none — verification only; Anpassung erfolgte schon in Task 4.3)

- [ ] **Step 1: Sicherstellen, dass `getQS` heute auf `defaultQS()` zeigt**

```bash
grep -A 4 "function getQS" /Users/marco/dev/gaming/1x1-trainer/index.html
```

Expected: Body enthält `state.questionStats[reihe][factor] = defaultQS();` (statt Inline-Literal).

- [ ] **Step 2: Referenz-Identität testen**

Server starten, DevTools:
```js
const a = getQS(3, 4);
const b = getQS(3, 4);
console.log(a === b);  // muss true sein
a.correct = 99;
console.log(b.correct); // muss 99 sein (gleiche Referenz)
```

Beide Logs müssen true/99 zeigen. Falls nicht: Wrapper hat sich subtil geändert — zurückrollen und prüfen.

- [ ] **Step 3: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 4: Kein Commit nötig** — die Änderung wurde in Task 4.3 mit-committed. Diese Task ist reine Verifikation.

---

## Wave 7: Finalisierung

### Task 7.1: `sw.js` CACHE bumpen

**Files:**
- Modify: `1x1-trainer/sw.js`

- [ ] **Step 1: Cache-Version hochzählen**

`1x1-trainer/sw.js`:1 — `const CACHE = '1x1-trainer-v18';` → `const CACHE = '1x1-trainer-v19';`

- [ ] **Step 2: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 3: Commit (noch nicht — kombiniert mit Task 7.2)**

### Task 7.2: `APP_VERSION` bumpen

**Files:**
- Modify: `1x1-trainer/index.html`

- [ ] **Step 1: Version hochzählen**

`1x1-trainer/index.html` — Zeile mit `const APP_VERSION = '2.3';` → `const APP_VERSION = '2.4';`.

- [ ] **Step 2: Smoke**

```bash
cd /Users/marco/dev/gaming && npx playwright test tests/e2e/refactoring-smoke.spec.js --reporter=line
```

Expected: alle Tests grün.

- [ ] **Step 3: Commit (kombiniert mit 7.1)**

```bash
git -C /Users/marco/dev/gaming add 1x1-trainer/sw.js 1x1-trainer/index.html
git -C /Users/marco/dev/gaming commit -m "chore(1x1-trainer): bump APP_VERSION 2.3 → 2.4, sw cache v18 → v19

Cache-bust to force existing PWAs to re-fetch index.html + logic.js
after refactoring deployment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 7.3: Vollständiger Test-Lauf

**Files:**
- (none — verification only)

- [ ] **Step 1: Jest komplett**

```bash
cd /Users/marco/dev/gaming && npm test 2>&1 | tail -30
```

Expected: alle Unit-Tests grün — sowohl die neuen 5 Files als auch `blitz-logic.test.js`, `division-logic.test.js`.

- [ ] **Step 2: Playwright komplett**

```bash
cd /Users/marco/dev/gaming && npm run test:e2e 2>&1 | tail -30
```

Expected: alle E2E-Tests grün.

- [ ] **Step 3: Falls etwas rot — Plan stoppen**

Bei rotem Test: Ursache klären, Hot-Fix oder Plan-Rückrollen. Nicht ohne Klärung weiter.

### Task 7.4: Manueller End-to-End-Smoke

**Files:**
- (none — manual verification)

- [ ] **Step 1: Server starten**

```bash
cd /Users/marco/dev/gaming && python3 -m http.server 8080
```

- [ ] **Step 2: Im Browser durchklicken — Checklist**

Browser: `http://localhost:8080/1x1-trainer/`.

- [ ] Home-Screen lädt, kein Console-Error
- [ ] Level-Anzeige zeigt korrekten Level (basierend auf `state.xp`)
- [ ] Training: Reihe 3 → richtig: ✅ + XP-Erhöhung
- [ ] Training: Reihe 7 → falsch: ❌ + kein XP-Gain
- [ ] Blitz: Reihen 3+5 wählen → Spiel starten → Timer läuft → fertig spielen → Highscore-Eintrag erscheint
- [ ] Turnier starten — funktioniert
- [ ] Settings → Großes 1×1 toggeln → Reihen-Picker zeigt 1-20
- [ ] Settings → Input-Modus wechseln → wirkt in nächster Frage
- [ ] Reload der Seite → State persistiert
- [ ] Service Worker in DevTools (Application-Tab) zeigt v19-Cache mit `/1x1-trainer/logic.js` drin

- [ ] **Step 3: Server stoppen** (Ctrl+C oder `kill %1`)

### Task 7.5: `CLAUDE.md` aktualisieren

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Aktuellen Text finden**

In `CLAUDE.md` die Stelle, die behauptet *„No compilation, no `npm install`, no setup required."* Wahrscheinlich im Abschnitt „Running games".

- [ ] **Step 2: Ergänzen, nicht ersetzen**

Bestehender Satz bleibt für „Games im Browser laufen lassen". Darunter neu hinzufügen (Beispiel):

```markdown
**Tests** (1x1-trainer): Repo verwendet Jest (Unit) und Playwright (E2E) — `npm install` einmalig nötig, dann `npm test` oder `npm run test:e2e`.
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/marco/dev/gaming add CLAUDE.md
git -C /Users/marco/dev/gaming commit -m "docs(CLAUDE.md): document jest + playwright test setup

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Definition of Done — Checkliste

- [ ] Alle Tasks oben abgehakt
- [ ] `logic.js` enthält alle Klasse-1- und Klasse-2-Funktionen (~13 + 3 Konstanten)
- [ ] `index.html` lädt `logic.js` per `<script src>`, keine Inline-Duplikate mehr
- [ ] Klasse-2-Call-Sites in `index.html` sind alle auf neue Signaturen umgestellt
- [ ] `migrateBlitzState` und `migrateDivState` sind aus `logic.js` entfernt
- [ ] 5 neue Unit-Test-Files grün
- [ ] `refactoring-smoke.spec.js` grün
- [ ] Bestehende Tests (`blitz-logic.test.js`, `division-logic.test.js`, `blitz.spec.js`, `division.spec.js`) weiterhin grün
- [ ] `sw.js` `CACHE` und `APP_VERSION` hochgezählt
- [ ] Manueller End-to-End-Smoke bestätigt: alles wie vorher
- [ ] `CLAUDE.md`-Hinweis auf Test-Setup ergänzt

---

## Was zu tun ist, wenn etwas schiefgeht

| Symptom | Wahrscheinliche Ursache | Schritt |
|---|---|---|
| `ReferenceError: STATE_VERSION is not defined` im Browser | `STATE_VERSION` als `const` in logic.js statt `var` | `const` → `var` ändern in `logic.js` |
| Jest grün, Browser kaputt | Charakterisierungs-Lücke; HTML-Realität anders als Test | Browser-Verhalten nachvollziehen, Spec-Iron-Rule: HTML gewinnt, Test/Code anpassen |
| Playwright-Smoke rot wegen Selector | Hat sich vermutlich nicht wegen Refactoring geändert; Selector zu spezifisch | Test-Selector lockern, Refactoring fortsetzen |
| Call-Site übersehen → Browser-Crash | `getMaxReihe()` etc. ohne Argument geblieben | Grep für `getMaxReihe()` und `getMaxFactor([^s]` → alle Treffer durchgehen |
| PWA zeigt alte Version | Service Worker noch alter Cache aktiv | DevTools → Application → Service Worker → Update + Skip-Waiting; oder `unregister` + reload |

---

## Bewusst NICHT in diesem Plan

| Item | Wann |
|---|---|
| `generateTrainingSequence` pure machen | Folge-Refactor |
| Pure Achievement-Detection | Folge-Refactor |
| CI-Setup (GitHub Action für `npm test`) | Optional, eigener kleiner PR |
| Code-Coverage-Threshold | Out of scope, siehe Spec 5.7 |
| Visual Regression / Screenshot-Tests | Out of scope |
