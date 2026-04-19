# Divisionstraining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Division (÷) und Gemischt (×÷) als wählbare Rechenart in allen drei Spielmodi (Blitz, Turnier, Training) integrieren, mit getrennten Highscores und separatem Leitner-Fortschritt pro Rechenart.

**Architecture:** Alle Änderungen bleiben inline in `1x1-trainer/index.html` (Single-File-Pattern des Projekts). Pure Hilfsfunktionen kommen in `logic.js` für Unit-Tests. `makeQuestion()` bekommt einen Division-Zweig; `q.display` ersetzt den hardgecodeten Fragetext. Drei neue Picker (Blitz erweitert, Turnier neu, Training erweitert) nutzen eine gemeinsame CSS-Komponente `.rechenart-toggle`.

**Tech Stack:** Vanilla JS/HTML/CSS, kein Build-Schritt. Jest (Unit-Tests), Playwright (E2E). Service Worker für PWA-Cache.

**Worktree:** `/Users/marco/dev/gaming/.worktrees/feature-division` (Branch: `feature/division-training`)

**Alle Änderungen im Worktree durchführen:** `cd /Users/marco/dev/gaming/.worktrees/feature-division`

---

## File Structure

| Datei | Änderung |
|---|---|
| `1x1-trainer/index.html` | Hauptdatei — alle JS/CSS/HTML-Änderungen |
| `1x1-trainer/logic.js` | Neue Exports: `resolveRechenart`, `migrateDivState` |
| `1x1-trainer/sw.js` | CACHE v18 |
| `tests/unit/division-logic.test.js` | Neue Unit-Tests für Division-Logik |
| `tests/e2e/division.spec.js` | Neue Playwright E2E-Tests |
| `playwright.config.js` | Bereits auf feature-division worktree umgestellt ✅ |

---

## Task 1: State-Migration v3→v4

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

`defaultState()` liegt bei ca. Zeile 912, `STATE_VERSION` bei Zeile 929, `STATE_MIGRATIONS` ab Zeile 931. Die Migration hängt eine neue Funktion am Ende des Arrays an.

- [ ] **Step 1: `defaultState()` erweitern**

Ersetze die bestehende `defaultState()`-Funktion (ca. Zeile 912–921):

```js
function defaultState() {
  return { _version: STATE_VERSION, name: '', xp: 0, achievements: [], totalCorrect: 0, totalGames: 0,
           streak: 0, lastPlayDate: null,
           highScores: { blitz: 0, turnier: 0, blitzListe: [],
                         blitzDiv: 0, blitzGemischt: 0,
                         turnierDiv: 0, turnierGemischt: 0 },
           blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
           trainingConfig: { rechenart: 'mult' },
           turnierConfig: { rechenart: 'mult' },
           trainedReihen: [], settings: defaultSettings(), reiheStats: defaultReiheStats(),
           streakFreezeUsedDate: null, streakFreezeTotal: 0,
           questionStats: {},
           stars: 0, gameSecondsLeft: 0 };
}
```

- [ ] **Step 2: `defaultReiheStats()` erweitern**

Ersetze `defaultReiheStats()` (ca. Zeile 906–910):

```js
function defaultReiheStats() {
  const s = {};
  for (let i = 1; i <= 20; i++) s[i] = {
    sessions: 0, totalCorrect: 0, totalQuestions: 0, consecutivePerfect: 0,
    divConsecutivePerfect: 0, divCorrect: 0, divWrong: 0
  };
  return s;
}
```

- [ ] **Step 3: `STATE_VERSION` auf 4 erhöhen**

```js
const STATE_VERSION = 4;
```

- [ ] **Step 4: Migration v3→v4 anhängen**

Direkt nach dem letzten Eintrag im `STATE_MIGRATIONS`-Array (nach dem `// v2 → v3`-Block, vor der schließenden `]`):

```js
  // v3 → v4: Division-Rechenart + separate Highscores + reiheStats-Div-Felder
  (s) => {
    if (!s.trainingConfig) s.trainingConfig = { rechenart: 'mult' };
    if (!s.turnierConfig)  s.turnierConfig  = { rechenart: 'mult' };
    if (!s.blitzConfig.rechenart) s.blitzConfig.rechenart = 'mult';
    if (!s.highScores) s.highScores = {};
    if (s.highScores.blitzDiv      === undefined) s.highScores.blitzDiv      = 0;
    if (s.highScores.blitzGemischt === undefined) s.highScores.blitzGemischt = 0;
    if (s.highScores.turnierDiv      === undefined) s.highScores.turnierDiv      = 0;
    if (s.highScores.turnierGemischt === undefined) s.highScores.turnierGemischt = 0;
    if (!s.reiheStats) s.reiheStats = defaultReiheStats();
    for (let i = 1; i <= 20; i++) {
      if (!s.reiheStats[i]) s.reiheStats[i] = defaultReiheStats()[i];
      if (s.reiheStats[i].divConsecutivePerfect === undefined) s.reiheStats[i].divConsecutivePerfect = 0;
      if (s.reiheStats[i].divCorrect            === undefined) s.reiheStats[i].divCorrect            = 0;
      if (s.reiheStats[i].divWrong              === undefined) s.reiheStats[i].divWrong              = 0;
    }
    return s;
  },
```

