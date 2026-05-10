# Coding Conventions

**Analysis Date:** 2026-05-10

## Architecture: Single-File HTML

Every game is a self-contained `index.html` with all CSS and JS inlined. There are no separate `.js` or `.css` files, except:
- `1x1-trainer/logic.js` — pure functions extracted for Jest testability
- `1x1-trainer/sw.js` — service worker
- `1x1-trainer/manifest.json` — PWA manifest

**Rule:** When adding features, keep all code inside the single `index.html`. Only extract to `logic.js` when writing a pure, side-effect-free function that needs Jest unit testing.

## Naming Patterns

**Files:**
- Game entry points: `index.html` (one per game directory)
- Extracted logic: `logic.js` (only 1x1-trainer; filename is literal)

**JavaScript Functions:**
- `camelCase` for all function and method names: `showScreen`, `saveName`, `updateHomeUI`, `pickBlitzReihe`, `addBlitzListeEntry`
- Phaser scene subclasses: `PascalCase` class names (`BootScene`, `GameScene`, `GameOverScene`, `WinScene`)
- Entity subclasses: `PascalCase` (`Entity`, `Player`, `Enemy`, `Teammate`, `Roadblock`)

**JavaScript Variables:**
- `camelCase` for mutable module-level vars: `let state`, `let trainedSet`, `let audioCtx`
- `UPPER_SNAKE_CASE` for constants and config: `STAR_COSTS`, `LEVELS`, `ACHIEVEMENTS`, `T_WALL`, `T_ROAD`, `TILE`, `COLS`, `ROWS`, `DIRS`, `ROT_MAP`
- Short single-letter vars acceptable in tight loops: `s`, `c`, `r`, `n`, `g`, `d`, `dt`

**German-language identifiers:**
- Domain variables use German words: `blitzConfig`, `reihen`, `rechenart`, `alleReihen`, `gemischt`, `trainedSet`, `reiheStats`
- Migration functions: `migrateBlitzState`, `migrateDivState`
- State keys use German: `highScores.blitzListe`, `blitzDiv`, `blitzGemischt`, `turnierDiv`, `turnierGemischt`
- This is intentional. New code should continue using German for domain concepts.

**CSS Classes:**
- `kebab-case`: `.mode-card`, `.btn-primary`, `.stats-row`, `.level-card`, `.reihe-btn`, `.blitz-reihe-btn`, `.rechenart-btn`
- BEM-like suffixes for state: `.mode-card.blitz`, `.reihe-btn.selected`, `.reihe-btn.red`, `.game-timer.warning`, `.modal-overlay.active`

**HTML IDs:**
- `kebab-case`: `#screen-home`, `#screen-name`, `#bg-canvas`, `#blitz-modal`, `#blitz-start-btn`
- Screen IDs follow pattern `#screen-{name}`: `#screen-home`, `#screen-name`, `#screen-blitz-highscores`

## Code Style

**Formatting:**
- No formatter enforced. Hot paths and canvas draw code use tightly packed one-liners:
  ```js
  function playCorrect() { tone(523,.08); setTimeout(()=>tone(659,.08),70); setTimeout(()=>tone(784,.15),140); }
  if(this.frozen){this.freezeMs-=delta;if(this.freezeMs<=0)this._unfreeze();}
  ```
- Readable multi-line style for main logic, settings, state management:
  ```js
  function getLevelInfo(xp) {
    let lvl = 0;
    for (let i = LEVELS.length - 1; i >= 0; i--) { if (xp >= LEVELS[i].xp) { lvl = i; break; } }
    const cur = LEVELS[lvl], nxt = LEVELS[lvl + 1] || null;
    ...
  }
  ```
- Mixing both styles within a file is normal — match the density of surrounding code.

**Linting:** No ESLint or Prettier config present.

## Section Headers

Two levels in use across all game files:

**Major sections:**
```js
// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
```

