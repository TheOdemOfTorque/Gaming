# Phase 1: Freeze-Bug Fix — Pattern Map

**Mapped:** 2026-05-11
**Source file:** `prime-empire/index.html` (single-file project — all changes here)
**Modification locations:** 8
**Analogs found:** 8 / 8 (all in-file)

---

## Modification Location Table

| Location | Lines | Action | Role | Analog (in-file) |
|----------|-------|--------|------|------------------|
| `Entity` constructor | 192–211 | Modify — remove `freezeMs/invincibleMs`, add timer/ring fields, add `_freezeRing` | initializer | `_frozenOverlay` block (204–210) |
| `Entity.freeze()` | 217–224 | Modify — add C2-snap + `time.delayedCall` + `_startFreezeRing` | state machine | `time.delayedCall` at line 744/757 |
| `Entity._unfreeze()` | 225–232 | Modify — add C1-separation + `time.delayedCall` + `_stopFreezeRing` | state machine | `time.delayedCall` at line 744/757 |
| `Entity.tickFreeze()` | 241–244 | Delete entirely | manual timer (removed) | — (removed, replaced by delayedCall) |
| `Entity.destroy()` | 262–266 | Modify — cancel timers + ring before sprite.destroy | teardown | `_stopBlink()` call (line 263) |
| `Player/Enemy/Teammate.update()` | 284, 318, 364 | Delete `this.tickFreeze(delta)` call at each site | update loop | — |
| `_checkCollisions()` enemy-player | 733–736 | Modify — `e.freeze(5000)`, `player.freeze(2500)` | collision response | existing call at line 722/724 |
| New methods: `_startFreezeRing/_stopFreezeRing/_separateTo/_findSafeNeighbor` + `Enemy._unfreeze()` | after line 240 / in Enemy class | Insert new — no in-file analog for helpers; ring uses `_frozenOverlay` + `_startBlink` idioms | new | `_frozenOverlay` (204–210), `_startBlink` (233–236) |

---

## Pattern Assignments

### 1. `Entity` constructor — field init block (lines 192–211)

**Action:** Remove `freezeMs` and `invincibleMs` fields; add four timer/ring fields; add `_freezeRing` lazy-init comment.

**Current code (lines 192–211):**
```javascript
class Entity {
  constructor(scene, col, row, bodyColor, accentColor, ninjaType, size) {
    this.scene=scene; this.col=col; this.row=row;
    this.tCol=col; this.tRow=row; this.moving=false;
    this.frozen=false; this.freezeMs=0;                    // ← remove freezeMs
    this.invincible=false; this.invincibleMs=0;             // ← remove invincibleMs
    this.lives=3; this.bodyColor=bodyColor; this.accentColor=accentColor;
    this.size=size; this.lastDir='DOWN'; this._blinkTween=null;

    const pos=tc(col,row);
    this.glow2=scene.add.circle(pos.x,pos.y,size*0.72,bodyColor,0.07);
    this.glow1=scene.add.circle(pos.x,pos.y,size*0.56,bodyColor,0.17);
    this.sprite=scene.add.container(pos.x,pos.y);
    const g=scene.make.graphics({x:0,y:0,add:false});
    drawNinja(g,size,bodyColor,accentColor,ninjaType);
    this._frozenOverlay=scene.make.graphics({x:0,y:0,add:false}); // ← analog for _freezeRing
    this._frozenOverlay.fillStyle(0x8899BB,0.62);
    this._frozenOverlay.fillCircle(0,0,size*0.55);
    this._frozenOverlay.setVisible(false);
    this.sprite.add([g,this._frozenOverlay]);
  }
```

**Analog — `_frozenOverlay` as sprite child (lines 204–210):**
This is the exact pattern to copy for `_freezeRing`. Key: `scene.make.graphics({x:0,y:0,add:false})` keeps the object off the main display list; `this.sprite.add([...])` places it inside the container so it moves with the entity automatically.
```javascript
this._frozenOverlay=scene.make.graphics({x:0,y:0,add:false});
this._frozenOverlay.fillStyle(0x8899BB,0.62);
this._frozenOverlay.fillCircle(0,0,size*0.55);
this._frozenOverlay.setVisible(false);
this.sprite.add([g,this._frozenOverlay]);
```

**New fields to add (replace `freezeMs`/`invincibleMs` lines):**
```javascript
this.frozen=false;
this.invincible=false;
this._freezeTimer=null;
this._invincibleTimer=null;
this._freezeRingTween=null;
this._freezeRing=null;  // lazy-created in _startFreezeRing
```

Note: `_freezeRing` is NOT added to `sprite.add()` here — it is lazy-created inside `_startFreezeRing()` on first use (matches RESEARCH.md design).

---

### 2. `Entity.freeze()` — lines 217–224

