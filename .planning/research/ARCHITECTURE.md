# Architecture Patterns

**Domain:** Phaser 3 single-file browser game — scene extension (brownfield)
**Researched:** 2026-05-10
**Confidence:** HIGH (based on direct codebase read + Phaser 3 official docs)

---

## Current Architecture (as-is)

The file is ~857 lines of vanilla JS inside one `<script>` tag. Structure is clean and follows a clear layering:

```
Module-level constants & pure functions
  generateMap(), bfsStep(), isWalkable(), drawNinja()

Module-level mutable state
  ROADBLOCKS (Set, cleared on restart)

Entity hierarchy (plain JS classes, not Phaser objects)
  Entity (base)
    Player extends Entity
    Enemy  extends Entity
    Teammate extends Entity
  Roadblock (standalone, owns a Phaser Graphics + TimerEvent)

Phaser Scenes
  BootScene    → GameScene → GameOverScene
                           → WinScene
```

Every Entity holds Phaser display objects (Graphics, Container) directly — they are not Phaser GameObjects with an `update` hook; instead `GameScene.update()` manually drives each entity's `.update(delta, ...)` call. This is the correct Pac-Man-style pattern and should be preserved.

---

## Component Boundaries (target architecture)

```
Module-level (shared across all scenes)
  Constants (TILE, COLS, ROWS, T_* tile types)
  MAP (generated once, immutable after init)
  generateMap(), bfsStep(), isWalkable()
  drawNinja()
  ROADBLOCKS (Set) — cleared by GameScene.create()

GameState (plain object, module-level)       ← NEW
  { playerLives, teammateStates, elapsed, slotResult }
  Written by GameScene; read by BankScene

Entity classes (unchanged)
  Entity / Player / Enemy / Teammate / Roadblock

Phaser Scenes (registered order matters for scene.start())
  BootScene
  GameScene          — navigation, entities, collision, freeze
  BankScene          ← NEW — slot machine interior
  SlotScene (overlay inside BankScene, NOT a separate Scene — see below)
  GameOverScene
  WinScene           — becomes "Abschnitt 2 kommt..." screen post-slot
```

### Why SlotScene stays inside BankScene (not its own Phaser.Scene)

Launching a third nested scene adds scene lifecycle complexity with no benefit. The slot machine is a modal UI over a static background — a good fit for Phaser's `scene.launch()` overlay pattern, but the overhead is unnecessary here. Instead, build it as a method group `_buildSlotUI()` inside BankScene that shows/hides a Container group. BankScene handles its own input events. This keeps the single-file readable and avoids scene manager bugs from three concurrent active scenes.

---

## Data Flow: GameScene → BankScene → WinScene

### Mechanism: `scene.start(key, data)` + `init(data)` (HIGH confidence)

Phaser 3 passes data object through `scene.start('BankScene', { ... })` and the receiving scene reads it in `init(data)`. The WinScene already uses this pattern (`data?.time`). Use the same pattern consistently.

```
GameScene._checkWin()
  this.gameWon = true
  this.player.done = true
  this.time.delayedCall(1000, () =>
    this.scene.start('BankScene', {
      elapsed:   this.elapsed,
      lives:     this.player.lives,
      tmAlive:   this.teammates.length
    })
  )

BankScene.init(data)
  this.elapsed = data.elapsed
  this.lives   = data.lives
  this.tmAlive = data.tmAlive

BankScene (on slot win)
  this.scene.start('WinScene', {
    elapsed:    this.elapsed,
    slotResult: 'win'            // or 'lose'
  })
```

Do NOT use `this.registry` for this flow. Registry is global and persists across scene restarts — it requires explicit cleanup and makes it harder to track what state exists at any point. Direct `scene.start` data is cleaner for a linear progression.

---

## Freeze Bug: Root Cause and Fix

### Root cause (identified by code inspection)

`tickFreeze(delta)` correctly counts down `freezeMs` and calls `_unfreeze()` at zero. `_unfreeze()` correctly resets `frozen`, hides the overlay, grants invincibility, and starts the blink tween.

The bug is not in the timer math. It is in post-unfreeze movement restart:

After `_unfreeze()`, `this.moving = false` (set by `freeze()`). The entity needs `_decide()` or `tryDir()` to set a new target. For Enemies: `_decide()` is guarded by `thinkDelay`. The `thinkDelay` is initialized to `id * 300` in the constructor and counts down to 0, staying at 0 afterward. So after unfreeze, the guard is: `if(thinkDelay <= 0)` — which IS true — so `_decide()` runs. Inside `_decide`, the patrol path's BFS step may return null if the patrol points happen to be the entity's current position (single-point patrol). When that happens, neither `setTarget` branch fires, `moving` stays false, and the entity is stuck in a tight loop of `_decide()` returning no target.