- [ ] **Step 5: `resetHighscores()` erweitern**

Ersetze den Inhalt der Funktion (ca. Zeile 1286–1290):

```js
function resetHighscores() {
  if (!confirm('Highscores wirklich zurücksetzen?')) return;
  state.highScores = { blitz: 0, turnier: 0, blitzListe: [],
                       blitzDiv: 0, blitzGemischt: 0,
                       turnierDiv: 0, turnierGemischt: 0 };
  saveState();
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/marco/dev/gaming/.worktrees/feature-division
git add 1x1-trainer/index.html
git commit -m "feat(division): State-Migration v3→v4 + defaultState erweitert"
```

---

## Task 2: Pure Logik-Funktionen in logic.js

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/logic.js`

### Kontext

`logic.js` enthält reine Funktionen ohne DOM/State-Zugriff, die über `module.exports` für Jest-Tests bereitgestellt werden.

- [ ] **Step 1: `resolveRechenart` und `migrateDivState` hinzufügen**

Ersetze den gesamten Inhalt von `logic.js`:

```js
// Pure functions — kein DOM, kein localStorage, keine Globals

function pickBlitzReihe(blitzConfig, maxReihe) {
  if (blitzConfig.alleReihen || !blitzConfig.reihen.length)
    return null; // caller uses rnd(1, maxReihe)
  const reihen = blitzConfig.reihen;
  return reihen[Math.floor(Math.random() * reihen.length)];
}

function addBlitzListeEntry(liste, entry) {
  const neu = [...liste, entry];
  neu.sort((a, b) => b.score - a.score);
  return neu.slice(0, 5);
}

function migrateBlitzState(s) {
  if (!s.blitzConfig) s.blitzConfig = { reihen: [], alleReihen: true };
  if (!s.highScores) s.highScores = {};
  if (!s.highScores.blitzListe) s.highScores.blitzListe = [];
  return s;
}

// Löst 'gemischt' zufällig auf; gibt immer 'mult' oder 'div' zurück.
function resolveRechenart(cfg) {
  const r = (cfg && cfg.rechenart) || 'mult';
  if (r === 'gemischt') return Math.random() < 0.5 ? 'mult' : 'div';
  return r;
}

// Migration v3→v4: Division-Felder zu einem State-Objekt hinzufügen.
function migrateDivState(s) {
  if (!s.trainingConfig) s.trainingConfig = { rechenart: 'mult' };
  if (!s.turnierConfig)  s.turnierConfig  = { rechenart: 'mult' };
  if (!s.blitzConfig) s.blitzConfig = { reihen: [], alleReihen: true, rechenart: 'mult' };
  if (!s.blitzConfig.rechenart) s.blitzConfig.rechenart = 'mult';
  if (!s.highScores) s.highScores = {};
  ['blitzDiv','blitzGemischt','turnierDiv','turnierGemischt'].forEach(k => {
    if (s.highScores[k] === undefined) s.highScores[k] = 0;
  });
  if (!s.reiheStats) s.reiheStats = {};
  for (let i = 1; i <= 20; i++) {
    if (!s.reiheStats[i]) s.reiheStats[i] = {};
    const r = s.reiheStats[i];
    if (r.divConsecutivePerfect === undefined) r.divConsecutivePerfect = 0;
    if (r.divCorrect            === undefined) r.divCorrect            = 0;
    if (r.divWrong              === undefined) r.divWrong              = 0;
  }
  return s;
}

if (typeof module !== 'undefined') {
  module.exports = { pickBlitzReihe, addBlitzListeEntry, migrateBlitzState,
                     resolveRechenart, migrateDivState };
}
```

- [ ] **Step 2: Commit**

```bash
git add 1x1-trainer/logic.js
git commit -m "feat(division): resolveRechenart + migrateDivState in logic.js"
```

---

## Task 3: Unit-Tests für Division-Logik

**Files:**
- Create: `tests/unit/division-logic.test.js`

- [ ] **Step 1: Testdatei schreiben**

```js
const { resolveRechenart, migrateDivState } = require('../../1x1-trainer/logic.js');

describe('resolveRechenart', () => {
  test('gibt mult zurück wenn rechenart mult', () => {
    expect(resolveRechenart({ rechenart: 'mult' })).toBe('mult');
  });

  test('gibt div zurück wenn rechenart div', () => {
    expect(resolveRechenart({ rechenart: 'div' })).toBe('div');
  });

  test('gibt mult oder div zurück bei gemischt', () => {
    const results = new Set();
    for (let i = 0; i < 200; i++) results.add(resolveRechenart({ rechenart: 'gemischt' }));
    expect(results.has('mult')).toBe(true);
    expect(results.has('div')).toBe(true);
    expect(results.has('gemischt')).toBe(false);
  });

  test('default ist mult wenn cfg undefined', () => {
    expect(resolveRechenart({})).toBe('mult');
    expect(resolveRechenart(null)).toBe('mult');
  });
});

