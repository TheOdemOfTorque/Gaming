# Stars & Space Invader Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a progressive XP→Stars system that unlocks Space Invader gameplay inside the 1x1-trainer as a reward screen, gated behind a 3-day streak requirement.

**Architecture:** All invader code (CSS + HTML + JS) is embedded directly into `1x1-trainer/index.html` as a new `#screen-invader` screen. A trainer-controlled timer overlay sits on top of the invader canvas. Stars are earned via XP, redeemed blockwise (1 star per 10-min block). The original `space-invader-revibed/index.html` gets a redirect guard so it can only be reached through the trainer.

**Tech Stack:** Vanilla JS, HTML5 Canvas (invader), Web Audio API, localStorage, Node.js `canvas` package (icon generation only)

---

## File Map

| File | Change |
|---|---|
| `1x1-trainer/index.html` | Add state fields, star logic, Spiele-Leiste HTML+CSS, screen-invader HTML+CSS+JS |
| `1x1-trainer/sw.js` | Bump cache version to v13 |
| `space-invader-revibed/index.html` | Add redirect guard at top of `<script>` |
| `scripts/generate-icons.js` | New: Node.js script to generate icon-192.png and icon-512.png |
| `scripts/package.json` | New: only used for icon generation, single `canvas` dependency |
| `1x1-trainer/icon-192.png` | Overwritten by icon script |
| `1x1-trainer/icon-512.png` | Overwritten by icon script |

---

## Task 1: State extension — stars + gameSecondsLeft

**Files:**
- Modify: `1x1-trainer/index.html` (around line 620: `defaultState()`, migration block ~634)

- [ ] **Step 1: Add `stars` and `gameSecondsLeft` to `defaultState()`**

Find `defaultState()` at line 621. Add the two new fields:

```js
function defaultState() {
  return { name: '', xp: 0, achievements: [], totalCorrect: 0, totalGames: 0,
           streak: 0, lastPlayDate: null, highScores: { blitz: 0, turnier: 0 },
           trainedReihen: [], settings: defaultSettings(), reiheStats: defaultReiheStats(),
           streakFreezeUsedDate: null, streakFreezeTotal: 0,
           questionStats: {},
           stars: 0, gameSecondsLeft: 0 };
}
```

- [ ] **Step 2: Add migration lines**

After the existing migration block (around line 639), add:

```js
if (state.stars            === undefined) state.stars            = 0;
if (state.gameSecondsLeft  === undefined) state.gameSecondsLeft  = 0;
```

- [ ] **Step 3: Add STAR_COSTS constant**

Add near the top of the `<script>` section, after the `LEVELS` constant:

```js
const STAR_COSTS = [400, 600, 900, 1200]; // XP cost for next star (caps at index 3)
```

- [ ] **Step 4: Verify the state loads cleanly**

Open `http://localhost:8080/1x1-trainer/` in browser. Open DevTools console. Run:
```js
JSON.parse(localStorage.getItem('henry_einmaleins'))
```
Expected: object with `stars: 0` and `gameSecondsLeft: 0` (migration ran, no errors).

- [ ] **Step 5: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(stars): add stars/gameSecondsLeft state fields + STAR_COSTS"
```

---

## Task 2: Star earning logic in endGame()

**Files:**
- Modify: `1x1-trainer/index.html` (around line 1267: after `state.xp += game.xpEarned`)

- [ ] **Step 1: Add `earnStars()` helper function**

Add this function just before `endGame()` (around line 1238):

```js
// ── STAR EARNING ───────────────────────────────────────
function earnStars() {
  const cost = STAR_COSTS[Math.min(state.stars, STAR_COSTS.length - 1)];
  if (state.xp >= cost) {
    state.stars++;
    state.xp -= cost;
    showToast('⭐ Neuer Stern! Du hast 10 Minuten Spielzeit verdient!');
  }
  // Max 1 star per game session — do not loop
}
```

- [ ] **Step 2: Call `earnStars()` in `endGame()` after XP is added**

In `endGame()`, right after `state.xp += game.xpEarned` (line ~1268) and before `checkAchievements()`:

```js
const oldLevel = getLevelInfo(state.xp).level;
state.xp += game.xpEarned;
earnStars();   // ← add this line
const newLevel = getLevelInfo(state.xp).level;
```

- [ ] **Step 3: Add `showToast()` helper**

Add this near the other utility functions (e.g., just after the `confetti()` function):

```js
function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
    'background:rgba(245,158,11,0.95);color:#000;font-weight:800;font-size:0.9rem;' +
    'padding:10px 18px;border-radius:20px;z-index:500;white-space:nowrap;' +
    'animation:floatUp 2.5s ease forwards;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