**Action:** Add C2-snap block before `frozen=true`; replace `this.freezeMs=ms` with `scene.time.delayedCall`; add `_startFreezeRing(ms)` call.

**Current code (lines 217–224):**
```javascript
freeze(ms){
  if(this.frozen||this.invincible) return false;
  this.frozen=true; this.freezeMs=ms; this.moving=false;  // ← freezeMs removed; no snap
  this._frozenOverlay.setVisible(true);
  this.glow1.setFillStyle(0x6688AA,0.12);
  this.glow2.setFillStyle(0x6688AA,0.05);
  return true;
}
```

**Analog — `scene.time.delayedCall` idiom (line 744 in `_checkCollisions`):**
```javascript
this.time.delayedCall(1100,()=>this.scene.start('GameOverScene'));
```
And at line 757:
```javascript
this.time.delayedCall(1000,()=>this.scene.start('WinScene',{time:this.elapsed}));
```
These are the only existing `delayedCall` uses in the file. The new pattern assigns the return value to a cancellable handle (new behaviour — needed for `destroy()`).

**Target code (from RESEARCH.md, lines 158–185):**
```javascript
freeze(ms){
  if(this.frozen||this.invincible) return false;

  // C2-Fix: snap to destination tile if mid-transit
  if(this.moving){
    this.col=this.tCol; this.row=this.tRow;
    const pos=tc(this.tCol,this.tRow);
    this.sprite.x=pos.x; this.sprite.y=pos.y;
    this._syncGlow();
  }

  this.frozen=true; this.moving=false;
  this._frozenOverlay.setVisible(true);
  this.glow1.setFillStyle(0x6688AA,0.12);
  this.glow2.setFillStyle(0x6688AA,0.05);

  if(this._freezeTimer) this._freezeTimer.remove(false);
  this._freezeTimer=this.scene.time.delayedCall(ms,()=>this._unfreeze(),[],this);
  this._startFreezeRing(ms);
  return true;
}
```

---

### 3. `Entity._unfreeze()` — lines 225–232

**Action:** Remove `freezeMs=0` and `invincibleMs=3000`; add C1-separation helpers; replace invincible countdown with `delayedCall`; add `_stopFreezeRing()` call.

**Current code (lines 225–232):**
```javascript
_unfreeze(){
  this.frozen=false; this.freezeMs=0;              // ← freezeMs removed
  this._frozenOverlay.setVisible(false);
  this.glow1.setFillStyle(this.bodyColor,0.17);
  this.glow2.setFillStyle(this.bodyColor,0.07);
  this.invincible=true; this.invincibleMs=3000;    // ← invincibleMs removed; needs delayedCall
  this._startBlink();
}
```

**Target code (from RESEARCH.md, lines 230–250):**
```javascript
_unfreeze(){
  this.frozen=false; this._freezeTimer=null;
  this._frozenOverlay.setVisible(false);
  this.glow1.setFillStyle(this.bodyColor,0.17);
  this.glow2.setFillStyle(this.bodyColor,0.07);
  this._stopFreezeRing();

  // C1-Fix: snap to adjacent free tile before becoming vulnerable
  const safe=this._findSafeNeighbor();
  if(safe) this._separateTo(safe.c,safe.r);

  this.invincible=true;
  if(this._invincibleTimer) this._invincibleTimer.remove(false);
  this._invincibleTimer=this.scene.time.delayedCall(3000,()=>{
    this.invincible=false; this._invincibleTimer=null; this._stopBlink();
  },[],this);
  this._startBlink();
}
```

**New helper methods — insert between `_unfreeze` and `_startBlink` (after line 232):**

No in-file analog for `_separateTo`/`_findSafeNeighbor` — use RESEARCH.md excerpts verbatim.

```javascript
_separateTo(targetC,targetR){
  this.col=targetC; this.row=targetR;
  this.tCol=targetC; this.tRow=targetR;
  const pos=tc(targetC,targetR);
  this.sprite.x=pos.x; this.sprite.y=pos.y;
  this._syncGlow();
}
_findSafeNeighbor(){
  const scene=this.scene;
  const occupied=new Set();
  if(scene.player) occupied.add(`${scene.player.col},${scene.player.row}`);
  if(scene.enemies) scene.enemies.forEach(e=>{if(e!==this)occupied.add(`${e.col},${e.row}`);});
  if(scene.teammates) scene.teammates.forEach(t=>{if(t!==this)occupied.add(`${t.col},${t.row}`);});
  for(const [dc,dr] of Object.values(DIRS)){
    const nc=this.col+dc,nr=this.row+dr;
    if(isWalkable(nc,nr)&&!occupied.has(`${nc},${nr}`)) return {c:nc,r:nr};
  }
  return null;
}
```

---

### 4. `Entity.tickFreeze()` — lines 241–244 — DELETE