For Teammates: `_decide()` is called when `!this.moving` with no delay gate. BFS to the player-offset position may fail in specific map positions (walls, roadblocks). Same outcome.

### Fix pattern: explicit post-unfreeze nudge (RECOMMENDED)

Extend `_unfreeze()` in the base Entity class to queue a recovery tick:

```javascript
_unfreeze() {
  this.frozen = false; this.freezeMs = 0;
  this._frozenOverlay.setVisible(false);
  this.glow1.setFillStyle(this.bodyColor, 0.17);
  this.glow2.setFillStyle(this.bodyColor, 0.07);
  this.invincible = true; this.invincibleMs = 3000;
  this._startBlink();
  // NEW: reset thinkDelay so _decide fires immediately next frame
  if (typeof this.thinkDelay !== 'undefined') this.thinkDelay = 0;
  // NEW: clear moving so _decide is triggered (already false, but be explicit)
  this.moving = false;
}
```

Additionally fix `_buildPatrol` in Enemy to always produce at least two distinct walkable points:

```javascript
_buildPatrol(sc, sr) {
  const candidates = [[0,0],[4,0],[4,4],[0,4],[2,0],[0,2],[-2,0],[0,-2]];
  const pts = [];
  for (const [dc, dr] of candidates) {
    const c = sc + dc, r = sr + dr;
    if (isWalkable(c, r) && !pts.some(([pc,pr]) => pc===c && pr===r))
      pts.push([c, r]);
    if (pts.length >= 3) break;
  }
  return pts.length >= 2 ? pts : [[sc, sr], [sc, sr + 1 >= ROWS ? sr - 1 : sr + 1]];
}
```

### Alternative considered: Phaser time.addEvent for unfreeze

Using `this.scene.time.addEvent({ delay: 5000, callback: this._unfreeze, callbackScope: this })` instead of delta-countdown would eliminate the delta math entirely. However, this would tie the Entity lifecycle to the Scene's timer system, making it harder to pause/resume or serialize. The current delta pattern is sound — fix the movement restart, not the timer mechanism.

---

## BankScene: Recommended Design

### Layout

BankScene is a static interior scene (no scrolling camera). The game world size (816×600) fits 8 slot machines in a 2-row or 1-row layout.

```
BankScene.create()
  ├── _drawBankInterior()     ← Ninjago-colored walls, floor, ceiling
  ├── _buildSlotMachines()    ← 8 machines, one marked as "geheim"
  ├── _buildSlotUI()          ← 3-reel mini-game, initially hidden
  ├── _buildHUD()             ← "Tippe auf den geheimen Automaten"
  └── input handlers          ← tap/click on secret machine → _activateSlot()
```

### Slot Machine Selection

Eight machines drawn as Graphics objects. Only one is the secret machine — mark it with a subtle visual tell (slightly different color, a question mark glyph, or a flickering effect). Tapping the wrong machine does nothing or plays a rejection sound. Tapping the secret machine calls `_activateSlot()` which shows the slot UI Container.

### 3-Reel Animation Pattern

Do not use TileSprite (requires texture atlas, no build step). Use the existing Graphics-drawing pattern from the codebase.

Each reel is a vertical list of symbol text objects inside a Container with a Phaser mask (rectangular crop). Spinning is a tween on the Container's y-position. Stopping is achieved by calling `tween.stop()` and snapping y to the nearest symbol slot.

```javascript
// Reel: a Container with 5 stacked symbol texts, masked to show 1
// Spin: this.tweens.add({ targets: reel, y: reel.y - SYMBOL_H * speed, duration: ... repeat: -1 })
// Stop: tween.stop(); snapToNearestSymbol(reel)
```

Symbols as emoji or Unicode (no image assets): use '★', '◆', '●', '7', '♛'. Five symbols fit easily in Courier New / monospace.

Tap-to-stop input: first tap stops reel 1, second tap stops reel 2, third stops reel 3 and evaluates win condition. Guard with `stoppingPhase` counter (0 = spinning, 1 = reel1 stopped, etc.).

Win condition: all three reels show the same symbol → delay 1.5s → `this.scene.start('WinScene', { ... })`.

---

## D-Pad: Where It Lives

The D-Pad already exists in `GameScene._createDpad()`. It should stay there. BankScene has no movement — it is a point-and-tap scene. No D-Pad in BankScene.

If the D-Pad code needs to be called from multiple scenes in future (Abschnitt 2 reuses GameScene), keep it as a private method of GameScene. Do not extract into a shared utility for Abschnitt 1. Premature extraction creates coupling between scenes that the single-file structure does not benefit from.

