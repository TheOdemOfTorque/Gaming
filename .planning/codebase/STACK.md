# Technology Stack

**Analysis Date:** 2026-05-10

## Languages

**Primary:**
- HTML5 — All game UIs: single `index.html` files with all CSS and JS inlined
- JavaScript (ES2020+) — Game logic, browser APIs, Phaser scripting; no transpilation
- CSS3 — Inlined in each `index.html`; uses modern features: `100dvh`, `env(safe-area-inset-*)`, `backdrop-filter`

**Secondary:**
- Node.js — Build-time only (icon generation script, test runner); not used at runtime

## Runtime

**Environment:**
- Browser (target: desktop Chrome/Safari + iOS Safari)
- No server-side runtime required for games themselves
- Local development: `python3 -m http.server 8080` from repo root

**Package Manager:**
- npm — Root `package.json` for test tooling only
- Lockfile: `package-lock.json` present at repo root
- Scripts subdirectory has its own `scripts/package.json` + `scripts/package-lock.json` for icon generation

## Frameworks

**Core:**
- None — `1x1-trainer/`, `space-invader-revibed/`, `vibe-coding-demo-4-timm/` use raw browser Canvas 2D API
- Phaser 3 (`phaser@3.90.0`) — Only used by `prime-empire/`; loaded via CDN `https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js`

**Testing:**
- Jest `^30.3.0` (installed: `30.3.0`) — Unit tests; runs via `npm test` or `npm run test:unit`
- Playwright `^1.59.1` (installed: `1.59.1`) — E2E tests; runs via `npm run test:e2e`

**Build/Dev:**
- `canvas` npm package (`^2.11.2`) — Node.js Canvas implementation for icon generation script only (`scripts/generate-icons.js`)
- No bundler, no transpiler, no build step for games

## Key Dependencies

**Critical:**
- Phaser 3 `3.90.0` — Game engine for `prime-empire/index.html`; loaded from CDN (no local install); pinned exact version in the `<script>` tag

**Infrastructure:**
- `@playwright/test` `1.59.1` (devDependency) — E2E testing across `tests/e2e/`
- `jest` `30.3.0` (devDependency) — Unit testing for logic extracted to `1x1-trainer/logic.js`
- `canvas` `^2.11.2` (scripts subdirectory) — Icon PNG generation only; never in game code

## Configuration

**Environment:**
- No environment variables required
- No `.env` files exist in this repo
- Games are fully self-contained static files

**Build:**
- `playwright.config.js` — Playwright E2E config; `testDir: ./tests/e2e`, `baseURL: http://localhost:8080`, `viewport: 390×844` (iPhone), serves from `.worktrees/feature-division`
- No `jest.config.*` file — Jest uses defaults from `package.json` scripts
- `scripts/package.json` — Separate manifest for icon generation; run with `npm run icons` from `scripts/`

## PWA Configuration (1x1-trainer only)

**Service Worker:**
- `1x1-trainer/sw.js` — Cache-first strategy; cache name `1x1-trainer-v18` (incremented per release)
- Assets cached: `./`, `./index.html`, `./manifest.json`, `./icon-192.png`, `./icon-512.png`, `./logic.js`

**Web App Manifest:**
- `1x1-trainer/manifest.json` — `display: standalone`, `orientation: portrait`, `lang: de`, `background_color: #0d0d2b`
- Icons: `icon-192.png` (192×192) and `icon-512.png` (512×512), both purpose `any maskable`

**App Version:**
- `APP_VERSION = '2.3'` defined in `1x1-trainer/index.html` line 975
- `STATE_VERSION = 4` tracks localStorage schema version for migrations

## Platform Requirements

**Development:**
- Python 3 (for `python3 -m http.server`)
- Node.js + npm (for running tests and icon generation)
- Modern browser

**Production:**
- Any static file host — no server-side logic needed
- Games run directly from `index.html` opened in a browser or served from any HTTP server

---

*Stack analysis: 2026-05-10*
