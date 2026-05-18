# Technical Concerns

**Analysis Date:** 2026-05-10

## Tech Debt

**1. `logic.js` duplicated in `index.html`** (`1x1-trainer`)
`pickBlitzReihe` and `resolveRechenart` exist in both `1x1-trainer/logic.js` and `1x1-trainer/index.html` (lines ~1777, 1783). Two copies can silently diverge. Fix: load via `<script src="logic.js">` or delete the inline copies.

**2. `logic.js` cached by SW but never loaded by HTML**
`1x1-trainer/sw.js` line 8 caches `./logic.js` but `index.html` has no `<script src="logic.js">` — dead cache entry on every PWA install.

**3. Magic number `20` for `MAX_REIHE` in 8+ places**
`1x1-trainer/index.html` lines 942, 948, 990–994, 1021, 1314, 1331, 1735, 2149 and `logic.js` line 42. `logic.js` has a comment "sync mit index.html". Extract a named constant.

**4. `vibe-coding-demo-4-timm` game loop has no delta-time**
`loop()` advances state by fixed amounts — speed is frame-rate-dependent (120 Hz vs 60 Hz).

**5. prime-empire is only Abschnitt 1**
`WinScene` teases "Abschnitt 2" (line ~840) — unreachable placeholder text.

## Known Bugs

**6. Phaser `GameScene` missing `shutdown()` lifecycle**
When `scene.start('GameScene')` restarts on loss/win, `Roadblock` timer events (`this.time.addEvent`) from the previous scene are not explicitly cleaned up. Old timers keep firing. Fix: add `shutdown()` method with `this.time.removeAllEvents()`.

**7. Streak uses `Date.toDateString()` — locale/timezone-sensitive**
`1x1-trainer/index.html` lines ~1430–1431, 2050–2051, 3231, 3237. A locale change or DST edge can break streak comparisons. Fix: use `toISOString().slice(0,10)`.

**8. `space-invader-revibed` AudioContext created without user-gesture guard**
Line ~2368: on iOS Safari the context is suspended and `resume()` silently fails, muting all audio. `1x1-trainer` handles this correctly (lazy init pattern).

## CDN / External Dependencies at Risk

**9. Phaser 3.90.0 from jsDelivr** (`prime-empire/index.html` line 16)
CDN outage = blank page, no error shown to player. No local fallback, no `onerror` handler.

**10. Google Fonts from `fonts.googleapis.com`** (`vibe-coding-demo-4-timm/index.html` line 8)
No `sans-serif` fallback in font-family declarations.

## Performance

**11. BFS runs on every AI decision tick** (`prime-empire/index.html` lines 107–126)
Full 986-cell BFS for up to 9 entities per frame, no path caching, no A*. On mobile this may cause frame drops.

**12. `_drawMap()` re-renders full 17×58 grid on every game restart** (line ~510)
Map is static — should be rendered once to a Phaser `RenderTexture`.

**13. `1x1-trainer/index.html` is 155 KB / 3,325 lines**
Entire app inlined. No chunking possible without a build step.

## Fragile Areas

**14. Map spawn coordinates hardcoded** (`prime-empire/index.html` lines 484–495)
Enemy/teammate spawns are raw `(col, row)` pairs. Any map change can silently place spawns on walls. `_buildPatrol()` silently degrades to a 1-point loop rather than throwing.

**15. SW cache version requires manual sync**
`1x1-trainer/sw.js` line 1 (`1x1-trainer-v18`) and `index.html` line 975 (`APP_VERSION = '2.3'`) must be bumped together manually. No automated check. Mismatch = stale PWA for all installed users indefinitely.

**16. `ROADBLOCKS` is a module-level `let`** (`prime-empire/index.html` lines 29, 389, 420, 473)
Reassigned in `GameScene.create()` but `Roadblock.destroy()` is not called on old instances before reassignment. Old instances still hold a reference to the discarded `Set`.

**17. `playwright.config.js` webServer path is stale**
Still points to `.worktrees/feature-division` which no longer exists. E2E tests will fail to start. Fix: update `webServer.command` to point to the gaming repo root.

## Missing Critical Features

**18. No score persistence in prime-empire**
Completion time shown in `WinScene` but never saved to localStorage.

**19. No error feedback if Phaser CDN fails**
Player sees a blank page with no explanation.

**20. No `prefers-reduced-motion` check**
Confetti animations fire unconditionally (`1x1-trainer/index.html` line ~1119). Accessibility gap.

## Test Coverage Gaps

**21. State migration safety**
Highest-risk gap: a bug in any migration causes `catch { return defaultState(); }` at line ~1044 to silently wipe the child's entire progress. Migration logic in `logic.js` has partial coverage (v3→v4 only).

**22. No tests for prime-empire, space-invader, or vibe-coding-demo**
Phaser and canvas games have zero automated coverage of any kind.

**23. Service worker not tested**
Cache versioning, install/activate lifecycle, and offline behaviour untested.