**Action:** Remove the method entirely. All three callers (`Player.update` line 284, `Enemy.update` line 318, `Teammate.update` line 364) also have their `this.tickFreeze(delta)` line removed.

**Current code (lines 241–244) — delete this block:**
```javascript
tickFreeze(delta){
  if(this.frozen){this.freezeMs-=delta;if(this.freezeMs<=0)this._unfreeze();}
  if(this.invincible){this.invincibleMs-=delta;if(this.invincibleMs<=0){this.invincible=false;this.invincibleMs=0;this._stopBlink();}}
}
```

**Caller removals:**

Line 284 in `Player.update()` — remove:
```javascript
this.tickFreeze(delta);
```

Line 318 in `Enemy.update()` — remove:
```javascript
this.tickFreeze(delta);
```

Line 364 in `Teammate.update()` — remove:
```javascript
this.tickFreeze(delta);
```

---

### 5. `Entity.destroy()` — lines 262–266

**Action:** Cancel `_freezeTimer` and `_invincibleTimer` before `sprite.destroy()`; call `_stopFreezeRing()`.

**Current code (lines 262–266):**
```javascript
destroy(){
  this._stopBlink();
  this.sprite.destroy(true);
  this.glow1.destroy(); this.glow2.destroy();
}
```

**Analog — `_stopBlink()` pattern (lines 237–240):**
`_stopBlink()` is already called first. The new timer cancels follow the same "guard + nullify" pattern:
```javascript
_stopBlink(){
  if(this._blinkTween){this._blinkTween.stop();this._blinkTween=null;}
  if(this.sprite) this.sprite.setAlpha(1.0);
}
```

**Target code (from RESEARCH.md, lines 386–394):**
```javascript
destroy(){
  this._stopBlink();
  this._stopFreezeRing();
  if(this._freezeTimer){this._freezeTimer.remove(false);this._freezeTimer=null;}
  if(this._invincibleTimer){this._invincibleTimer.remove(false);this._invincibleTimer=null;}
  this.sprite.destroy(true);
  this.glow1.destroy(); this.glow2.destroy();
}
```

Critical: must cancel timers BEFORE `sprite.destroy(true)` — if `_unfreeze()` fires after destroy it will attempt to access a destroyed sprite (line 727 `tm.destroy()` is the live trigger).

---

### 6. New methods: `_startFreezeRing` / `_stopFreezeRing` — insert after `_stopBlink` (after line 240)

**Action:** Insert two new methods into `Entity`. No in-file analog for `tweens.addCounter` — but the pattern mirrors `_startBlink`'s cancellable tween handle, and the graphics-as-sprite-child mirrors `_frozenOverlay`.

**Analog 1 — cancellable tween handle from `_startBlink` (lines 233–236):**
```javascript
_startBlink(){
  this._stopBlink();
  this._blinkTween=this.scene.tweens.add({targets:this.sprite,alpha:{from:1,to:0.12},duration:160,yoyo:true,repeat:-1});
}
```
Pattern: assign tween to `this._blinkTween` → stop it in the corresponding `_stop*` method.

**Analog 2 — sprite-child graphics from `_frozenOverlay` (lines 204–210, in constructor):**
```javascript
this._frozenOverlay=scene.make.graphics({x:0,y:0,add:false});
// ...configure...
this.sprite.add([g,this._frozenOverlay]);
```
Pattern: `scene.make.graphics({x:0,y:0,add:false})` + `sprite.add(child)`.

**Analog 3 — cancellable Phaser timer handle from `Roadblock` (line 393):**
```javascript
this._timer=scene.time.addEvent({delay:280,repeat:-1,callback:()=>{this._phase^=1;this._draw();}});
```
Pattern: store handle in field, call `.remove()` in teardown.

**Target code (from RESEARCH.md, lines 299–342):**
```javascript
_startFreezeRing(ms){
  if(!this._freezeRing){
    this._freezeRing=this.scene.make.graphics({x:0,y:0,add:false});
    this.sprite.add(this._freezeRing);
  }
  this._freezeRing.setVisible(true);
  const radius=this.size*0.60;
  const startAngle=-Math.PI/2; // 12 o'clock
  if(this._freezeRingTween) this._freezeRingTween.stop();
  this._freezeRingTween=this.scene.tweens.addCounter({
    from:1,to:0,duration:ms,ease:'Linear',
    onUpdate:(tween)=>{
      const progress=tween.getValue();
      this._freezeRing.clear();
      if(progress<=0) return;
      this._freezeRing.lineStyle(3,0xAADDFF,0.90);
      this._freezeRing.beginPath();
      this._freezeRing.arc(0,0,radius,startAngle,startAngle+progress*Math.PI*2,false);
      this._freezeRing.strokePath();
    },
    onComplete:()=>{this._freezeRing.setVisible(false);this._freezeRingTween=null;}
  });
}
_stopFreezeRing(){
  if(this._freezeRingTween){this._freezeRingTween.stop();this._freezeRingTween=null;}
  if(this._freezeRing){this._freezeRing.clear();this._freezeRing.setVisible(false);}
}
```