```

- [ ] **Step 4: Manually test**

In the browser console, temporarily lower XP threshold to test:
```js
// Simulate having 400 XP and earning a star
state.xp = 400; state.stars = 0; earnStars();
console.log(state.stars, state.xp); // Expected: 1, 0
```

- [ ] **Step 5: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(stars): star earning logic in endGame with toast notification"
```

---

## Task 3: Spiele-Leiste HTML in Home screen

**Files:**
- Modify: `1x1-trainer/index.html` (around line 341: after `.mode-grid` and before `.spacer`)

- [ ] **Step 1: Add the games bar HTML**

Find this in `#screen-home` (around line 340):
```html
  <div class="spacer"></div>
```

Replace with:
```html
  <!-- SPIELE-LEISTE -->
  <div id="games-bar" class="games-bar mt-12">
    <div id="games-bar-content"></div>
  </div>
  <div class="spacer"></div>
```

- [ ] **Step 2: Add Spiele-Leiste CSS**

Add in the `<style>` section (before the closing `</style>`):

```css
/* SPIELE-LEISTE */
.games-bar { width: 100%; }
.games-bar-inner {
  border-radius: 16px; padding: 12px 14px;
  display: flex; align-items: center; justify-content: space-between;
}
.games-bar-inner.ready {
  background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1));
  border: 1px solid rgba(245,158,11,0.4);
}
.games-bar-inner.locked {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  opacity: 0.5;
}
.games-bar-title { font-size: 0.88rem; font-weight: 800; }
.games-bar-sub { font-size: 0.65rem; color: rgba(255,255,255,0.45); margin-top: 2px; }
.games-bar-btn {
  background: linear-gradient(135deg, #F59E0B, #EF4444);
  border: none; border-radius: 10px; color: #fff;
  font-weight: 800; font-size: 0.78rem;
  padding: 8px 14px; cursor: pointer; -webkit-appearance: none;
}
.games-bar-btn:active { transform: scale(0.95); }
```

- [ ] **Step 3: Verify HTML structure in DevTools**

Open browser, inspect `#games-bar`. It should be present below the mode grid. `#games-bar-content` is empty — that's correct, it gets populated by `updateHomeUI()` in Task 4.

- [ ] **Step 4: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(stars): Spiele-Leiste HTML + CSS in home screen"
```

---

## Task 4: updateHomeUI — render Spiele-Leiste

**Files:**
- Modify: `1x1-trainer/index.html` (inside `updateHomeUI()`, around line 896)

- [ ] **Step 1: Add games bar rendering at the end of `updateHomeUI()`**

At the very end of `updateHomeUI()`, just before the closing `}`, add:

```js
  // ── Spiele-Leiste ───────────────────────────────────
  const bar = document.getElementById('games-bar-content');
  if (state.streak < 3) {
    bar.innerHTML = `<div class="games-bar-inner locked">
      <div>
        <div class="games-bar-title">🔒 Spiele</div>
        <div class="games-bar-sub">Erst ab 3 Tagen Streak verfügbar (aktuell: ${state.streak})</div>
      </div>
    </div>`;
  } else if (state.stars === 0) {
    bar.innerHTML = `<div class="games-bar-inner locked">
      <div>
        <div class="games-bar-title">🔒 Spiele</div>
        <div class="games-bar-sub">Du hast gerade keine Sterne! Übe mehr, um Sterne zu verdienen.</div>
      </div>
    </div>`;
  } else {
    const totalMin = state.gameSecondsLeft > 0
      ? Math.ceil(state.gameSecondsLeft / 60) + (state.stars - 1) * 10
      : state.stars * 10;
    const starsDisplay = '⭐'.repeat(Math.min(state.stars, 5)) + (state.stars > 5 ? ` ×${state.stars}` : '');
    bar.innerHTML = `<div class="games-bar-inner ready">
      <div>
        <div class="games-bar-title">🎮 Spiele</div>
        <div class="games-bar-sub">${starsDisplay} · ${totalMin} min verfügbar</div>
      </div>
      <button class="games-bar-btn" onclick="enterInvaderScreen()">Los! →</button>
    </div>`;
  }
