# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. `AGENTS.md` is the identical file for other coding agents; keep both in sync.

## What this is

A mono-repo of HTML5 browser games built for a child named Henry (and a handful of other kids aged 8 to 11). All UI copy is in German. Games run directly in the browser from static files. There is no build step and no bundler; `npm install` is only needed for the test suite.

## Running games

Open any `index.html` directly in a browser, or serve the repo root locally:

```bash
python3 -m http.server 8080
# http://localhost:8080/1x1-trainer/   http://localhost:8080/knobel/   http://localhost:8080/jumpnrun/
```

The trainer embeds Knobelwerkstatt and Lumo via iframe, so serve from the repo root, not from a subdirectory.

## Tests

```bash
npm install                                  # once; installs Jest and Playwright
npx playwright install chromium firefox webkit   # once; browsers for the E2E projects
npm run test:unit      # Jest, tests/unit/*.test.js (pure logic, no browser)
npm run test:e2e       # Playwright, localhost only (own http.server on port 8080)
```

- Jest ignores `tests/e2e/` and `.worktrees/` via the `jest` block in `package.json`.
- The default E2E run reaches only localhost: `playwright.config.js` sends every other host to a closed proxy port, and `tests/e2e/netz-sperre.spec.js` checks that. `multiplayer.mocked.spec.js` uses `page.route` mocks.
- `tests/e2e/multiplayer.spec.js` writes to the real multiplayer backend and is skipped by default. Run it only on purpose and always with the file filter: `PW_PROD=1 npx playwright test multiplayer.spec` (without the filter the whole suite runs without the host lock).
- New features and bug fixes are developed test-first (red test, then the fix).

## Browser compatibility

We test by engine, not by browser brand. Three engines cover practically all browsers the kids use:

| Engine | Browsers | Playwright project |
|---|---|---|
| Blink | Chrome, Edge, Opera, Brave, Samsung Internet | `chromium` |
| Gecko | Firefox on desktop and Android | `firefox` |
| WebKit | Safari and every browser on iPhone and iPad (Apple requires WebKit; no other engine has shipped in the EU yet) | `webkit` |

- Every E2E spec runs in all three projects. Skip a test in one engine only for a tool limit, never for an app bug, and name the reason in `test.skip`. Known limits: Firefox cannot emulate `isMobile`; Playwright-Firefox sometimes hangs in `page.evaluate` while a service worker controls the page; CDP (`newCDPSession`) exists only in Chromium; Safari reaches buttons with Option+Tab instead of Tab. Open: `offline.spec.js` runs only in Chromium until the WebKit stall during the first service worker install under Playwright is understood; the device check covers offline on the iPhone meanwhile.
- Use only web features that are Baseline "widely available" (supported in all three engines for a while). Anything newer needs feature detection and a fallback, like `100dvh` with `100vh`.
- A bug that shows up in one browser first gets a failing test in that engine, then the fix.

### Device check before a release

Emulation does not cover browser toolbars, the home-screen app or real offline use. Before each release, serve the release candidate on the home-network test server and check on real devices: iPhone in Safari and in one other browser (Chrome or Firefox), the installed home-screen app including offline start, and desktop Firefox and Chrome. Add an Android device when one is available.

- Trainer, Knobelwerkstatt and Lumo open; a training round, a Blitz and one Lumo level can be played.
- Portrait and landscape: no cut-off dialogs, the start buttons are reachable.
- Home-screen app: starts offline (flight mode) and shows the update banner after a cache bump.
- Star time counts down and stops in pause; results come back to the trainer.

## Projects

| Directory | What it is |
|---|---|
| `1x1-trainer/` | Multiplication and division trainer (PWA, installable on iOS). Hosts the games bar with Space Invader, Lumo and Knobelwerkstatt. |
| `knobel/` | Knobelwerkstatt: number walls and calculation cages, 5 difficulty levels, own PWA and service worker. |
| `jumpnrun/` | Lumo: platformer with number crystals and calculating enemies (Rechenwichte), logic split into `jumpnrun/core/*.js`, own service worker. |
| `cloudflare/` | Multiplayer backend (Cloudflare Worker + D1 schema) for the trainer's challenge mode. |
| `prime-empire/` | Pac-man style top-down city game using **Phaser 3** (loaded from CDN). |
| `space-invader-revibed/` | Space shooter with touch controls. |
| `vibe-coding-demo-4-timm/` | Space Explorer canvas game. |
| `scripts/` | Helper scripts, e.g. icon generation. |