---

## Single-File Organization: Section Headers

The file currently uses `// ═══ SECTION NAME ═══` delimiters. Extend this pattern:

```
// ═══ CONSTANTS ═══
// ═══ MAP ═══
// ═══ UTILITY ═══            (isWalkable, bfs, tc, tileRand, snapToRoad)
// ═══ NINJA DRAWING ═══
// ═══ ENTITY BASE ═══
// ═══ PLAYER ═══
// ═══ ENEMY ═══
// ═══ TEAMMATE ═══
// ═══ ROADBLOCK ═══
// ═══ BOOT SCENE ═══
// ═══ GAME SCENE ═══
// ═══ BANK SCENE ═══         ← NEW (add after GameScene)
// ═══ GAME OVER SCENE ═══
// ═══ WIN SCENE ═══
// ═══ START ═══
```

Add `BankScene` to the Phaser.Game config: `scene: [BootScene, GameScene, BankScene, GameOverScene, WinScene]`. The ordering in the array only matters for the first scene (BootScene); subsequent scenes are started explicitly.

At ~1200–1400 lines the file will remain navigable with section headers. Browser DevTools' Ctrl+G (go to line) + text search handles this scale well. No further structural change is needed for Abschnitt 1.

---

## Scalability Considerations

| Concern | Now (~857 lines) | After BankScene (~1300 lines) | Abschnitt 2 |
|---------|-----------------|-------------------------------|-------------|
| File size | Fine | Fine | Consider splitting scenes to separate `<script>` tags if >2000 lines |
| Section navigability | Good | Good | Add JSDoc section anchors |
| Module globals | 2 (MAP, ROADBLOCKS) | 3 (+GameState object) | Consider class-based registry |
| Entity reuse | N/A | N/A | Extract Entity classes to separate JS file if map changes |

---

## Suggested Build Order

This ordering is driven by dependency: later items depend on earlier items being stable.

1. **Freeze bug fix** — unblocks reliable testing of all collision scenarios; touches only Entity base class and Enemy._buildPatrol (low risk, contained change)

2. **Henry reference removal + D-Pad polish** — cosmetic, no architecture impact; do before BankScene so the codebase is clean

3. **GameScene._checkWin() → BankScene transition** — wire up `scene.start('BankScene', data)` even before BankScene has content; this proves the data flow works and gives a skeleton to build into

4. **BankScene interior + machine selection** — static drawing, no game logic; validates the scene is registered and reachable

5. **Slot mini-game (3 reels)** — most complex piece; build reel spin first, stop mechanic second, win evaluation third

6. **WinScene update** — extend to accept `slotResult` data and show "Abschnitt 2 kommt..." with key animation

7. **Audio (Web Audio API)** — add last; synthesized sounds for spin, stop, win/lose don't block any other feature

---

## Anti-Patterns to Avoid

### Using scene.launch() for BankScene
`scene.launch()` runs two scenes concurrently. GameScene would keep running (entities still moving, collisions still firing) while BankScene renders on top. Use `scene.start()` which stops GameScene cleanly.

### Storing state in Entity objects across scene transitions
Entity objects are destroyed when GameScene shuts down. Any state that must survive the transition (elapsed time, lives remaining) must be extracted before calling `scene.start()`.

### Creating a Phaser.Scene for the slot UI overlay
Slot UI is modal — it appears within BankScene and disappears. Using a separate Scene for it adds a scene manager entry, lifecycle callbacks, and input multiplexing complexity with zero benefit for a 3-reel mini-game.

### Using this.registry for inter-scene state
Registry persists for the entire game lifetime including restarts. If the player loses in BankScene and retries, stale registry values could leak. Direct `scene.start(key, data)` is scoped to one transition and cannot have stale state.

---

## Sources

- Phaser 3 cross-scene communication: [docs.phaser.io/phaser/concepts/scenes/cross-scene-communication](https://docs.phaser.io/phaser/concepts/scenes/cross-scene-communication)
- Phaser 3 scene.start data parameter: [phaser.io/examples/v3/view/scenes/passing-data-to-a-scene](https://phaser.io/examples/v3/view/scenes/passing-data-to-a-scene)
- Phaser 3 time.delayedCall: [docs.phaser.io/api-documentation/class/time-clock#delayedCall](https://docs.phaser.io/api-documentation/class/time-clock#delayedCall)
- Existing WinScene data pattern in codebase (line 830): `create(data){ ... data?.time }`
- Direct codebase inspection: `/Users/marco/dev/gaming/prime-empire/index.html` (all Entity classes, GameScene, WinScene)
