# Technology Stack — Prime Empire Abschnitt 1 (Brownfield)

**Project:** prime-empire/index.html
**Researched:** 2026-05-10
**Engine:** Phaser 3.90.0 (CDN, locked — not subject to change)
**Constraint:** Single-file HTML, no build step, no npm

---

## Engine Baseline (Locked)

| Technology | Version | CDN |
|------------|---------|-----|
| Phaser 3 | 3.90.0 | `https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js` |

All five feature areas below use only vanilla Phaser 3 APIs and Web Audio API.
No plugins are recommended — they would require a CDN dist URL that may not exist,
and the Phaser 3 built-ins cover every needed feature.

---

## 1. Freeze Mechanic Fix

**The bug:** `Entity.tickFreeze(delta)` manually decrements `freezeMs -= delta` inside `update()`.
This approach is fragile: if delta spikes (tab in background, slow device), or if the entity's
update is skipped a frame, the countdown drifts. Entities can stay frozen indefinitely.

**Fix: Replace with `scene.time.delayedCall`**

Phaser's `Time.Clock` is lifecycle-aware — it pauses when the scene pauses, fires exactly once,
and does not drift with frame rate. This is the idiomatic Phaser freeze pattern.

```js
// In Entity.freeze(ms):
freeze(ms) {
  if (this.frozen || this.invincible) return false;
  this.frozen = true;
  this.moving = false;
  this._frozenOverlay.setVisible(true);

  // Cancel any existing unfreeze timer
  if (this._freezeTimer) this._freezeTimer.remove(false);

  // Phaser-managed timer — survives frame spikes, auto-pauses with scene
  this._freezeTimer = this.scene.time.delayedCall(ms, () => this._unfreeze(), [], this);
  return true;
}

_unfreeze() {
  this.frozen = false;
  this._freezeTimer = null;
  this._frozenOverlay.setVisible(false);
  // ... restore glow, start invincibility blink
}
```

Remove `freezeMs`, `invincibleMs`, and their corresponding `tickFreeze(delta)` decrement logic.
Replace `invincible` timer similarly:

```js
this._invincibleTimer = this.scene.time.delayedCall(3000, () => {
  this.invincible = false;
  this._stopBlink();
}, [], this);
```

**Key APIs:**
- `this.scene.time.delayedCall(delay, callback, args, scope)` — fires once after `delay` ms
- `timerEvent.remove(false)` — cancel without firing; pass `true` to fire immediately
- `this.scene.time.addEvent({ delay, callback, callbackScope, loop })` — repeating variant

**Confidence:** HIGH — official Phaser 3 `Time.Clock` API, confirmed via search results and docs.phaser.io.

---

## 2. D-Pad Touch Controls

**Current state:** Four `rectangle` game objects with `pointerdown/pointerup/pointerout` listeners.
This breaks on iOS when a finger slides between buttons — `pointerout` fires on the source button
but `pointerdown` never fires on the destination because the touch point is already tracked.

**Fix: Global `pointermove` + `addPointer` for multi-touch**

Step 1 — Enable extra touch pointers in `create()`:

```js
// Default is 2. 3 extra covers both thumbs and accidentals
this.input.addPointer(3);
```

Step 2 — Replace per-button `pointerdown/up/out` with a global `pointermove`/`pointerdown`/`pointerup`
approach. Store button rectangles as data, resolve which button a pointer is over on every frame:

```js
_createDpad() {
  const VH = this.cameras.main.height;
  const px = 80, py = VH - 80, gap = 56, btn = 48;

  this._dpadButtons = [
    { dir: 'UP',    bounds: new Phaser.Geom.Rectangle(px - btn/2,      py - gap - btn/2, btn, btn) },
    { dir: 'DOWN',  bounds: new Phaser.Geom.Rectangle(px - btn/2,      py + gap - btn/2, btn, btn) },
    { dir: 'LEFT',  bounds: new Phaser.Geom.Rectangle(px - gap - btn/2, py - btn/2,       btn, btn) },
    { dir: 'RIGHT', bounds: new Phaser.Geom.Rectangle(px + gap - btn/2, py - btn/2,       btn, btn) },
  ];

  // Draw button graphics as before (unchanged)
  this._dpadButtons.forEach(b => {
    const cx = b.bounds.centerX, cy = b.bounds.centerY;
    this.add.rectangle(cx, cy, btn, btn, 0x00C8E8, 0.18)
      .setScrollFactor(0).setDepth(200);
    // label text ...
  });
}

_getDpadDir() {
  // Check all active pointers against button bounds
  const pointers = this.input.manager.pointers;
  for (const ptr of pointers) {
    if (!ptr.isDown) continue;
    for (const b of this._dpadButtons) {
      if (Phaser.Geom.Rectangle.Contains(b.bounds, ptr.x, ptr.y)) {
        return b.dir;
      }
    }
  }
  return null;
}

// In update():
this.mobileDir = this._getDpadDir();
```