**Minor/subsections:**
```js
// ── NAVIGATION ─────────────────────────────────────────
// ── Audio ─────────────────────────────────────────────────────
// ── STATE ──────────────────────────────────────────────
```

Use these exact header styles for new logical sections.

## Event Handlers

**Pattern:** Inline `onclick="fn()"` attributes in HTML, not `addEventListener`. Pervasive across `1x1-trainer/index.html`:

```html
<button class="btn btn-primary" onclick="saveName()">Los geht's! ▶</button>
<button class="btn-icon" onclick="showScreen('settings')">⚙️</button>
<div class="mode-card blitz" onclick="showBlitzPicker()">
```

Do not introduce `addEventListener` for new UI elements in these files — use `onclick="fn()"` to match existing style.

## State Management

**Pattern:** A single `state` object loaded from `localStorage` at startup and persisted on every mutation.

```js
let state = (() => {
  try {
    const raw = localStorage.getItem('henry_einmaleins');
    return migrateState(raw ? JSON.parse(raw) : defaultState());
  } catch { return defaultState(); }
})();

function saveState() {
  try { localStorage.setItem('henry_einmaleins', JSON.stringify(state)); } catch {}
}
```

**Storage keys:** `henry_einmaleins` (1x1-trainer), `sb_settings` / `hiscores_*` (space-invader-revibed)

## State Versioning and Migration

**Always use this pattern when adding new state fields to 1x1-trainer:**

1. Increment `STATE_VERSION` constant (`1x1-trainer/index.html:976`)
2. Also increment `APP_VERSION` display string (`1x1-trainer/index.html:975`)
3. Also increment the cache name in `1x1-trainer/sw.js` line 1 (`CACHE = '1x1-trainer-v{N}'`)
4. Append a new migration function to `STATE_MIGRATIONS` array — never edit existing migrations:

```js
// v3 → v4: New feature fields
(s) => {
  if (!s.newFeature) s.newFeature = defaultValue;
  return s;
},
```

Pure migration logic should be extracted to `1x1-trainer/logic.js` so it can be unit tested.

## Error Handling

**Pattern:** Silent `try/catch` for browser APIs that may fail:

```js
// localStorage writes
try { localStorage.setItem('henry_einmaleins', JSON.stringify(state)); } catch {}

// localStorage reads — fallback to empty value
try { return JSON.parse(localStorage.getItem(hsKey(d)) || '[]'); } catch { return []; }

// AudioContext — lazy init with silent failure
if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
```

No custom error types. No `console.error`. Errors swallowed silently — games degrade gracefully.

## Mobile / iOS Patterns

All games must follow these mobile-first conventions:

```css
/* Dynamic viewport height — always both */
min-height: 100vh;
min-height: 100dvh;

/* Safe area insets for notched devices */
padding-bottom: calc(14px + env(safe-area-inset-bottom));

/* Prevent scroll interference on touch zones */
touch-action: none;         /* full blocking */
touch-action: manipulation; /* tap-only, no zoom */

/* Disable iOS tap highlight */
-webkit-tap-highlight-color: transparent;
```

Canvas games set `touch-action: none` on `body`. The 1x1-trainer uses scoped `touch-action` on individual interactive elements.

## Pure Function Rule

Functions in `1x1-trainer/logic.js` must be:
- Free of DOM access
- Free of `localStorage` access
- Free of global variable reads/writes
- Deterministic (or explicitly randomized with no side effects)

```js
// Pure functions — kein DOM, kein localStorage, keine Globals
if (typeof module !== 'undefined') {
  module.exports = { pickBlitzReihe, addBlitzListeEntry, migrateBlitzState,
                     resolveRechenart, migrateDivState };
}
```

Use this dual-environment guard for any new function exported from `logic.js`.

## Comments

- Section headers required for every logical group of functions
- Inline comments for non-obvious logic, especially map geometry
- State migration block comments: `// v2 → v3: blitzConfig + blitzListe`
- No JSDoc/TSDoc. No function-level doc comments.