describe('migrateDivState', () => {
  test('fügt trainingConfig und turnierConfig hinzu', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' }, highScores: {}, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.trainingConfig).toEqual({ rechenart: 'mult' });
    expect(result.turnierConfig).toEqual({ rechenart: 'mult' });
  });

  test('fügt blitzConfig.rechenart hinzu wenn fehlend', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true }, highScores: {}, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.blitzConfig.rechenart).toBe('mult');
  });

  test('überschreibt vorhandene blitzConfig.rechenart nicht', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true, rechenart: 'div' }, highScores: {}, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.blitzConfig.rechenart).toBe('div');
  });

  test('fügt Highscore-Felder hinzu', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true }, highScores: { blitz: 5 }, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.highScores.blitzDiv).toBe(0);
    expect(result.highScores.blitzGemischt).toBe(0);
    expect(result.highScores.turnierDiv).toBe(0);
    expect(result.highScores.turnierGemischt).toBe(0);
  });

  test('fügt reiheStats-Div-Felder hinzu', () => {
    const s = { blitzConfig: {}, highScores: {}, reiheStats: { 3: { sessions: 2, consecutivePerfect: 4 } } };
    const result = migrateDivState(s);
    expect(result.reiheStats[3].divConsecutivePerfect).toBe(0);
    expect(result.reiheStats[3].divCorrect).toBe(0);
    expect(result.reiheStats[3].divWrong).toBe(0);
    expect(result.reiheStats[3].consecutivePerfect).toBe(4); // bestehend bleibt
  });

  test('überschreibt vorhandene divFelder nicht', () => {
    const s = { blitzConfig: {}, highScores: {}, reiheStats: { 5: { divConsecutivePerfect: 3 } } };
    const result = migrateDivState(s);
    expect(result.reiheStats[5].divConsecutivePerfect).toBe(3);
  });
});
```

- [ ] **Step 2: Tests ausführen und sicherstellen, dass sie bestehen**

```bash
npm run test:unit 2>&1
```

Erwartet: alle Tests bestehen (inkl. neue 10 Tests aus division-logic.test.js)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/division-logic.test.js
git commit -m "test(division): Unit-Tests für resolveRechenart und migrateDivState"
```

---

## Task 4: `makeQuestion()` — Division-Support

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

`makeQuestion()` liegt bei ca. Zeile 1632–1652. `nextQuestion()` schreibt den Fragetext bei Zeile 1723. `_doStartGame()` liegt bei ca. Zeile 1673–1699.

- [ ] **Step 1: Hilfsfunktion `resolveRechenart` inline vor `makeQuestion()` einfügen**

Direkt vor `function makeQuestion()`:

```js
function resolveRechenart(cfg) {
  const r = (cfg && cfg.rechenart) || 'mult';
  if (r === 'gemischt') return Math.random() < 0.5 ? 'mult' : 'div';
  return r;
}

function getActiveRechenartCfg() {
  if (game.mode === 'blitz')    return state.blitzConfig;
  if (game.mode === 'turnier')  return state.turnierConfig;
  return state.trainingConfig;
}
```

- [ ] **Step 2: `makeQuestion()` um Division-Zweig erweitern**

Ersetze die Funktion `makeQuestion()` vollständig:

```js
function makeQuestion() {
  let a, b;
  if (game.mode === 'training') {
    a = game.reihe; b = game.sequence[game.qCount];
  } else if (game.mode === 'blitz') {
    a = pickBlitzReihe(); b = rnd(1, getMaxFactor(a));
  } else { // turnier: difficulty grows each round
    const max = Math.min(3 + Math.floor(game.qCount * 0.8), getMaxReihe());
    a = rnd(2, max); b = rnd(2, Math.max(getMaxFactor(a), max));
  }

  const rechenart = resolveRechenart(getActiveRechenartCfg());
  let ans, display, pool;

  if (rechenart === 'div') {
    // a × b = ans  →  (a*b) ÷ a = b
    ans = b;
    display = `${a * b} ÷ ${a} = ?`;
    pool = new Set();
    [-2, -1, 1, 2, 3, 4].forEach(d => { if (b + d > 0) pool.add(b + d); });
    [1, 2, 3].forEach(d => { pool.add(b + d); if (b - d > 0) pool.add(b - d); });
  } else {
    ans = a * b;
    display = `${a} × ${b} = ?`;
    pool = new Set();
    [[a+1,b],[a-1,b],[a,b+1],[a,b-1],[a+1,b+1],[a-1,b-1],
     [a+2,b],[a,b+2]].forEach(([x,y])=>{ if(x>0&&y>0) pool.add(x*y); });
    [1,2,3,5,b,a].forEach(d=>{ if(ans+d>0) pool.add(ans+d); if(ans-d>0) pool.add(ans-d); });
  }
  pool.delete(ans);
  const wrongs = shuffle([...pool]).slice(0, 3);
  while (wrongs.length < 3) wrongs.push(ans + wrongs.length + 1);
  return { a, b, rechenart, ans, display, choices: shuffle([ans, ...wrongs]) };
}
```