`this.input.manager.pointers` is an array of all registered `Phaser.Input.Pointer` objects.
`ptr.isDown` is true whenever that pointer has an active press. This approach naturally handles
slide-between-buttons — wherever the finger is at the moment of the update tick is the active direction.

**Key APIs:**
- `this.input.addPointer(N)` — register N additional pointers (up to 10 total)
- `this.input.manager.pointers` — array of all Pointer objects
- `ptr.isDown` — boolean, true while pointer is held
- `ptr.x`, `ptr.y` — viewport coordinates (not world coordinates, no camera offset needed since D-pad uses `scrollFactor(0)`)
- `Phaser.Geom.Rectangle.Contains(rect, x, y)` — point-in-rectangle test

**Confidence:** HIGH — confirmed via docs.phaser.io Pointer class and discourse examples.

---

## 3. Scene Architecture (GameScene → BankScene → SlotScene)

**The discriminator:** `scene.start('BankScene')` shuts down GameScene and destroys all its objects.
On return from the bank, GameScene must be fully rebuilt from scratch (expensive, jarring).
`scene.launch('BankScene')` + `this.scene.sleep()` preserves GameScene in memory — returning is instant wake.

**Recommended scene graph:**

```
BootScene
  └── GameScene  (start)
        ├── BankScene  (launch over GameScene; GameScene sleeps)
        │     └── SlotScene  (launch over BankScene; BankScene sleeps)
        │           └── WinScene (start — game over, no return needed)
        └── GameOverScene  (start — game over, no return needed)
```

**Transition: GameScene → BankScene**

```js
// In GameScene._checkWin(), when player reaches T_GOAL:
this.scene.launch('BankScene', { playerLives: this.player.lives, elapsed: this.elapsed });
this.scene.sleep();           // GameScene stops updating+rendering, retains all state
```

**Transition: BankScene → SlotScene**

```js
// When player interacts with the secret slot machine:
this.scene.launch('SlotScene', { fromBank: true });
this.scene.sleep();
```

**Return: SlotScene → BankScene (on dismiss)**

```js
// In SlotScene, if player cancels:
this.scene.wake('BankScene');
this.scene.sleep();           // SlotScene sleeps (or stop if truly done)
```

**Win path: SlotScene → WinScene (3 matching symbols)**

```js
// scene.start destroys SlotScene, BankScene, GameScene — clean end
this.scene.start('WinScene', { time: data.elapsed });
```

**Passing data via init():**

Every scene that receives data must implement `init(data)` — this fires before `create()` and is
the only reliable place to capture launch data:

```js
class BankScene extends Phaser.Scene {
  constructor() { super('BankScene'); }

  init(data) {
    this.playerLives = data.playerLives ?? 3;
    this.elapsed = data.elapsed ?? 0;
  }

  create() { /* use this.playerLives, this.elapsed */ }
}
```

**Key APIs:**
- `this.scene.launch(key, data)` — start scene in parallel, pass data to its `init(data)`
- `this.scene.sleep()` — stop update+render, keep all objects and state in memory
- `this.scene.wake(key)` — resume a sleeping scene from where it left off
- `this.scene.start(key, data)` — shut down current scene, start new one (use for terminal transitions only)
- Scene event: `this.scene.get('GameScene').events.emit('customEvent', payload)` — cross-scene communication

**Confidence:** HIGH — official Phaser 3 ScenePlugin docs, confirmed via phaser.discourse.group and gist.github.com/samme.

---

## 4. Slot Machine Mini-Game

**Architecture:** A standalone `SlotScene` launched over BankScene. Contains 3 reels, each a
masked Container with vertically scrolling symbol text objects.

### Reel Structure

Each reel is a `Phaser.GameObjects.Container` holding symbol text objects spaced `SYMBOL_H` pixels apart.
A `GeometryMask` clips the container to a visible window (one symbol height).

```js
const SYMBOLS = ['★', '♦', '●', '♠', '7'];
const SYMBOL_H = 80;   // height of each symbol cell
const REEL_W = 80;     // width of reel window
const VISIBLE_H = SYMBOL_H * 1;  // show exactly 1 symbol

function createReel(scene, x, y) {
  // Create the visible window mask
  const maskGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
  maskGraphics.fillStyle(0xffffff);
  maskGraphics.fillRect(x - REEL_W/2, y - VISIBLE_H/2, REEL_W, VISIBLE_H);
  const mask = maskGraphics.createGeometryMask();

  // Container holds symbols; it scrolls vertically
  const container = scene.add.container(x, 0);
  container.setMask(mask);

  // Populate with symbols — enough for looping: repeat array 3x
  const symbols = [...SYMBOLS, ...SYMBOLS, ...SYMBOLS];
  symbols.forEach((sym, i) => {
    const txt = scene.add.text(0, y + i * SYMBOL_H - SYMBOL_H, sym, {
      fontFamily: '"Courier New",monospace',
      fontSize: '52px',
      color: '#FEFE12',
    }).setOrigin(0.5);
    container.add(txt);
  });

  return { container, maskGraphics, spinning: false, tween: null, stoppedIdx: null };
}
```