```

- [ ] **Step 2: Test all three states in browser console**

```js
// State 1: streak too low
state.streak = 1; state.stars = 2; updateHomeUI();
// Expected: "🔒 Spiele  Erst ab 3 Tagen Streak verfügbar"

// State 2: streak ok but no stars
state.streak = 5; state.stars = 0; updateHomeUI();
// Expected: "🔒 Spiele  Du hast gerade keine Sterne!"

// State 3: ready
state.streak = 5; state.stars = 2; state.gameSecondsLeft = 0; updateHomeUI();
// Expected: "🎮 Spiele  ⭐⭐ · 20 min verfügbar  [Los! →]"

// State 3b: mid-block
state.gameSecondsLeft = 300; state.stars = 2; updateHomeUI();
// Expected: "🎮 Spiele  ⭐⭐ · 15 min verfügbar  [Los! →]" (5min left + 10min = 15)
```

- [ ] **Step 3: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(stars): render Spiele-Leiste based on streak/stars state"
```

---

## Task 5: screen-invader HTML structure

**Files:**
- Modify: `1x1-trainer/index.html` (after the `#screen-results` or `#screen-trophies` section, before the closing `</body>` area)

- [ ] **Step 1: Find where to insert**

Locate the final `</div>` before the `<script>` tag opening (the last screen's closing tag). Add `#screen-invader` after it.

- [ ] **Step 2: Add the screen-invader HTML**

The screen uses `padding:0;max-width:none` to allow the canvas to fill the viewport. The trainer's timer/exit overlay uses `position:fixed;z-index:200` and sits above the invader.

```html
<!-- SPACE INVADER SCREEN -->
<div id="screen-invader" class="screen" style="padding:0;max-width:none;overflow:hidden;background:#000;">

  <!-- Trainer overlay: timer + exit button (z-index 200, above invader) -->
  <div style="position:fixed;top:0;left:0;right:0;z-index:200;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;pointer-events:none;">
    <button id="invader-exit-btn" onclick="exitInvaderScreen()"
      style="pointer-events:all;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.3);
             border-radius:10px;color:#fff;font-size:1rem;font-weight:700;padding:6px 12px;cursor:pointer;">✕</button>
    <div id="invader-timer"
      style="pointer-events:none;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);
             border-radius:10px;color:#fff;font-size:1rem;font-weight:800;padding:6px 12px;">⏱ 10:00</div>
  </div>

  <!-- Space Invader canvas -->
  <canvas id="c"></canvas>

  <!-- Menu buttons (invader's own) -->
  <div id="menuBtns">
    <button class="ov-btn" id="btnPlay">▶  SPIELEN</button>
    <button class="ov-btn ghost" id="btnSettings">⚙  Einstellungen</button>
  </div>

  <!-- Touch controls -->
  <div id="ui" style="display:none">
    <div class="dpad">
      <div class="inv-btn" id="bL">◀</div>
      <div class="inv-btn" id="bR">▶</div>
    </div>
    <div class="inv-btn" id="bPause">⏸</div>
    <div class="inv-btn" id="bFire">🔥</div>
  </div>

  <!-- Pause overlay -->
  <div class="ov" id="pauseOv">
    <div class="ov-title" style="color:#ffffff; font-size:40px">PAUSE</div>
    <button class="ov-btn" id="pauseResume" style="width:200px">▶ Fortsetzen</button>
    <button class="ov-btn ghost" id="pauseSettings" style="width:200px">⚙ Einstellungen</button>
    <button class="ov-btn ghost" id="pauseRestart" style="width:200px">⏹ Zum Menü</button>
  </div>

  <!-- Settings overlay -->
  <div class="ov" id="settOv">
    <div class="ov-title" style="color:#44ffff; font-size:26px">⚙ EINSTELLUNGEN</div>
    <div class="ov-label" style="margin-top:6px">Power-up Wahrscheinlichkeit</div>
    <div class="set-row" id="puRow"></div>
    <div class="ov-label" style="margin-top:10px">Schwierigkeitsgrad</div>
    <div class="set-row" id="diffRow"></div>
    <button class="ov-btn" id="settBack" style="margin-top:16px">✓ Fertig</button>
  </div>

  <!-- Game Over → Name Entry overlay -->
  <div class="ov" id="goOv">
    <div class="ov-title" style="color:#ff4444">GAME OVER</div>
    <div class="ov-score" id="goScoreTxt">SCORE: 0</div>
    <div class="ov-record" id="goRecord" style="display:none">🏆 NEUER REKORD!</div>
    <div class="ov-label">Trag dich in die Highscore-Liste ein:</div>
    <input class="ov-input" id="goName" type="text" maxlength="12"
      placeholder="Dein Name" autocomplete="off" autocorrect="off"
      autocapitalize="characters" inputmode="text" spellcheck="false">
    <button class="ov-btn" id="goSubmit">Eintragen ✓</button>
    <button class="ov-btn ghost" id="goSkip">Überspringen</button>
  </div>

  <!-- Highscore table overlay -->
  <div class="ov" id="hsOv">
    <div class="ov-title" style="color:#ffff44; font-size:28px">🏆 HIGHSCORES</div>
    <div class="ov-label" id="hsDiffLabel" style="color:#8899bb; font-size:13px; text-transform:none; letter-spacing:0"></div>
    <table class="hs-table">
      <thead><tr><th class="hs-rank">#</th><th class="hs-name">Name</th><th class="hs-pts">Punkte</th></tr></thead>
      <tbody id="hsTbody"></tbody>
    </table>
    <button class="ov-btn" id="playAgain" style="margin-top:6px">🚀 Nochmal spielen</button>
    <button class="ov-btn ghost" id="hsSettings">⚙ Einstellungen</button>
  </div>

</div>
```

Note: touch button class renamed from `btn` to `inv-btn` to avoid conflict with trainer's `.btn` class.

- [ ] **Step 3: Verify screen is hidden initially**

Open browser, confirm `#screen-invader` exists in DOM but is not visible (`.screen` without `.active`).

- [ ] **Step 4: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(invader): add screen-invader HTML structure"
```

---

## Task 6: Space Invader CSS (scoped under #screen-invader)

**Files:**
- Modify: `1x1-trainer/index.html` (add to `<style>` section)

- [ ] **Step 1: Add scoped invader CSS to the `<style>` section**

All invader CSS is scoped under `#screen-invader` to prevent conflicts with trainer styles. Note: `.btn` from invader is renamed to `.inv-btn` in HTML (Task 5), reflected here.

```css
/* ═══ SPACE INVADER ═══════════════════════════════════════ */
#screen-invader canvas { display: block; }

#screen-invader #ui {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; align-items: flex-end;
  padding: 14px 18px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  pointer-events: none;
}
#screen-invader .dpad { display: flex; gap: 10px; }
#screen-invader .inv-btn {
  width: 68px; height: 68px; border-radius: 50%;
  background: rgba(100,200,255,0.12); border: 2px solid rgba(100,200,255,0.35);
  display: flex; align-items: center; justify-content: center; font-size: 26px;
  pointer-events: all; user-select: none; -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent; cursor: pointer;
}
#screen-invader .inv-btn.pressed { background: rgba(100,200,255,0.30); }
#screen-invader #bFire {
  width: 78px; height: 78px;
  background: rgba(255,80,80,0.15); border-color: rgba(255,80,80,0.45); font-size: 30px;
}
#screen-invader #bFire.pressed { background: rgba(255,80,80,0.35); }
#screen-invader #bPause {
  width: 52px; height: 52px; font-size: 20px; align-self: center;
  background: rgba(200,200,255,0.08); border-color: rgba(200,200,255,0.25);
}
#screen-invader #bPause.pressed { background: rgba(200,200,255,0.20); }

#screen-invader #menuBtns {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: none; flex-direction: column; align-items: center; gap: 12px;
  padding: 20px 24px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
  background: linear-gradient(transparent, rgba(4,4,28,0.95) 35%);
}
#screen-invader #menuBtns .ov-btn { width: 220px; font-size: 17px; padding: 14px 0; }
#screen-invader #menuBtns .ov-btn.ghost { width: 220px; }

#screen-invader .ov {
  display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(4,4,28,0.95); z-index: 50;
  flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 24px; overflow-y: auto;
  font-family: 'Courier New', monospace; color: #fff;
}
#screen-invader .ov.show { display: flex; }
#screen-invader #pauseOv { background: rgba(4,4,28,0.88); }
#screen-invader .ov-title { font-size: 50px; font-weight: bold; text-align: center; text-shadow: 0 0 24px currentColor; }
#screen-invader .ov-score { font-size: 24px; font-weight: bold; color: #ffff44; text-shadow: 0 0 14px #ffff44; }
#screen-invader .ov-record { font-size: 16px; font-weight: bold; color: #ff88ff; text-shadow: 0 0 10px #ff88ff; }
#screen-invader .ov-label { font-size: 12px; color: #7788aa; text-align: center; text-transform: uppercase; letter-spacing: 0.06em; }
#screen-invader .ov-input {
  background: #080818; color: #fff; border: 2px solid #4477ff; border-radius: 8px;
  padding: 11px 20px; font: bold 20px 'Courier New'; text-align: center;
  width: 230px; outline: none; caret-color: #88aaff;
}
#screen-invader .ov-input:focus { border-color: #88aaff; box-shadow: 0 0 14px #4477ff55; }
#screen-invader .ov-btn {
  background: #1e40af; color: #fff; border: none; border-radius: 8px;
  padding: 12px 32px; font: bold 16px 'Courier New';
  cursor: pointer; touch-action: manipulation;
}
#screen-invader .ov-btn:hover { background: #2554c7; }
#screen-invader .ov-btn.ghost {
  background: transparent; color: #667; border: 1px solid #334;
  padding: 9px 22px; font-size: 13px;
}
#screen-invader .ov-btn.ghost:hover { color: #aaa; border-color: #556; }
#screen-invader .set-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
#screen-invader .set-opt {
  background: transparent; color: #778; border: 1px solid #334;
  border-radius: 6px; padding: 8px 13px; font: bold 12px 'Courier New';
  cursor: pointer; touch-action: manipulation; transition: all 0.12s;
}
#screen-invader .set-opt:hover { border-color: #556; color: #aaa; }
#screen-invader .set-opt.active { background: #1e3a8a; color: #fff; border-color: #4477ff; box-shadow: 0 0 8px #4477ff44; }
#screen-invader .hs-table {
  font-family: 'Courier New'; font-size: 15px;
  border-collapse: collapse; min-width: 290px; width: 100%; max-width: 340px;
}
#screen-invader .hs-table th {
  color: #6677aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
  padding: 5px 10px; border-bottom: 1px solid #222;
}
#screen-invader .hs-table td { padding: 7px 10px; border-bottom: 1px solid #111; }
#screen-invader .hs-table tr.new td { color: #ffff44; text-shadow: 0 0 8px #ffff44; font-weight: bold; }
#screen-invader .hs-rank { text-align: center; }
#screen-invader .hs-name { text-align: left; font-weight: bold; }
#screen-invader .hs-pts  { text-align: right; font-variant-numeric: tabular-nums; }

/* Invader timer warning state (applied by JS) */
#invader-timer.warning { color: #EF4444 !important; border-color: rgba(239,68,68,0.5) !important; animation: pulse 0.5s infinite alternate; }
```

- [ ] **Step 2: Verify in browser**

Navigate to invader screen temporarily via console: `showScreen('invader')`. The canvas should be visible (black, no crash). Execute `showScreen('home')` to go back.

- [ ] **Step 3: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(invader): add scoped Space Invader CSS"
```

---

## Task 7: Space Invader JS integration

**Files:**
- Modify: `1x1-trainer/index.html` (add to `<script>` section, just before `// ── INIT ──`)

This task copies the invader's JS with these targeted renames to avoid conflicts:
- `let state = 'menu'` → `let invState = 'menu'`  
- All uses of `state` (the invader string variable) → `invState`
- `function startGame()` → `function invStartGame()`
- `function showMenu()` → `function invShowMenu()`
- `tbtn(id, prop)` references `.btn` class → uses `.inv-btn` class now
- Game loop guard: only process when `#screen-invader` is active

- [ ] **Step 1: Set the `window.__1x1trainer` flag**

At the very top of the `<script>` section (first line of JS, before everything else), add:

```js
window.__1x1trainer = true;
```

- [ ] **Step 2: Copy invader JS with renames**

Immediately before `// ── INIT ──` (line ~1445), add a clearly marked block:

```js
// ═══════════════════════════════════════════════════════════════
//  SPACE INVADER — embedded from space-invader-revibed/index.html
//  Renames vs original: state→invState, startGame→invStartGame,
//  showMenu→invShowMenu, .btn→.inv-btn (in tbtn calls)
// ═══════════════════════════════════════════════════════════════

const C   = document.getElementById('c');
const ctx = C.getContext('2d');
const W = 360, H = 640;

function invResize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  C.width = W; C.height = H;
  C.style.width  = (W*s)+'px';
  C.style.height = (H*s)+'px';
}
invResize();
window.addEventListener('resize', invResize);

// [paste full invader JS here, with these substitutions applied:]
// 1. "let state='menu'" → "let invState='menu'"
// 2. Every occurrence of standalone "state" (the string var) → "invState"
//    IMPORTANT: "state===" / "state='" / "state = " only when it refers to invader state string
//    Do NOT rename the trainer's "state" object (it uses state.xp etc.)
//    The invader state variable only appears in update(), draw(), showPause(),
//    resumeGame(), showMenu(), showSettings(), startGame(), onHit() etc.
// 3. "function startGame()" → "function invStartGame()"
// 4. All calls to "startGame()" within invader code → "invStartGame()"
// 5. "function showMenu()" → "function invShowMenu()"
// 6. All calls to "showMenu()" within invader → "invShowMenu()"
// 7. tbtn() is called with 'bL','bR','bFire','bPause' — change event listener
//    to add 'pressed' class (no class name conflict since we renamed to inv-btn)
// 8. The game loop at the bottom:
//    Change from: requestAnimationFrame(ts=>{last=ts;loop(ts);});
//    To the guarded version shown in Step 3.
// 9. Remove: buildSettingsUI(); showMenu(); (last 2 lines of original invader JS)
//    These will be called from enterInvaderScreen() instead.
```

**Copy the full invader JS (lines 185–1058 of space-invader-revibed/index.html) here, applying all 9 substitutions above.**

- [ ] **Step 3: Replace the game loop at the bottom of the invader block**

The original last lines are:
```js
let last=0;
function loop(ts){ const dt=Math.min((ts-last)/1000,0.05);last=ts; update(dt);draw(); requestAnimationFrame(loop); }
requestAnimationFrame(ts=>{last=ts;loop(ts);});
buildSettingsUI();
showMenu();
```

Replace with:
```js
let invLast=0;
function invLoop(ts){
  const dt=Math.min((ts-invLast)/1000,0.05); invLast=ts;
  // Only process when invader screen is active (saves CPU when hidden)
  if (document.getElementById('screen-invader').classList.contains('active')) {
    invUpdate(dt); invDraw();
  }
  requestAnimationFrame(invLoop);
}
requestAnimationFrame(ts=>{ invLast=ts; invLoop(ts); });
// Note: buildSettingsUI() and invShowMenu() are called from enterInvaderScreen()
```

(Also rename `update` → `invUpdate`, `draw` → `invDraw`, `loop` → `invLoop` throughout the invader block.)

- [ ] **Step 4: Verify no JS errors**

Open browser console. Expected: no errors on page load. Run:
```js
typeof invStartGame // Expected: "function"
typeof invState     // Expected: "string" (value: 'menu')
typeof state        // Expected: "object" (trainer state)
```

- [ ] **Step 5: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(invader): embed Space Invader JS with conflict renames"
```

---

## Task 8: enterInvaderScreen() + timer logic

**Files:**
- Modify: `1x1-trainer/index.html` (add new functions near the navigation section)

- [ ] **Step 1: Add `enterInvaderScreen()` function**

Add after the existing navigation functions (near `showScreen()`):

```js
// ── INVADER SCREEN ──────────────────────────────────────
let invaderTimerInterval = null;

function enterInvaderScreen() {
  if (state.stars <= 0 || state.streak < 3) return;

  // Deduct 1 star immediately on entry
  state.stars--;
  // If no active block, start a fresh 10-minute block
  if (state.gameSecondsLeft <= 0) {
    state.gameSecondsLeft = 600; // 10 minutes
  }
  saveState();
  updateHomeUI();

  // Show invader screen and init game
  showScreen('invader');
  buildSettingsUI();
  invStartGame();

  // Start the trainer's countdown timer
  startInvaderTimer();
}

function startInvaderTimer() {
  if (invaderTimerInterval) clearInterval(invaderTimerInterval);
  updateInvaderTimerDisplay();
  invaderTimerInterval = setInterval(() => {
    if (state.gameSecondsLeft > 0) {
      state.gameSecondsLeft--;
      saveState();
      updateInvaderTimerDisplay();

      if (state.gameSecondsLeft === 0) {
        // Block finished — auto-consume next star or end
        if (state.stars > 0) {
          state.stars--;
          state.gameSecondsLeft = 600;
          saveState();
          showToast('⭐ Nächster Stern! Noch 10 Minuten Spielzeit!');
        } else {
          // No more stars: end game session
          clearInterval(invaderTimerInterval);
          invaderTimerInterval = null;
          showToast('⏱ Zeit abgelaufen!');
          setTimeout(() => exitInvaderScreen(), 1500);
        }
      }
    }
  }, 1000);
}

function updateInvaderTimerDisplay() {
  const el = document.getElementById('invader-timer');
  if (!el) return;
  const m = Math.floor(state.gameSecondsLeft / 60);
  const s = state.gameSecondsLeft % 60;
  el.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
  if (state.gameSecondsLeft <= 120) {
    el.classList.add('warning');
  } else {
    el.classList.remove('warning');
  }
}
```

- [ ] **Step 2: Test in browser console**

```js
// Give test stars and a streak
state.stars = 2; state.streak = 5; state.gameSecondsLeft = 0;
saveState(); updateHomeUI();
// Click "Los!" button — invader screen should show
// Timer overlay should show "⏱ 10:00"
// state.stars should now be 1
console.log(state.stars); // Expected: 1
```

- [ ] **Step 3: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(invader): enterInvaderScreen + timer countdown logic"
```

---

## Task 9: exitInvaderScreen() + visibilitychange pause

**Files:**
- Modify: `1x1-trainer/index.html` (add to the invader screen section)

- [ ] **Step 1: Add `exitInvaderScreen()` function**

```js
function exitInvaderScreen() {
  // Stop timer
  if (invaderTimerInterval) {
    clearInterval(invaderTimerInterval);
    invaderTimerInterval = null;
  }
  // Reset invader to menu state (so next entry starts fresh)
  invShowMenu();
  // Return to home
  showScreen('home');
  updateHomeUI();
}
```

- [ ] **Step 2: Add visibilitychange handler**

Add this near the end of the script, before `// ── INIT ──`:

```js
// Pause invader timer when tab/app goes to background
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause: clear interval (state.gameSecondsLeft stays unchanged)
    if (invaderTimerInterval) {
      clearInterval(invaderTimerInterval);
      invaderTimerInterval = null;
    }
  } else {
    // Resume: only if invader screen is currently active
    if (document.getElementById('screen-invader').classList.contains('active')) {
      startInvaderTimer();
    }
  }
});
```

- [ ] **Step 3: Test exit flow**

```js
// Enter invader screen (assumes state.stars >= 1, streak >= 3)
enterInvaderScreen();
// Timer should count down
// Click ✕ button — should go back to home
// invaderTimerInterval should be null (cleared)
console.log(invaderTimerInterval); // Expected: null
```

- [ ] **Step 4: Test visibility pause**

Open the invader screen. Switch to another tab. Switch back. Timer should resume from where it was, not from a reset value.

- [ ] **Step 5: Commit**

```bash
git add 1x1-trainer/index.html
git commit -m "feat(invader): exitInvaderScreen + visibilitychange timer pause"
```

---

## Task 10: Redirect guard in space-invader-revibed/index.html

**Files:**
- Modify: `space-invader-revibed/index.html` (top of `<script>` block, line 185)

- [ ] **Step 1: Add redirect guard as first line of the `<script>` block**

Find the `<script>` opening tag at line ~184 in `space-invader-revibed/index.html`. Add as the very first line inside it:

```js
if (!window.__1x1trainer) { window.location.replace('../1x1-trainer/'); }
```

- [ ] **Step 2: Test redirect**

Open `http://localhost:8080/space-invader-revibed/` directly in browser.
Expected: immediately redirected to `http://localhost:8080/1x1-trainer/`.

- [ ] **Step 3: Test that trainer access still works**

Open `http://localhost:8080/1x1-trainer/`. Navigate to invader screen.
Expected: game works, no redirect loop.

- [ ] **Step 4: Commit**

```bash
git add space-invader-revibed/index.html
git commit -m "feat(invader): add redirect guard — only accessible via 1x1-trainer"
```

---

## Task 11: New App Icon (Node.js canvas script)

**Files:**
- Create: `scripts/package.json`
- Create: `scripts/generate-icons.js`
- Overwrite: `1x1-trainer/icon-192.png`, `1x1-trainer/icon-512.png`

- [ ] **Step 1: Create `scripts/package.json`**

```json
{
  "name": "1x1-trainer-scripts",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "icons": "node generate-icons.js"
  },
  "dependencies": {
    "canvas": "^2.11.2"
  }
}
```

- [ ] **Step 2: Create `scripts/generate-icons.js`**

```js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background: dark blue-violet with radial gradient
  const bg = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size*0.7);
  bg.addColorStop(0, '#1a1a4e');
  bg.addColorStop(1, '#0d0d2b');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  // Glow border: lila-blau #6C63FF
  ctx.strokeStyle = '#6C63FF';
  ctx.lineWidth = size * 0.025;
  ctx.shadowColor = '#6C63FF';
  ctx.shadowBlur = size * 0.04;
  ctx.beginPath();
  ctx.roundRect(size*0.025, size*0.025, size*0.95, size*0.95, size * 0.20);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // "1×1" text — bold white, centered
  const fontSize = size * 0.36;
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(108,99,255,0.6)';
  ctx.shadowBlur = size * 0.05;
  ctx.fillText('1×1', size / 2, size * 0.42);
  ctx.shadowBlur = 0;

  // Golden star below — smaller
  const starSize = size * 0.18;
  ctx.font = `${starSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⭐', size / 2, size * 0.72);

  return canvas;
}

const outDir = path.join(__dirname, '..', '1x1-trainer');

[192, 512].forEach(size => {
  const canvas = generateIcon(size);
  const buf = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ Generated ${outPath}`);
});
```

- [ ] **Step 3: Install and run**

```bash
cd scripts && npm install && npm run icons
```

Expected output:
```
✓ Generated .../1x1-trainer/icon-192.png
✓ Generated .../1x1-trainer/icon-512.png
```

- [ ] **Step 4: Verify icons**

Open the generated PNGs in Finder/Preview. Should show dark `#0d0d2b` background, `1×1` in white, gold star, purple glow border.

- [ ] **Step 5: Add `scripts/node_modules` to .gitignore**

```bash
echo "scripts/node_modules/" >> /Users/marco/dev/gaming/.gitignore
```

- [ ] **Step 6: Commit**

```bash
git add scripts/ 1x1-trainer/icon-192.png 1x1-trainer/icon-512.png .gitignore
git commit -m "feat: new app icon (1×1 + star, dark blue/violet) via Node.js canvas script"
```

---

## Task 12: Service Worker cache bump to v13

**Files:**
- Modify: `1x1-trainer/sw.js`

- [ ] **Step 1: Bump cache version**

In `1x1-trainer/sw.js`, change line 1:

```js
const CACHE = '1x1-trainer-v13';
```

(was `v12`)

- [ ] **Step 2: Verify SW updates in browser**

Open `http://localhost:8080/1x1-trainer/`. Open DevTools → Application → Service Workers. Click "Update". Confirm the new `v13` cache appears in Cache Storage.

- [ ] **Step 3: Commit**

```bash
git add 1x1-trainer/sw.js
git commit -m "feat(pwa): bump SW cache to v13 for stars/invader integration"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|---|---|
| XP → stars (progressive cost 400/600/900/1200, max 1/game) | Task 1, 2 |
| `state.stars` + `state.gameSecondsLeft` | Task 1 |
| Toast on star earn | Task 2 |
| Streak gate ≥ 3 days | Task 4, 8 |
| Spiele-Leiste 3 states (streak low / no stars / ready) | Task 3, 4 |
| Stars display (⭐ × n, total minutes) | Task 4 |
| 1 star deducted on entry, next star on new block | Task 8 |
| 10-minute blocks, auto-next-star or exit | Task 8 |
| gameSecondsLeft persists across sessions | Task 8 (saveState called) |
| Timer overlay top-right | Task 5 |
| Timer yellow→red under 2 min | Task 8 |
| Exit button (✕) top-left | Task 5, 9 |
| Timer pauses on visibilitychange | Task 9 |
| Space Invader embedded as screen-invader | Task 5, 6, 7 |
| JS conflict resolution (state, startGame, showMenu) | Task 7 |
| CSS conflict resolution (.btn → .inv-btn, scoped) | Task 5, 6 |
| window.__1x1trainer flag | Task 7 |
| Redirect guard in space-invader-revibed | Task 10 |
| New app icon (1×1 + star, dark blue, glow border) | Task 11 |
| SW cache v13 | Task 12 |

**Placeholder scan:** None found — all code blocks are complete.

**Type consistency:** `invState` string used consistently throughout invader block. `state.stars`/`state.gameSecondsLeft` are numbers, accessed uniformly across all tasks.