- [ ] **Step 3: `nextQuestion()` — `q.display` verwenden**

Zeile 1723 (ca.): Ersetze `document.getElementById('question-text').textContent = \`${q.a} × ${q.b} = ?\`;` durch:

```js
document.getElementById('question-text').textContent = q.display;
```

- [ ] **Step 4: `_doStartGame()` — `game.rechenart` setzen + Modus-Label**

In `_doStartGame(mode, reihe, inputType)`, direkt nach der `game = { ... }`-Zuweisung (ca. Zeile 1676):

```js
  game = { mode, reihe, inputType, sequence, score:0, correct:0, wrong:0, combo:0, maxCombo:0,
           lives:3, timeLeft:60, timer:null, xpEarned:0, qCount:0,
           answered:false, active:true, q:null,
           rechenart: (mode === 'blitz' ? state.blitzConfig
                     : mode === 'turnier' ? state.turnierConfig
                     : state.trainingConfig).rechenart || 'mult' };
```

Ersetze die Modus-Label-Zeilen (ca. 1680–1683) durch:

```js
  const rechenartLabels = { mult: '×', div: '÷', gemischt: '× ÷' };
  const rechenartSuffix = ' · ' + rechenartLabels[game.rechenart];
  const modeLabels = { blitz:'⚡ Blitz-Modus', turnier:'🏆 Turnier', training:'📚 Training' };
  document.getElementById('game-mode-label').textContent =
    modeLabels[mode] + (reihe ? ` · ${reihe}er-Reihe` : '') + rechenartSuffix;
```

- [ ] **Step 5: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(division): makeQuestion Division-Zweig + game.rechenart"
```

---

## Task 5: `endGame` — Division-Highscores + reiheStats

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

`endGame()` liegt bei ca. Zeile 1864–1919. Der Blitz-Block ist bei ca. 1879, der Training-Block bei ca. 1897.

- [ ] **Step 1: Blitz-Highscore-Block aktualisieren**

Ersetze den Blitz-Block in `endGame()`:

```js
  if (game.mode === 'blitz') {
    const hsKey = game.rechenart === 'div' ? 'blitzDiv'
                : game.rechenart === 'gemischt' ? 'blitzGemischt'
                : 'blitz';
    if (game.correct > state.highScores[hsKey]) state.highScores[hsKey] = game.correct;
    if (game.correct > 0) {
      const entry = {
        score: game.correct,
        reihen: state.blitzConfig.alleReihen ? [] : state.blitzConfig.reihen.slice().sort((a,b)=>a-b),
        alleReihen: state.blitzConfig.alleReihen || !state.blitzConfig.reihen.length,
        inputType: game.inputType,
        rechenart: game.rechenart,
        datum: new Date().toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'})
      };
      state.highScores.blitzListe.push(entry);
      state.highScores.blitzListe.sort((a,b) => b.score - a.score);
      state.highScores.blitzListe = state.highScores.blitzListe.slice(0, 5);
    }
  }
```

- [ ] **Step 2: Turnier-Highscore aktualisieren**

Ersetze die Turnier-Highscore-Zeile:

```js
  if (game.mode === 'turnier') {
    const tsKey = game.rechenart === 'div' ? 'turnierDiv'
                : game.rechenart === 'gemischt' ? 'turnierGemischt'
                : 'turnier';
    if (game.score > state.highScores[tsKey]) state.highScores[tsKey] = game.score;
  }
```

- [ ] **Step 3: Training reiheStats-Block — Division getrennt tracken**

Ersetze den reiheStats-Block in `endGame()`:

```js
  if (game.mode === 'training' && game.correct + game.wrong > 0) {
    const rs = state.reiheStats[game.reihe];
    rs.sessions++;
    rs.totalCorrect   += game.correct;
    rs.totalQuestions += game.correct + game.wrong;
    if (game.rechenart === 'div') {
      rs.divCorrect += game.correct;
      rs.divWrong   += game.wrong;
      if (game.wrong === 0) rs.divConsecutivePerfect++;
      else                  rs.divConsecutivePerfect = 0;
    } else if (game.rechenart === 'mult') {
      if (game.wrong === 0) rs.consecutivePerfect++;
      else                  rs.consecutivePerfect = 0;
    }
    // 'gemischt': nur Totals werden gezählt, kein Leitner-Fortschritt
  }
```

- [ ] **Step 4: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(division): endGame Division-Highscores + reiheStats-Tracking"
```

---

## Task 6: CSS — Rechenart-Toggle

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

CSS-Block liegt am Anfang der Datei (ca. Zeile 1–400). Die `.blitz-reihe-btn`-Styles sind ein gutes Vorbild.

- [ ] **Step 1: CSS-Klassen einfügen**