### Spinning (Infinite Loop)

Use `tweens.add` with `repeat: -1` and `ease: 'Linear'` to scroll the container's `y` continuously.
Wrap `container.y` using `onUpdate` to simulate an infinite strip:

```js
function startSpin(scene, reel) {
  const totalH = SYMBOLS.length * SYMBOL_H;
  reel.spinning = true;
  reel.tween = scene.tweens.add({
    targets: reel.container,
    y: { from: 0, to: totalH },
    duration: 600,         // ms per symbol-height scroll (speed feel)
    ease: 'Linear',
    repeat: -1,
    onUpdate: () => {
      // Wrap to create infinite strip illusion
      if (reel.container.y >= totalH) reel.container.y -= totalH;
    },
  });
}
```

### Stopping a Reel (Tap-to-Stop with Ease-Out Snap)

When the player taps, stop the infinite tween and snap to the nearest symbol boundary
using a new tween with `ease: 'Cubic.Out'`:

```js
function stopReel(scene, reel) {
  if (!reel.spinning) return;
  reel.spinning = false;

  // Stop the infinite tween without firing onComplete
  reel.tween.stop();

  // Find nearest symbol boundary to snap to
  const currentY = reel.container.y;
  const totalH = SYMBOLS.length * SYMBOL_H;
  const normalizedY = ((currentY % totalH) + totalH) % totalH;
  const targetIdx = Math.round(normalizedY / SYMBOL_H);
  const snapY = targetIdx * SYMBOL_H;

  // Ease-out snap — feels satisfying, like a real reel
  scene.tweens.add({
    targets: reel.container,
    y: snapY,
    duration: 400,
    ease: 'Cubic.Out',
    onComplete: () => {
      reel.stoppedIdx = targetIdx % SYMBOLS.length;
    },
  });
}
```

### Win Check

After all 3 reels stop, compare `reel.stoppedIdx` values:

```js
function checkWin(reels) {
  return reels.every(r => r.stoppedIdx === reels[0].stoppedIdx);
}
```

**Key APIs:**
- `scene.add.container(x, y)` — container for grouped symbol objects
- `scene.make.graphics({ add: false })` — off-display-list graphics for mask definition
- `maskGraphics.createGeometryMask()` — returns `Phaser.Display.Masks.GeometryMask`
- `container.setMask(mask)` — apply clipping mask to container
- `scene.tweens.add({ targets, y, ease:'Linear', repeat:-1 })` — continuous scroll
- `tween.stop()` — stop without firing `onComplete`
- `scene.tweens.add({ ease:'Cubic.Out', onComplete })` — snap to position

**Confidence:** HIGH for APIs. MEDIUM for the infinite-strip wrapping pattern — confirmed via rexrainbow notes and Phaser discourse, but container `y` wrapping in `onUpdate` should be tested on-device (iOS Safari canvas compositing sometimes clips aggressively).

---

## 5. Web Audio Synthesized Sound Effects

**Source of truth:** Follow the exact pattern from `1x1-trainer/index.html` (lines 1069-1089).
That code already runs on iOS Safari, uses no audio files, and handles `AudioContext` unlock
via lazy initialization (iOS requires a user gesture before `AudioContext` can play).

### Exact Pattern from 1x1-trainer

```js
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  return audioCtx;
}

function tone(freq, dur, type = 'sine', vol = 0.3) {
  try {
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.value = freq; o.type = type;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(); o.stop(c.currentTime + dur);
  } catch {}
}
```

`exponentialRampToValueAtTime(0.001, ...)` — ramps to near-zero (not exactly zero, which would throw
a RangeError in Web Audio). This is the correct iOS-safe envelope termination.

### Sound Recipes for Prime Empire

All sounds are layered `tone()` calls with `setTimeout` delays, exactly like `playCorrect()` in 1x1-trainer.

