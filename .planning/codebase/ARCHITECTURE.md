<!-- refreshed: 2026-05-10 -->
# Architecture

**Analysis Date:** 2026-05-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (no build step)                       │
├──────────────────┬───────────────┬───────────────┬──────────────────┤
│   1x1-trainer/   │ prime-empire/ │space-invader- │vibe-coding-demo- │
│  `index.html`    │ `index.html`  │ revibed/      │ 4-timm/          │
│  `logic.js`      │               │ `index.html`  │ `index.html`     │
│  `sw.js`         │               │               │                  │
│  `manifest.json` │               │               │                  │
└──────┬───────────┴───────┬───────┴───────────────┴──────────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐   ┌────────────────────┐
│ localStorage│   │ Phaser 3 (CDN)     │
│henry_einmal-│   │ phaser@3.90.0      │
│   eins      │   │ cdn.jsdelivr.net   │
└─────────────┘   └────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| 1x1-trainer HTML/CSS | All UI screens, modals, animations, touch controls | `1x1-trainer/index.html` |
| 1x1-trainer JS (inline) | State machine, game modes, audio, XP/leveling, Leitner scheduler | `1x1-trainer/index.html` (lines ~880–3325) |
| logic.js | Pure functions for blitz/division logic — no DOM, no globals, testable | `1x1-trainer/logic.js` |
| Service Worker | Cache-first offline support, asset caching by version string | `1x1-trainer/sw.js` |
| PWA Manifest | iOS/Android installability, icons, display mode | `1x1-trainer/manifest.json` |
| prime-empire HTML | Single Phaser 3 host div, loads CDN script | `prime-empire/index.html` (lines 1–16) |
| prime-empire JS (inline) | Map generation, Entity/Player/Enemy/Teammate/Roadblock classes, Phaser Scenes | `prime-empire/index.html` (lines 17–855) |
| space-invader JS (inline) | Canvas 2D game loop, touch joystick, highscores in localStorage | `space-invader-revibed/index.html` |
| vibe-coding-demo JS (inline) | Canvas 2D space shooter, settings modal | `vibe-coding-demo-4-timm/index.html` |

## Pattern Overview

**Overall:** Single-file HTML game pattern (all CSS + JS inlined per game)

**Key Characteristics:**
- Zero build step — files opened directly in browser or served via `python3 -m http.server`
- No bundler, no transpiler, no package manager for games themselves
- Each `index.html` is self-contained: CSS in `<style>`, JS in `<script>` at bottom of `<body>`
- The only external runtime dependency is Phaser 3 in `prime-empire/`, loaded from CDN
- `package.json` at root is for dev tooling only (Playwright E2E + Jest unit tests)

## Layers

**Presentation Layer:**
- Purpose: HTML structure + CSS (screens, cards, buttons, modals, canvases)
- Location: `<style>` block inside each game's `index.html`
- Contains: Layout, animation keyframes, component styles, responsive/mobile rules
- Depends on: Nothing external (no CSS frameworks)
- Used by: JS layer via DOM IDs

**Game Logic Layer:**
- Purpose: All game-specific JavaScript
- Location: `<script>` block at end of each game's `index.html` (exception: `1x1-trainer/logic.js`)
- Contains: State machines, game loops, entity classes, audio synthesis, scoring
- Depends on: Browser APIs (Web Audio, localStorage, Canvas 2D, requestAnimationFrame), Phaser 3 (prime-empire only)
- Used by: Nothing external

**Pure Logic Module (1x1-trainer only):**
- Purpose: Testable pure functions extracted from inline JS
- Location: `1x1-trainer/logic.js`
- Contains: `pickBlitzReihe`, `addBlitzListeEntry`, `migrateBlitzState`, `resolveRechenart`, `migrateDivState`
- Depends on: Nothing (no DOM, no globals)
- Used by: `1x1-trainer/index.html` (loaded via `<script src="logic.js">`), unit tests

