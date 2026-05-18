# Domain Pitfalls: Prime Empire – Phaser 3 Single-File Extension

**Domain:** Brownfield Phaser 3 browser game (children's, iOS-first, no build step)
**Researched:** 2026-05-10
**Overall confidence:** HIGH (code-verified bugs) / MEDIUM (iOS/audio, verified against known patterns)

---

## Critical Pitfalls

These are current bugs or near-certain failure modes that will block milestone delivery.

---

### C1: Freeze-Invincible Re-Collision Loop (the "stuck entity" bug)

**What goes wrong:** After `_unfreeze()`, entities gain 3000ms invincibility. Collision check skips invincible entities. But nothing moves the entities apart. When invincibility expires, the next frame re-triggers the collision handler, re-freezes, and the cycle repeats indefinitely.

**Root cause:** `_decide()` can enter a stuck loop when `_buildPatrol` returns a single-point patrol (BFS from col,row to col,row returns null). The freeze system models state on timers but has no spatial separation guarantee.

**Warning signs:** Any entity that remains visually overlapping after the blink animation ends.

**Prevention:**
- On `_unfreeze()`, call a `_separateTo(safeNeighbor)` helper that picks the nearest walkable tile not occupied by any other entity and snaps `col/row/tCol/tRow` + sprite position simultaneously.
- In teammate `_decide`, guard the `raw.c===this.col && raw.r===this.row` case and pick an alternate escape tile.
- Reset `thinkDelay=0` in `_unfreeze()` to force immediate re-pathfinding.
- If still overlapping after 1500ms of invincibility, force-separate.

**Phase:** Freeze-Bug fix (active requirement, highest priority)

---

### C2: Mid-Transit Position Desync After Freeze

**What goes wrong:** `freeze()` sets `this.moving=false` without snapping sprite or resetting `tCol/tRow`. When frozen mid-movement, sprite sits between tiles. After `_unfreeze()`, `_decide` picks a neighbor of the logical `(col, row)` (which was the departure tile, not the mid-point). Entity visually slides through walls.

**Warning signs:** Entities appear to pass through building tiles after recovering from freeze.

**Prevention:** In `freeze()`, before setting `moving=false`: if `moving` is true, snap `col=tCol; row=tRow; sprite.x=tc(tCol,tRow).x; sprite.y=tc(tCol,tRow).y` then `_syncGlow()`. Always safe because `isWalkable(tCol, tRow)` must have returned true when `setTarget` was called.

**Phase:** Freeze-Bug fix (same phase as C1)

---

## Moderate Pitfalls

Cause poor UX or subtle bugs; won't block launch but will surface under play.

---

### M1: BFS CPU Spin on Unreachable Target

**What goes wrong:** `bfsStep` uses `q.shift()` (O(n) per dequeue). 9 entities × BFS on 17×58 grid. When target is unreachable, BFS exhausts entire reachable component. If `thinkDelay` reaches 0 with null return, entity retries BFS every frame — CPU spin.

**Prevention:**
- Replace `q.shift()` with index pointer (`let head=0; const n=q[head++]`) — O(1) dequeue.
- After null return from `bfsStep`, set `thinkDelay` to retry back-off (e.g. 800ms).
- Or cap BFS at 300 visited nodes, treat overflow as "no path found."

**Phase:** AI/pathfinding cleanup; defer until perf is visibly impacted.

---

### M2: Roadblock Placed on Occupied Tile

**What goes wrong:** `_pendingRoadblock` deployment at lines 780–785 only checks `ROADBLOCKS.has(key)` and count limit — not whether player or teammate occupies that tile. A roadblock can materialize underneath the player, trapping them.

**Prevention:** Before creating Roadblock, check `isOccupied(rb.c, rb.r)` against player and all teammates.

**Phase:** AI behavior / roadblock polish.

---

### M3: Roadblock Deadlock in Narrow Passages

**What goes wrong:** The col-5 gap (rows 23–30) requires traversal through a 4-tile staircase bypass. Two roadblocks on those tiles make the bypass impassable with no alternative western route.

**Prevention:** Tag choke-point tiles in a `CHOKE_TILES` set; exclude from roadblock candidate selection (`!CHOKE_TILES.has(key)` in enemy roadblock condition).

**Phase:** Map/AI balance pass.

---

### M4: D-Pad Direction Lost on Finger Slide (iOS Safari)

**What goes wrong:** On iOS Safari, finger sliding from one D-Pad button to another fires `pointerout` on the first but no `pointerover` on the second (during active touch). Direction is nulled but not re-set. Additionally, D-Pad position at `(80, VH-80)` uses canvas logical height, not device screen height — safe area handling only works accidentally.

**Prevention:**
- Replace per-button event model with single `pointerdown`/`pointermove`/`pointerup` on a D-Pad zone. Compute direction from touch delta relative to D-Pad center.
- Add `input.on('pointerup', ()=>{ this.mobileDir=null; })` as global safety fallback.
- Read `env(safe-area-inset-bottom)` via hidden DOM element and offset D-Pad by that value (convert CSS px → Phaser canvas units via `game.scale.displayScale`).

**Phase:** D-Pad Touch Controls (active requirement).

---

### M5: Keyboard Input Persists Across Scene Restart

**What goes wrong:** When `scene.start('GameScene')` fires, the keyboard manager on the new scene may carry residual key-down state from the prior scene's final keypress. Player moves immediately on game restart without user input.

**Prevention:** Call `this.input.keyboard.resetKeys()` in `GameScene.create()` before starting update processing.

**Phase:** Scene transition polish.

---

### M6: Module-Level ROADBLOCKS Not Cleared on BankScene Entry

**What goes wrong:** `ROADBLOCKS` is a module-level Set, cleared only in `GameScene.create()`. Roadblocks placed at the end of city navigation persist into BankScene, falsely blocking tiles inside the Bank.

**Prevention:** Clear `ROADBLOCKS` at the top of every scene's `create()` that uses `isWalkable()`, or move it into `game.registry` so lifecycle is explicit.

**Phase:** BankScene / slot machine intro.

---

## Forward-Looking Pitfalls

Specific to upcoming features not yet implemented.

---

### F1: Web Audio AudioContext Suspended on iOS (Autoplay Restriction)

**What goes wrong:** iOS Safari requires `AudioContext.resume()` to be called **synchronously inside a user gesture handler**. Any async boundary (Promise, setTimeout) breaks this. AudioContext stays suspended; all sound is silent. Safari may also re-suspend on backgrounding.

**Prevention:**
- Create AudioContext lazily inside first `pointerdown`/`touchstart` handler (BootScene's "tap to start").
- Call `ctx.resume()` synchronously in that handler — not in `.then()`.
- On `visibilitychange`: if visible and ctx not running, call `ctx.resume()`.
- Store context in `game.registry` — one shared AudioContext for all scenes (browser limit: ~6 contexts).
- **Reference:** Copy the unlock pattern from `1x1-trainer/index.html` verbatim — it already handles this correctly.

**Phase:** Web Audio / synthesized sound.

---

### F2: Slot Machine RNG Fairness vs. Child Engagement

**What goes wrong:** Pure random 3-reel with 6 symbols = ~1/36 win rate (2.8%). A child playing 3 minutes at 1 spin per 5 seconds sees ~36 spins, expected wins under 1. Child loses every spin and quits feeling cheated. Secondary: tap-to-stop freezing reels between symbol detents shows partial symbols ("did I win?").

**Prevention:**
- Use biased RNG: track spin count; guarantee a win on spin N (uniform 3–8 spins). On Nth spin, force reel 3 to land on matching symbol regardless of visual position.
- Reel stop must animate a short "settle" tween to nearest symbol boundary.
- Play distinct Web Audio "thunk" per reel stop; silent stop feels broken.

**Phase:** Slot machine mini-game design.

---

### F3: D-Pad Input Active During Slot Machine Spin

**What goes wrong:** D-Pad `mobileDir` set globally. Touch on reel-stop buttons can also trigger `mobileDir`, causing player movement during slot spin.

**Prevention:** Introduce `this.inputLocked` flag; set true when entering mini-game. Guard `mobileDir` propagation to `player.update()` behind that flag.

**Phase:** Slot machine integration.

---

### F4: Phaser Tween/Timer Accumulation on Scene Restart

**What goes wrong:** Tweens/timers are auto-destroyed when owning scene stops — but only if added to that scene's own managers. Objects added to the wrong scene's managers outlive the transition and throw errors on restart.

**Prevention:**
- Never pass live Phaser game objects across scene boundaries.
- All tweens/timers in BankScene must use `this.tweens` and `this.time`.
- Store tween references; call `tween.stop()` in `shutdown` event listener (`this.events.on('shutdown', this._cleanup, this)`).

**Phase:** BankScene / slot machine implementation.

---

### F5: BankScene Entry Without Phaser Scene Data Handoff

**What goes wrong:** `scene.start('BankScene')` destroys GameScene's instance. Any state not explicitly passed via data argument is lost. BankScene shows wrong live count or timer resets.

**Prevention:** Define a state handoff object at the `scene.start` call site: `scene.start('BankScene', { elapsed, lives, tmAlive })`. BankScene reads it in `init(data)`. Follow the pattern already used by WinScene at line 757.

**Phase:** Scene transitions / BankScene integration.

---

## Phase-Specific Warning Table

| Feature / Phase | Pitfall(s) | Key Mitigation |
|---|---|---|
| Freeze-Bug fix | C1 (re-collision loop), C2 (mid-transit desync) | Snap to target tile on freeze; force spatial separation on unfreeze |
| D-Pad Touch Controls | M4 (slide-off, safe area) | Single-zone pointermove model; CSS env() inset offset |
| Scene transitions | M5 (key state), M6 (ROADBLOCKS), F4 (tween leak) | `resetKeys()`; clear ROADBLOCKS per scene; never cross scene object refs |
| Web Audio / sound | F1 (autoplay) | Unlock in first synchronous touch handler; copy 1x1-trainer pattern |
| Slot machine design | F2 (RNG fairness, detent snap) | Biased/guaranteed win within 3–8 spins; settle tween; audio per stop |
| Slot machine integration | F3 (D-Pad during spin), M6 (ROADBLOCKS) | `inputLocked` flag; explicit ROADBLOCKS clear on BankScene entry |
| BankScene entry | F5 (state handoff), M6 (ROADBLOCKS) | `scene.start(key, data)` data argument; registry for persistent state |
| AI / pathfinding | M1 (BFS spin) | Index-pointer dequeue; retry back-off after null return |
| Roadblock placement | M2 (occupied tile), M3 (choke deadlock) | Occupancy check; CHOKE_TILES exclusion set |

---

*Pitfalls research: 2026-05-10*