```js
// Movement step (short, subtle — play on each tile arrival)
function playStep() {
  tone(220, 0.05, 'sine', 0.08);
}

// Freeze event (ice-like descending chirp)
function playFreeze() {
  tone(880, 0.08, 'sine', 0.25);
  setTimeout(() => tone(660, 0.10, 'sine', 0.20), 70);
  setTimeout(() => tone(440, 0.18, 'triangle', 0.15), 150);
}

// Hit (player takes damage — harsh buzz)
function playHit() {
  tone(180, 0.12, 'sawtooth', 0.30);
  setTimeout(() => tone(150, 0.18, 'sawtooth', 0.15), 90);
}

// Slot reel spinning (light repeating tick — call on timer while spinning)
function playReelTick() {
  tone(440, 0.04, 'square', 0.12);
}

// Reel stop (satisfying thud)
function playReelStop() {
  tone(300, 0.06, 'triangle', 0.25);
  setTimeout(() => tone(220, 0.12, 'triangle', 0.15), 50);
}

// Win — 3 matching symbols (triumphant ascending)
function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25), i * 120));
}

// Bank entrance / scene transition (airy chord)
function playBankEnter() {
  tone(392, 0.20, 'sine', 0.18);
  setTimeout(() => tone(523, 0.20, 'sine', 0.14), 60);
  setTimeout(() => tone(659, 0.30, 'sine', 0.10), 120);
}
```

### iOS AudioContext Unlock

iOS Safari blocks `AudioContext` until a user gesture occurs. The lazy `getCtx()` pattern handles
this automatically — the first call to any sound function after a user touch creates the context.
In prime-empire, the BootScene already listens to `this.input.once('pointerdown', go)`, so
calling `getCtx()` (or any `tone()`) inside that handler will unlock audio.

**Do not** create `audioCtx` at module load time — iOS will block it and never unlock.

**Key Web Audio APIs:**
- `new (window.AudioContext || window.webkitAudioContext)()` — cross-browser + iOS
- `c.createOscillator()` — `OscillatorNode`; set `.type` = `'sine'|'square'|'sawtooth'|'triangle'`
- `c.createGain()` — `GainNode`; controls volume envelope
- `o.connect(g); g.connect(c.destination)` — signal chain
- `g.gain.setValueAtTime(vol, c.currentTime)` — set initial gain
- `g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)` — fade out (must use 0.001 not 0)
- `o.start(); o.stop(c.currentTime + dur)` — schedule lifetime

**Confidence:** HIGH — pulled directly from working in-repo code (1x1-trainer). Pattern is
confirmed working on iOS Safari.

---

## Implementation Priorities

| Feature | Phaser APIs | Risk |
|---------|-------------|------|
| Freeze bug fix | `time.delayedCall`, `timerEvent.remove` | Low — drop-in replacement |
| D-Pad multi-touch | `input.addPointer`, `input.manager.pointers`, `Phaser.Geom.Rectangle.Contains` | Low — backward-compatible |
| Scene transitions | `scene.launch`, `scene.sleep`, `scene.wake`, `scene.start`, `init(data)` | Medium — new scenes needed |
| Bank visual | `add.graphics`, `add.text`, `tweens.add` | Low — follows existing pattern |
| Slot machine | `add.container`, `make.graphics`, `createGeometryMask`, `setMask`, `tweens.add` | Medium — mask + reel wrap needs device testing |
| Web Audio | `AudioContext`, `OscillatorNode`, `GainNode` | Low — direct copy from 1x1-trainer |

---

## CDN-Only Constraint Summary

No plugins are needed. Every API listed is part of `phaser@3.90.0` core.
The only external dependency remains unchanged:

```html
<script src="https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js"></script>
```

Web Audio is a browser native API — no additional script tag required.

---

## Sources

- [Phaser 3 Scenes — official concepts](https://docs.phaser.io/phaser/concepts/scenes)
- [Phaser 3 Scene lifecycle (ScenePlugin class)](https://newdocs.phaser.io/docs/3.55.2/focus/Phaser.Scenes.ScenePlugin-launch)
- [Phaser 3 SceneManager method summary (samme)](https://gist.github.com/samme/01a33324a427f626254c1a4da7f9b6a3)
- [Phaser 3 Sleep event docs](https://newdocs.phaser.io/docs/3.52.0/focus/Phaser.Scenes.Systems-sleep)
- [Phaser 3 Input — Pointer class](https://docs.phaser.io/api-documentation/class/input-pointer)
- [Phaser 3 multi-touch discourse example](https://phaser.discourse.group/t/how-to-enable-multitouch-jsfiddle-inside/2422)
- [Phaser 3 GeometryMask class](https://docs.phaser.io/api-documentation/class/display-masks-geometrymask)
- [Phaser 3 Tweens — official concepts](https://docs.phaser.io/phaser/concepts/tweens)
- [Phaser 3 Tween class (rexrainbow notes)](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/tween/)
- [Phaser 3 Time.Clock docs](https://docs.phaser.io/api-documentation/class/time-clock)
- [1x1-trainer/index.html — in-repo Web Audio source of truth](../gaming/1x1-trainer/index.html)