**Persistence Layer:**
- Purpose: Persisting player progress across sessions
- Location: `localStorage` key `henry_einmaleins` (1x1-trainer); `localStorage` key `invaderHS` (space-invader-revibed, inferred)
- Contains: Serialized JSON state objects with versioned migrations
- Depends on: Browser localStorage API

**Service Worker (1x1-trainer only):**
- Purpose: Offline capability, cache-first asset serving, PWA update control
- Location: `1x1-trainer/sw.js`
- Contains: Install/activate/fetch lifecycle handlers, cache version `1x1-trainer-v18`
- Depends on: Cache Storage API

## Data Flow

### 1x1-trainer: Primary Answer Flow

1. User taps answer button or submits typed answer in `#choices-grid` / `#type-answer-input` (`1x1-trainer/index.html`)
2. `checkAnswer(selectedVal)` validates against `state.currentQuestion.answer`
3. XP awarded, `state.xp`, `state.totalCorrect`, `state.streak`, combo counter updated
4. `saveState()` serializes `state` to `localStorage.setItem('henry_einmaleins', JSON.stringify(...))`
5. `nextQuestion()` applies Leitner-style question scheduling, draws next question to DOM
6. Achievement checks run; confetti/toast/audio feedback triggered

### 1x1-trainer: App Startup / State Load

1. Browser loads `1x1-trainer/index.html`; `sw.js` registered as service worker
2. `logic.js` loaded before inline `<script>`
3. `loadState()` reads `henry_einmaleins` from localStorage
4. State migrations run sequentially: v0→v1→v2→v3→v4 via `STATE_MIGRATIONS` array
5. `initStars()` starts canvas star animation via `requestAnimationFrame`
6. `showScreen('home')` renders home screen

### prime-empire: Game Loop

1. Browser loads CDN Phaser script (`phaser@3.90.0`)
2. `new Phaser.Game(...)` instantiates with scenes: `[BootScene, GameScene, GameOverScene, WinScene]`
3. `BootScene.create()` renders title screen, waits for keydown/pointerdown
4. `GameScene.create()`: `generateMap()` builds tile grid → `_drawMap()` renders graphics → entities instantiated (`Player`, 5×`Enemy`, 4×`Teammate`)
5. `GameScene.update(time, delta)`: reads keyboard/D-pad input → calls `entity.update(delta)` on all entities → BFS pathfinding for enemies/teammates → `_checkCollisions()` → `_checkWin()`
6. Win/loss transitions to `WinScene` or `GameOverScene` via `this.scene.start()`

**State Management:**
- 1x1-trainer: Single mutable `state` object in module scope; persisted to localStorage via `saveState()` on every significant event
- prime-empire: No persistence; game state is in-memory Phaser scene properties; module-level `ROADBLOCKS` Set shared across entities
- space-invader-revibed: Highscores persisted to localStorage; game state in-memory canvas globals
- vibe-coding-demo-4-timm: No persistence; pure in-memory canvas state

## Key Abstractions

**Phaser Scene (prime-empire):**
- Purpose: Each screen/phase of the game is a `Phaser.Scene` subclass
- Examples: `BootScene`, `GameScene`, `GameOverScene`, `WinScene` — all in `prime-empire/index.html`
- Pattern: Constructor calls `super('SceneName')`, then `create()` builds world, `update(time, delta)` runs each frame

**Entity Base Class (prime-empire):**
- Purpose: Shared movement, freeze/invincibility state, sprite rendering for all moving actors
- Location: `Entity` class, `prime-empire/index.html` lines ~191–267
- Pattern: `Player`, `Enemy`, `Teammate` extend `Entity`; each overrides `update(delta, ...)` and `_decide()`

**State + Migration (1x1-trainer):**
- Purpose: Versioned, forward-migrated player state persisted to localStorage
- Location: `defaultState()`, `STATE_VERSION`, `STATE_MIGRATIONS` array — `1x1-trainer/index.html` lines ~955–1050
- Pattern: `STATE_VERSION` integer incremented; `STATE_MIGRATIONS[i]` is a function `(s) => s` that adds missing fields for that version