Key detail: `arc(x, y, radius, startAngle, endAngle, anticlockwise=false)` — angles in radians, `false` = clockwise. Ring fills from 12 o'clock and drains clockwise as `progress` goes 1→0.

---

### 7. `Enemy._unfreeze()` override — insert into Enemy class (after `_decide`, before closing brace ~line 349)

**Action:** Override `_unfreeze()` in `Enemy` to reset `thinkDelay=0` for immediate re-pathfinding.

**Current Enemy class:** No `_unfreeze()` override exists. `thinkDelay` is initialized at line 303: `this.thinkDelay=id*300;` — Enemy-only field.

**Target code (from RESEARCH.md, lines 256–260):**
```javascript
_unfreeze(){
  super._unfreeze();
  this.thinkDelay=0; // force immediate re-pathfinding after freeze
}
```

Rationale: `thinkDelay` is Enemy-only. Without reset, a newly unfrozen Enemy waits `id*300` ms before pathfinding — it stands still and is immediately re-frozen. `thinkDelay=0` makes `_decide()` run on the next update frame (line 323–324: `if(this.thinkDelay<=0){this.thinkDelay=0;this._decide(pc,pr);}`).

---

### 8. `_checkCollisions()` enemy-player call site — lines 733–736

**Action:** Change freeze durations to asymmetric values (FREEZE-03).

**Current code (lines 733–736):**
```javascript
e.freeze(3000);
this.player.lives=Math.max(0,this.player.lives-1);
this.player.freeze(3000);
```

**Target code:**
```javascript
e.freeze(5000);           // Gegner: 5 Sekunden
this.player.lives=Math.max(0,this.player.lives-1);
this.player.freeze(2500); // Spieler: 2,5 Sekunden
```

**Enemy-Teammate call site (lines 722–724) — unchanged:**
```javascript
const ok=e.freeze(5000);
if(ok){
  if(tm.freeze(5000)){tm.lives=Math.max(0,tm.lives-1);}
```
Teammate freeze duration stays 5000ms (symmetrical to enemy). See Open Question below.

---

## Shared Patterns

### Cancellable timer pattern
**Source:** `Roadblock` constructor (line 393) + new `_freezeTimer`/`_invincibleTimer`
**Apply to:** `freeze()`, `_unfreeze()`, `destroy()`
```javascript
// Store handle: this._someTimer = scene.time.delayedCall(ms, fn, [], this);
// Cancel: if(this._someTimer){this._someTimer.remove(false);this._someTimer=null;}
```
`remove(false)` = remove without firing the callback.

### Cancellable tween pattern
**Source:** `_startBlink` / `_stopBlink` (lines 233–240)
**Apply to:** `_startFreezeRing`, `_stopFreezeRing`, `destroy()`
```javascript
// Store: this._blinkTween = this.scene.tweens.add({...});
// Cancel: if(this._blinkTween){this._blinkTween.stop();this._blinkTween=null;}
```

### Graphics as sprite child
**Source:** `_frozenOverlay` (lines 204–210)
**Apply to:** `_startFreezeRing` (lazy-create `_freezeRing`)
```javascript
// scene.make.graphics({x:0,y:0,add:false}) — does NOT add to display list
// this.sprite.add(child) — places inside container, moves automatically with entity
```

### Guard + nullify teardown
**Source:** `_stopBlink` (line 238), `destroy` (lines 262–266)
**Apply to:** All timer/tween cancellation sites
```javascript
if(this._handle){this._handle.stop();this._handle=null;}
```

---

## Open Question — Must Resolve Before Planning

**Open Question A1 (Teammate freeze duration, line 724):**

Current value: `tm.freeze(5000)` — 5 seconds (same as enemy).
FREEZE-03 requirement specifies only player (2500ms) and enemy (5000ms). Teammate duration not specified.
RESEARCH.md recommendation: leave at 5000ms (symmetrical to enemy, predictable co-op timing).

The planner must decide: **accept 5000ms for Teammates, or ask the user?**
If 5000ms is accepted, line 724 is unchanged and not a modification site for this phase.

---

## No Analog Found

All modification locations have in-file analogs. No external pattern references needed.

---

## Metadata

**Source file:** `/Users/marco/dev/gaming/prime-empire/index.html`
**Lines read:** 192–294 (Entity hierarchy + Player/Enemy/Teammate), 700–759 (`_checkCollisions`, `_checkWin`)
**Pattern extraction date:** 2026-05-11
**Valid until:** 2026-06-11 (Phaser 3.90.0, stable API)