Suche im CSS-Block nach den `.blitz-reihe-btn`-Styles (ca. Zeile 200) und füge direkt danach ein:

```css
    /* RECHENART-TOGGLE (alle Modi) */
    .rechenart-toggle { display: flex; gap: 6px; margin-bottom: 12px; }
    .rechenart-btn {
      flex: 1; text-align: center; background: rgba(255,255,255,0.06);
      border: 1.5px solid rgba(255,255,255,0.15); border-radius: 10px;
      padding: 10px 4px; font-size: 1.1rem; font-weight: 800;
      color: rgba(255,255,255,0.4); cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;
      -webkit-appearance: none;
    }
    .rechenart-btn.active-blitz   { background: rgba(245,158,11,0.25); border-color: rgba(245,158,11,0.8);  color: #fbbf24; }
    .rechenart-btn.active-turnier { background: rgba(59,130,246,0.25); border-color: rgba(59,130,246,0.8);  color: #93c5fd; }
    .rechenart-btn.active-training{ background: rgba(16,185,129,0.25); border-color: rgba(16,185,129,0.8);  color: #6ee7b7; }
```

- [ ] **Step 2: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(division): CSS-Klassen für Rechenart-Toggle"
```

---

## Task 7: Blitz-Picker — Rechenart-Toggle + UI-Updates

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

Der Blitz-Picker HTML-Block ist das `#blitz-modal` (ca. Zeile 742–759). Die JS-Funktionen `showBlitzPicker`, `updateBlitzStartBtn`, `updateBlitzRekordLabel` liegen bei ca. Zeile 1450–1522.

- [ ] **Step 1: Rechenart-Toggle-HTML in `#blitz-modal` einfügen**

Ersetze den HTML-Inhalt des `#blitz-modal`:

```html
<!-- BLITZ-MODUS REIHEN-PICKER -->
<div class="modal-overlay" id="blitz-modal">
  <div class="modal-sheet">
    <div class="modal-title">⚡ Blitz-Modus</div>
    <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Rechenart</div>
    <div class="rechenart-toggle" id="blitz-rechenart-toggle">
      <button class="rechenart-btn" data-r="mult" onclick="selectBlitzRechenart('mult')">×</button>
      <button class="rechenart-btn" data-r="div"  onclick="selectBlitzRechenart('div')">÷</button>
      <button class="rechenart-btn" data-r="gemischt" onclick="selectBlitzRechenart('gemischt')">× ÷</button>
    </div>
    <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-bottom:12px">Welche Reihen sollen abgefragt werden?</div>
    <button class="blitz-alle-btn" id="blitz-alle-btn" onclick="toggleBlitzAlle()">
      <span id="blitz-alle-icon">☐</span>
      <div>
        <div style="font-weight:700">Alle Reihen</div>
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.4)" id="blitz-alle-sub">Reihen 1–10 gemischt</div>
      </div>
    </button>
    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-bottom:6px">Oder bis zu 4 Reihen auswählen:</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px" id="blitz-reihe-grid"></div>
    <button class="btn btn-primary" id="blitz-start-btn" onclick="startBlitz()">▶ Los geht's!</button>
    <button class="btn btn-secondary mt-8" onclick="closeBlitzModal()">Abbrechen</button>
  </div>
</div>
```

- [ ] **Step 2: `selectBlitzRechenart()` hinzufügen und `showBlitzPicker()` anpassen**

Füge direkt nach `showBlitzPicker()` ein:

```js
function selectBlitzRechenart(r) {
  state.blitzConfig.rechenart = r;
  saveState();
  document.querySelectorAll('#blitz-rechenart-toggle .rechenart-btn').forEach(b => {
    b.classList.toggle('active-blitz', b.dataset.r === r);
  });
  updateBlitzStartBtn();
}
```

Am Anfang von `showBlitzPicker()`, direkt nach `const cfg = state.blitzConfig;`, einfügen:

```js
  document.querySelectorAll('#blitz-rechenart-toggle .rechenart-btn').forEach(b => {
    b.classList.toggle('active-blitz', b.dataset.r === (cfg.rechenart || 'mult'));
  });
```

- [ ] **Step 3: `updateBlitzStartBtn()` — Rechenart im Label**

Ersetze `updateBlitzStartBtn()`:

```js
function updateBlitzStartBtn() {
  const cfg = state.blitzConfig;
  const rLabels = { mult: '×', div: '÷', gemischt: '× ÷' };
  const rLabel = rLabels[cfg.rechenart || 'mult'];
  const btn = document.getElementById('blitz-start-btn');
  if (cfg.alleReihen || !cfg.reihen.length) {
    btn.textContent = `▶ Los geht's! (Alle · ${rLabel})`;
  } else {
    btn.textContent = `▶ Los geht's! (${cfg.reihen.slice().sort((a,b)=>a-b).map(r=>r+'er').join(', ')} · ${rLabel})`;
  }
}
```

- [ ] **Step 4: `updateBlitzRekordLabel()` — Rekord per Rechenart**

Ersetze `updateBlitzRekordLabel()`:

```js
function updateBlitzRekordLabel() {
  const cfg = state.blitzConfig;
  const hsKey = (cfg.rechenart || 'mult') === 'div' ? 'blitzDiv'
              : (cfg.rechenart || 'mult') === 'gemischt' ? 'blitzGemischt'
              : 'blitz';
  const best = state.highScores[hsKey] || 0;
  const el = document.getElementById('blitz-rekord-label');
  if (!el) return;
  const rLabels = { mult: '×', div: '÷', gemischt: '× ÷' };
  if (best > 0) {
    document.getElementById('blitz-rekord-val').textContent = `${best} (${rLabels[cfg.rechenart || 'mult']})`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(division): Blitz-Picker Rechenart-Toggle + Rekord-Label"
```

---

## Task 8: Turnier-Picker Modal

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

Die Turnier-Karte auf der Startseite (ca. Zeile 458) hat `onclick="startGame('turnier')"`. Ein neues Modal `#turnier-modal` wird nach dem `#blitz-modal` eingefügt.

- [ ] **Step 1: `onclick` der Turnier-Karte ändern**

Ersetze in der Turnier-Karte:

```html
<div class="mode-card turnier" onclick="showTurnierPicker()">
```

- [ ] **Step 2: `#turnier-modal` HTML nach `#blitz-modal` einfügen**

```html
<!-- TURNIER-PICKER -->
<div class="modal-overlay" id="turnier-modal">
  <div class="modal-sheet">
    <div class="modal-title">🏆 Turnier</div>
    <div style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:16px;text-align:center">10 Fragen · steigende Schwierigkeit</div>
    <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Rechenart</div>
    <div class="rechenart-toggle" id="turnier-rechenart-toggle">
      <button class="rechenart-btn" data-r="mult"     onclick="selectTurnierRechenart('mult')">×</button>
      <button class="rechenart-btn" data-r="div"      onclick="selectTurnierRechenart('div')">÷</button>
      <button class="rechenart-btn" data-r="gemischt" onclick="selectTurnierRechenart('gemischt')">× ÷</button>
    </div>
    <button class="btn btn-primary" style="background:linear-gradient(135deg,#3B82F6,#1D4ED8);box-shadow:0 4px 20px rgba(59,130,246,0.4)" onclick="startTurnier()">▶ Los geht's!</button>
    <button class="btn btn-secondary mt-8" onclick="closeTurnierModal()">Abbrechen</button>
  </div>
</div>
```

- [ ] **Step 3: JS-Funktionen für Turnier-Picker einfügen**

Direkt nach den Blitz-Picker-Funktionen (nach `closeBlitzModal`):

```js
// ── TURNIER-PICKER ─────────────────────────────────────
function showTurnierPicker() {
  const cfg = state.turnierConfig;
  document.querySelectorAll('#turnier-rechenart-toggle .rechenart-btn').forEach(b => {
    b.classList.toggle('active-turnier', b.dataset.r === (cfg.rechenart || 'mult'));
  });
  document.getElementById('turnier-modal').classList.add('active');
}

function selectTurnierRechenart(r) {
  state.turnierConfig.rechenart = r;
  saveState();
  document.querySelectorAll('#turnier-rechenart-toggle .rechenart-btn').forEach(b => {
    b.classList.toggle('active-turnier', b.dataset.r === r);
  });
}

function closeTurnierModal() {
  document.getElementById('turnier-modal').classList.remove('active');
}

function startTurnier() {
  saveState();
  closeTurnierModal();
  startGame('turnier');
}

document.getElementById('turnier-modal').addEventListener('click', function(e) {
  if (e.target === this) closeTurnierModal();
});
```

- [ ] **Step 4: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(division): Turnier-Picker Modal mit Rechenart-Toggle"
```

---

## Task 9: Training-Picker — Rechenart-Toggle + Dual-Progress

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

Der Training-Picker ist das `#training-modal` (ca. Zeile 732–740). `showTrainingPicker()` bei ca. Zeile 1406. Die Reihen-Buttons sind aktuell einfache `<button>`-Elemente mit Text „3er".

- [ ] **Step 1: `#training-modal` HTML erweitern**

Ersetze das bestehende `#training-modal`:

```html
<!-- TRAINING MODAL -->
<div class="modal-overlay" id="training-modal">
  <div class="modal-sheet">
    <div class="modal-title">📚 Welche Reihe möchtest du üben?</div>
    <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Rechenart</div>
    <div class="rechenart-toggle" id="training-rechenart-toggle">
      <button class="rechenart-btn" data-r="mult"     onclick="selectTrainingRechenart('mult')">×</button>
      <button class="rechenart-btn" data-r="div"      onclick="selectTrainingRechenart('div')">÷</button>
      <button class="rechenart-btn" data-r="gemischt" onclick="selectTrainingRechenart('gemischt')">× ÷</button>
    </div>
    <div class="reihe-grid" id="reihe-grid"></div>
    <button class="btn btn-training" id="start-training-btn" onclick="startTraining()" disabled style="opacity:0.5">▶ Los geht's!</button>
    <button class="btn btn-secondary mt-8" onclick="closeTrainingModal()">Abbrechen</button>
  </div>
</div>
```

- [ ] **Step 2: `selectTrainingRechenart()` einfügen + `showTrainingPicker()` anpassen**

Direkt nach `closeTrainingModal()`:

```js
function selectTrainingRechenart(r) {
  state.trainingConfig.rechenart = r;
  saveState();
  document.querySelectorAll('#training-rechenart-toggle .rechenart-btn').forEach(b => {
    b.classList.toggle('active-training', b.dataset.r === r);
  });
}
```

Ersetze `showTrainingPicker()` vollständig:

```js
function showTrainingPicker() {
  selectedReihe = null;
  // Rechenart-Toggle
  const rcfg = state.trainingConfig || { rechenart: 'mult' };
  document.querySelectorAll('#training-rechenart-toggle .rechenart-btn').forEach(b => {
    b.classList.toggle('active-training', b.dataset.r === (rcfg.rechenart || 'mult'));
  });
  // Reihen-Grid mit Dual-Progress
  const grid = document.getElementById('reihe-grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = '1fr 1fr';
  grid.style.gap = '8px';
  for (let i = 1; i <= getMaxReihe(); i++) {
    const rs = state.reiheStats[i] || {};
    const multMastered = areAllQuestionsMastered(i);
    const multPlayed   = (rs.totalQuestions || 0) > 0;
    const divMastered  = (rs.divConsecutivePerfect || 0) >= 6;
    const divPlayed    = (rs.divCorrect || 0) + (rs.divWrong || 0) > 0;
    const multText = multMastered ? '× gemeistert ✅'
                   : multPlayed   ? `× ${Math.min(rs.consecutivePerfect||0,5)} von 6 ⭐`
                   : '× noch nicht geübt';
    const divText  = divMastered  ? '÷ gemeistert ✅'
                   : divPlayed    ? `÷ ${Math.min(rs.divConsecutivePerfect||0,5)} von 6 ⭐`
                   : '÷ noch nicht geübt';
    const borderColor = multMastered && divMastered ? 'rgba(16,185,129,0.6)'
                      : multPlayed || divPlayed      ? 'rgba(245,158,11,0.4)'
                      : 'rgba(255,255,255,0.1)';
    const btn = document.createElement('button');
    btn.style.cssText = `background:rgba(255,255,255,0.06);border:1px solid ${borderColor};border-radius:10px;padding:10px 12px;text-align:left;cursor:pointer;color:#fff;display:flex;flex-direction:column;gap:3px;-webkit-appearance:none;`;
    btn.innerHTML = `<div style="font-weight:800;font-size:0.95rem">${i}er-Reihe</div>
      <div style="font-size:0.62rem;color:rgba(255,255,255,0.45)">${multText}</div>
      <div style="font-size:0.62rem;color:rgba(255,255,255,0.45)">${divText}</div>`;
    btn.onclick = () => selectReihe(i, btn);
    grid.appendChild(btn);
  }
  const sb = document.getElementById('start-training-btn');
  sb.disabled = true; sb.style.opacity = '0.5'; sb.textContent = '▶ Los geht\'s!';
  document.getElementById('training-modal').classList.add('active');
}
```

- [ ] **Step 3: `selectReihe()` — Outline-Style für card-artige Buttons anpassen**

Ersetze `selectReihe()`:

```js
function selectReihe(n, el) {
  selectedReihe = n;
  document.querySelectorAll('#reihe-grid button').forEach(b => b.style.outline = '');
  el.style.outline = '2px solid #6C63FF';
  const sb = document.getElementById('start-training-btn');
  sb.disabled = false; sb.style.opacity = '1';
  sb.textContent = `▶ ${n}er-Reihe üben!`;
}
```

- [ ] **Step 4: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(division): Training-Picker Rechenart-Toggle + Dual-Progress-Karten"
```