**Leitner Scheduler (1x1-trainer):**
- Purpose: Spaced-repetition question scheduling — questions move between boxes based on correct/wrong answers
- Location: Inline JS in `1x1-trainer/index.html`
- Pattern: Each multiplication/division fact tracks box number; wrong answers regress, correct advance

**Screen Router (1x1-trainer):**
- Purpose: Single-page screen navigation without a router library
- Location: Inline JS in `1x1-trainer/index.html`
- Pattern: `showScreen(id)` sets `.active` class on `.screen` divs; all screens share the same DOM

## Entry Points

**1x1-trainer:**
- Location: `1x1-trainer/index.html`
- Triggers: Browser loads URL; or PWA launch from home screen icon
- Responsibilities: Registers service worker, loads `logic.js`, initializes state, renders home screen

**prime-empire:**
- Location: `prime-empire/index.html`
- Triggers: Browser loads URL
- Responsibilities: Loads Phaser 3 from CDN, instantiates `Phaser.Game` which starts `BootScene`

**space-invader-revibed:**
- Location: `space-invader-revibed/index.html`
- Triggers: Browser loads URL
- Responsibilities: Sets up canvas, game loop, touch controls

**vibe-coding-demo-4-timm:**
- Location: `vibe-coding-demo-4-timm/index.html`
- Triggers: Browser loads URL
- Responsibilities: Sets up canvas, space explorer game loop, settings modal

## Architectural Constraints

- **No build step:** All JS/CSS must work as written — no TypeScript, no JSX, no module bundlers
- **Single-file constraint:** Except for `1x1-trainer/` (which has `logic.js`, `sw.js`, `manifest.json`, icons), every game is strictly one `index.html` file
- **Global state:** 1x1-trainer uses a module-level `state` object and `trainedSet` Set; prime-empire uses module-level `ROADBLOCKS` Set and `MAP` array. All game globals exist in browser's window scope
- **Circular imports:** Not applicable — no module system used
- **CDN dependency:** prime-empire will fail without internet access (or cached CDN response) — `https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js`
- **iOS mobile:** All games use `touch-action: none`, `env(safe-area-inset-*)`, `100dvh`, custom touch handlers

## Anti-Patterns

### Inline everything

**What happens:** All JS and CSS in every game is in one `index.html` file
**Why it's wrong:** Becomes unwieldy for complex games (1x1-trainer is 3,325 lines); hard to test DOM-coupled JS directly
**Do this instead:** Extract pure logic to separate `.js` files (as done with `1x1-trainer/logic.js`) and reference via `<script src="...">`. Keep DOM-coupled code inline only when it cannot be extracted without significant refactor

### Module-level mutable shared state (prime-empire)

**What happens:** `ROADBLOCKS` is a module-level `let` Set that is mutated by `Roadblock` instances and read by `isWalkable()`
**Why it's wrong:** `ROADBLOCKS` must be manually reset on game restart (`ROADBLOCKS = new Set()` in `GameScene.create()`); forgetting this causes cross-game-session bugs
**Do this instead:** Encapsulate roadblock tracking inside `GameScene` and pass it to entities that need it

## Error Handling

**Strategy:** Silent fail with try/catch on localStorage and AudioContext operations

**Patterns:**
- `saveState()` wraps `localStorage.setItem(...)` in `try { } catch {}` — storage quota errors silently ignored
- `getCtx()` wraps `AudioContext` creation in `try { } catch {}` — audio failure silently ignored
- No error boundaries or user-visible error messages for runtime failures

## Cross-Cutting Concerns

**Logging:** No logging framework; no `console.log` calls in production code
**Validation:** Input validation is implicit (answer comparison via `===`, tile bounds checked in `isWalkable()`)
**Authentication:** None — games are single-user, named "Henry", no auth layer

---

*Architecture analysis: 2026-05-10*