## Architecture

- `prime-empire/`, `space-invader-revibed/` and `vibe-coding-demo-4-timm/` are single `index.html` files with all CSS and JS inlined. Keep them that way.
- `1x1-trainer/` keeps the UI in `index.html` and the testable game logic in `logic.js` (Leitner scheduling, XP, state migrations, streak protection, multiplayer payloads). Pure functions go into `logic.js` so Jest can cover them.
- `knobel/` follows the same split (`index.html` + `knobel-logic.js`).
- `jumpnrun/` splits its logic into modules under `core/` (physics, collision, level generation, solver, rewards, tutorial, ...) that are loaded as plain scripts and also required by Jest.
- The trainer opens Knobelwerkstatt and Lumo in an iframe overlay and exchanges results via `postMessage`. Result messages are validated before XP is granted.
- `1x1-trainer/`, `knobel/` and `jumpnrun/` each have their own `sw.js`; `1x1-trainer/` and `knobel/` also ship a `manifest.json`.

## Releases and cache bumps

Each service worker precaches its files under a versioned cache name (`const CACHE = '...-vNN'` on line 1 of each `sw.js`). Installed PWAs only pick up changes after that name changes, so:

- Any change under `1x1-trainer/` → bump `1x1-trainer/sw.js` and keep `APP_VERSION` in `1x1-trainer/index.html` in step for user-facing releases.
- Any change under `knobel/` → bump `knobel/sw.js`. Any change under `jumpnrun/` → bump `jumpnrun/sw.js`.
- Changes to `jumpnrun/core/rewards.js` or `knobel/knobel-logic.js` are also precached by the trainer, so bump `1x1-trainer/sw.js` as well.
- Bump each cache once per release, not once per commit.
- Release notes live in the trainer's changelog modal; keep them child-friendly and short.

## 1x1-trainer internals

- **State** is persisted to `localStorage` under the key `henry_einmaleins`. `STATE_VERSION` and `STATE_MIGRATIONS` in `logic.js` upgrade older saves at startup.
- **Leitner system** drives question scheduling: questions move between boxes based on correct/wrong answers.
- **Audio** uses the Web Audio API (`AudioContext`) synthesized entirely in JS. There are no audio files.
- **Background** uses a `<canvas>` for twinkling stars, separate from the UI layer.
- **Games bar**: Space Invader and Lumo cost star time earned by training; Knobelwerkstatt is free with a daily XP cap.

## prime-empire internals

- Uses **Phaser 3** (`phaser@3.90.0` from CDN), the only browser project with an external runtime dependency.
- Map is a `ROWS × COLS` tile grid generated by `generateMap()`. `T_WALL=0`, `T_ROAD=1`, `T_GOAL=2`.
- AI companions and enemies move on the tile grid; `ROADBLOCKS` (module-level `Set`) tracks temporary blockages.
- Game concept: Ninjago "Prime Empire" audiobook. The player navigates a city street network with cooperative AI teammates.

## Mobile / iOS considerations

All games are designed for both desktop and iOS:
- Use `env(safe-area-inset-*)` for padding on notched devices (`knobel/` and `jumpnrun/` set `viewport-fit=cover`).
- Use `touch-action: none` plus custom touch handlers on game surfaces; scrollable sheets need `touch-action: pan-y`.
- Use `100dvh` (dynamic viewport height) alongside a `100vh` fallback.
- Keep the existing viewport meta tags (`user-scalable=no` is already set correctly).
- Every new game or mode needs a skippable hands-on tutorial and a "?" button with the rules, understandable by a child without an adult.

## Working rules for agents

- Never commit credentials, PINs or tokens. The repository is public.
- Never push to `main` without Marco's approval. Feature and work branches may go to `origin` after a scan for secrets, private paths, hostnames and IPs. Merge only after Marco has validated and given the signal.
- Develop on feature branches in worktrees under `.worktrees/` (ignored by Jest).
- A branch is reviewed by a second agent before Marco merges it; the review result goes into the night report.