---

## Task 10: Blitz-Highscore-Seite — Rechenart-Badge + Housekeeping

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`

### Kontext

`renderBlitzHighscores()` liegt bei ca. Zeile 1525–1548.

- [ ] **Step 1: `renderBlitzHighscores()` um Rechenart-Badge erweitern**

Ersetze in `renderBlitzHighscores()` die Zeile:

```js
    const reihenText = entry.alleReihen ? 'Alle Reihen' : 'Reihen: ' + entry.reihen.join(', ');
    const inputText = entry.inputType === 'type' ? '⌨️ Eintippen' : '👆 Antippen';
```

durch:

```js
    const reihenText = entry.alleReihen ? 'Alle Reihen' : 'Reihen: ' + entry.reihen.join(', ');
    const inputText = entry.inputType === 'type' ? '⌨️ Eintippen' : '👆 Antippen';
    const rLabels = { mult: '×', div: '÷', gemischt: '× ÷' };
    const rText = rLabels[entry.rechenart || 'mult'];
```

Und ersetze in der Zeile mit `${reihenText} · ${inputText} · ${entry.datum}`:

```js
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.35)">${reihenText} · ${rText} · ${inputText} · ${entry.datum}</div>
```

- [ ] **Step 2: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(division): Blitz-Highscore-Seite zeigt Rechenart-Badge"
```

