# Directory Structure

**Analysis Date:** 2026-05-10

## Repository Layout

```
/Users/marco/dev/gaming/          ← Git root / mono-repo root
├── CLAUDE.md                     ← AI assistant instructions (repo-wide)
├── README.md                     ← Project overview
├── package.json                  ← Root package: Jest + Playwright scripts
├── package-lock.json
├── playwright.config.js          ← E2E test config (port 8080, iPhone viewport)
│
├── 1x1-trainer/                  ← Multiplication-table PWA trainer
│   ├── index.html                ← Entire app (3,325 lines, all CSS+JS inlined)
│   ├── logic.js                  ← Extracted pure functions (testable via Jest)
│   ├── sw.js                     ← Service worker (cache versioned: 1x1-trainer-v18)
│   ├── manifest.json             ← PWA manifest (name, icons, display: standalone)
│   ├── icon-192.png              ← PWA icon
│   └── icon-512.png              ← PWA icon (maskable)
│
├── prime-empire/                 ← Pac-man–style city game (Phaser 3)
│   ├── index.html                ← Entire game (Phaser scenes, tile map, AI)
│   └── notes.md                  ← Developer notes / brainstorming
│
├── space-invader-revibed/
│   └── index.html                ← Space shooter (canvas, touch controls)
│
├── vibe-coding-demo-4-timm/
│   ├── index.html                ← Space Explorer canvas game
│   └── index.html~               ← Editor backup (safe to delete)
│
├── tests/                        ← All automated tests (root-level, not per-game)
│   ├── unit/
│   │   ├── blitz-logic.test.js   ← Jest: pickBlitzReihe, addBlitzListeEntry, migrateBlitzState
│   │   └── division-logic.test.js← Jest: resolveRechenart, migrateDivState
│   └── e2e/
│       ├── blitz.spec.js         ← Playwright: Blitz-Modus picker flows
│       └── division.spec.js      ← Playwright: Rechenart-Toggle flows
│
├── scripts/
│   ├── generate-icons.js         ← One-off script: generate PWA icon PNGs
│   ├── package.json              ← scripts/ sub-package (sharp dependency)
│   └── package-lock.json
│
├── docs/
│   └── superpowers/
│       ├── plans/                ← Feature design docs (e.g. multiplayer backend)
│       └── specs/                ← Feature specs
│
├── .planning/                    ← GSD planning artifacts (not committed)
│   └── codebase/                 ← This codebase map
│
├── node_modules/                 ← Root: jest, playwright, @playwright/test
├── test-results/                 ← Playwright output (auto-generated)
└── .git/
```

## Key File Locations

| What | Where |
|------|-------|
| 1x1-trainer app entry | `1x1-trainer/index.html` |
| 1x1-trainer pure logic (testable) | `1x1-trainer/logic.js` |
| Service worker cache version | `1x1-trainer/sw.js` line 1 |
| App version + state version | `1x1-trainer/index.html` lines 975–976 |
| State migration array | `1x1-trainer/index.html` `STATE_MIGRATIONS` |
| prime-empire game entry | `prime-empire/index.html` |
| Phaser CDN import | `prime-empire/index.html` line 16 |
| Tile map generator | `prime-empire/index.html` `generateMap()` |
| AI BFS pathfinder | `prime-empire/index.html` `bfsPath()` lines 107–126 |
| Entity base class | `prime-empire/index.html` `class Entity` |
| Jest config | `package.json` `jest` key |
| Playwright config | `playwright.config.js` |
| Unit tests | `tests/unit/*.test.js` |
| E2E tests | `tests/e2e/*.spec.js` |

## Naming Conventions

**Directories:** lowercase, hyphen-separated (`1x1-trainer`, `space-invader-revibed`, `vibe-coding-demo-4-timm`).

**Game files:** always `index.html` — one per game, no numeric suffixes.

**Test files:**
- Unit: `{feature}-logic.test.js`
- E2E: `{feature}.spec.js`

**No per-game subdirectories** beyond the flat single-file structure. If a game needs an image or JSON resource, it lives directly in the game's root directory alongside `index.html`.

## Where to Add New Code

| Scenario | Location |
|----------|----------|
| New game mode or screen in 1x1-trainer | Inside `1x1-trainer/index.html` (inline) |
| New pure business logic for 1x1-trainer | Extract to `1x1-trainer/logic.js` + `module.exports` |
| New unit test | `tests/unit/{area}-logic.test.js` |
| New E2E test | `tests/e2e/{feature}.spec.js` |
| New Phaser scene | Inside `prime-empire/index.html` as a new `class XxxScene extends Phaser.Scene` |
| New entity type in prime-empire | Inside `prime-empire/index.html` as a new class extending `Entity` |
| New game (whole new project) | New top-level directory with its own `index.html` |
| One-off utility scripts | `scripts/` with its own `package.json` if new deps needed |
| PWA icons (regenerate) | Run `node scripts/generate-icons.js` |

## Special Directories

**`.worktrees/`** — Git worktrees for parallel feature branches. Created by `git worktree add`. The `playwright.config.js` currently still references `.worktrees/feature-division` (stale — that branch was merged). Update the `webServer.command` path before running E2E tests.

**`.planning/`** — GSD workflow artifacts. Not committed (add to `.gitignore` if not already). Contains `codebase/`, `phases/`, `STATE.md`, `ROADMAP.md`, etc.

**`node_modules/`** — Root-level only. No per-game `node_modules`. Games have no npm dependencies — all browser deps come from CDN.

**`test-results/`** — Playwright output (screenshots, traces on failure). Auto-generated, not committed.