---

## Task 11: APP_VERSION + SW-Cache

**Files:**
- Modify: `.worktrees/feature-division/1x1-trainer/index.html`
- Modify: `.worktrees/feature-division/1x1-trainer/sw.js`

- [ ] **Step 1: APP_VERSION auf 2.3 erhöhen**

```js
const APP_VERSION = '2.3';
```

- [ ] **Step 2: SW-Cache auf v18 erhöhen**

In `sw.js` Zeile 1:

```js
const CACHE = '1x1-trainer-v18';
```

- [ ] **Step 3: Commit**

```bash
git add 1x1-trainer/index.html 1x1-trainer/sw.js
git commit -m "chore: APP_VERSION 2.3 + SW-Cache v18 für Division-Release"
```

---

## Task 12: E2E-Tests

**Files:**
- Create: `tests/e2e/division.spec.js`

- [ ] **Step 1: E2E-Testdatei schreiben**

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

test('Blitz-Picker zeigt Rechenart-Toggle', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-rechenart-toggle')).toBeVisible();
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="mult"]')).toBeVisible();
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="div"]')).toBeVisible();
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="gemischt"]')).toBeVisible();
});

test('Blitz-Picker: Mult ist Standard-Rechenart', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="mult"]')).toHaveClass(/active-blitz/);
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="div"]')).not.toHaveClass(/active-blitz/);
});

test('Blitz-Picker: Rechenart-Wahl wird im Start-Button angezeigt', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await page.click('#blitz-rechenart-toggle .rechenart-btn[data-r="div"]');
  await expect(page.locator('#blitz-start-btn')).toContainText('÷');
});

test('Blitz-Picker: Rechenart wird persistent gespeichert', async ({ page }) => {
  await page.click('.mode-card.blitz');
  await page.click('#blitz-rechenart-toggle .rechenart-btn[data-r="gemischt"]');
  await page.click('#blitz-modal .btn-secondary');
  await page.click('.mode-card.blitz');
  await expect(page.locator('#blitz-rechenart-toggle .rechenart-btn[data-r="gemischt"]')).toHaveClass(/active-blitz/);
});

test('Turnier-Karte öffnet Turnier-Picker', async ({ page }) => {
  await page.click('.mode-card.turnier');
  await expect(page.locator('#turnier-modal')).toBeVisible();
  await expect(page.locator('#turnier-rechenart-toggle')).toBeVisible();
});

test('Turnier-Picker: Mult ist Standard-Rechenart', async ({ page }) => {
  await page.click('.mode-card.turnier');
  await expect(page.locator('#turnier-rechenart-toggle .rechenart-btn[data-r="mult"]')).toHaveClass(/active-turnier/);
});

test('Training-Picker zeigt Rechenart-Toggle', async ({ page }) => {
  await page.click('.mode-card.training');
  await expect(page.locator('#training-rechenart-toggle')).toBeVisible();
  await expect(page.locator('#training-rechenart-toggle .rechenart-btn[data-r="mult"]')).toHaveClass(/active-training/);
});

test('Training-Picker: Reihen zeigen Dual-Progress-Zeilen', async ({ page }) => {
  await page.click('.mode-card.training');
  const firstCard = page.locator('#reihe-grid button').first();
  await expect(firstCard).toContainText('×');
  await expect(firstCard).toContainText('÷');
});
```

- [ ] **Step 2: E2E-Tests ausführen**

```bash
npm run test:e2e 2>&1
```

Erwartet: alle 15 Tests bestehen (7 bestehende + 8 neue)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/division.spec.js
git commit -m "test(division): E2E-Tests für Rechenart-Picker in allen Modi"
```

---

## Task 13: Gesamttest + Finalisierung

**Files:** keine neuen Dateien

- [ ] **Step 1: Alle Unit-Tests ausführen**

```bash
npm run test:unit 2>&1
```

Erwartet: 30 Tests bestehen (20 bestehende + 10 neue)

- [ ] **Step 2: Alle E2E-Tests ausführen**

```bash
npm run test:e2e 2>&1
```

Erwartet: 15 Tests bestehen

- [ ] **Step 3: Sicherstellen dass kein `<<<` Merge-Konflikt-Marker in index.html steckt**

```bash
grep -c "<<<<<<" /Users/marco/dev/gaming/.worktrees/feature-division/1x1-trainer/index.html && echo "KONFLIKT!" || echo "OK"
```

Erwartet: `OK`

- [ ] **Step 4: Abschließender Commit falls nötig**

Nur wenn noch unstaged changes vorhanden:

```bash
git status
# Falls nötig:
git add -A && git commit -m "chore: finale Bereinigung Division-Feature"
```
