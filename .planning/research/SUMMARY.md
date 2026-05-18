# Research Summary: Prime Empire — Abschnitt 1

**Synthesized:** 2026-05-10
**Sources:** STACK.md · FEATURES.md · ARCHITECTURE.md · PITFALLS.md
**Overall confidence:** HIGH (all claims code-verified or from official Phaser 3 docs)

---

## Stack Decisions

| Feature | API / Approach | Notes |
|---------|---------------|-------|
| Freeze timer | `scene.time.delayedCall(ms, fn)` | Replaces manual `freezeMs -= delta`; scene-lifecycle-aware, no frame-spike drift |
| Scene transition | `scene.launch('BankScene', data)` + `scene.sleep()` | Keeps GameScene in memory; instant wake on return. **NOT** `scene.start()` (destroys GameScene) |
| Slot reels | `scene.add.container` + `createGeometryMask()` + `repeat:-1` tween | Rectangular mask clips the scrolling symbol strip; `tween.stop()` + settle tween on tap |
| D-Pad | `input.addPointer(3)` + poll `manager.pointers` in `update()` | `Rectangle.Contains()` per D-Pad zone; no reactive events (fixes iOS slide-off bug) |
| Web Audio | Copy `tone()` from `1x1-trainer/index.html` (lines 1069–1089) | Lazy AudioContext creation in first `pointerdown` handler (iOS unlock) |
| Slot symbols | Phaser Graphics text (⚡ ⚔️ 🐉 ☯️ 🌀) or drawn shapes | No image assets; Graphics API is sufficient |

**Key decision — scene.launch vs scene.start:** Stack research (MEDIUM-HIGH confidence) and Architecture research differ here. `scene.sleep()` is superior: GameScene stays frozen in memory, tile map is not re-initialized on return, state is preserved. Use `scene.launch('BankScene', { elapsed, lives, tmAlive })` + `this.scene.sleep('GameScene')` in `_checkWin()`.

---

## Table Stakes (must work)

1. **Freeze bug fix** — entities permanently stuck is the top-priority bug; blocks all testing
2. **D-Pad touch controls** — game unplayable on iOS without this
3. **Winning path always reachable** — path-availability check before roadblock placement
4. **Visual freeze indicator** — countdown ring on frozen entity (child needs to know when they'll be free)
5. **Sound feedback** — freeze sting, unfreeze chime, slot win fanfare

## Differentiators (Ninjago feel)

1. **Teammate rescue** — teammate unfreezes player on contact ("meine Freunde haben mich gerettet!")
2. **Teammate-enemy freeze** — teammates physically intercept enemies (closes co-op loop)
3. **Named Ninjago teammates** — Kai/Zane/Jay/Cole name labels + canonical colors
4. **Bank scene transition** — camera zoom + fade + "BANK DER PRIME EMPIRE" title card
5. **Secret slot machine** — one of 8 has golden glow + musical spin sound

---

## Top 5 Pitfalls

| # | Pitfall | Mitigation |
|---|---------|-----------|
| 1 | **Re-collision loop after unfreeze** (C1) | `_separateTo(safeNeighbor)` on `_unfreeze()`; reset `thinkDelay=0` |
| 2 | **Mid-transit desync on freeze** (C2) | Snap `col=tCol; row=tRow; sprite.x/y` in `freeze()` before setting `moving=false` |
| 3 | **iOS AudioContext suspended** (F1) | Create + resume AudioContext synchronously in first `pointerdown` handler |
| 4 | **Slot RNG — child never wins** (F2) | Biased RNG: guarantee jackpot within 3–8 spins; reel settle-tween to symbol boundary |
| 5 | **D-Pad slide-off on iOS Safari** (M4) | Single-zone `pointermove` model; compute direction from delta vs D-Pad center |

---

## Recommended Build Order

```
Phase 1 — Bug Fixes + Controls
  ├── Fix freeze bug (C1 + C2): snap on freeze, separate on unfreeze, time.delayedCall
  ├── D-Pad touch controls (single-zone pointermove, safe-area offset)
  └── Henry-reference cleanup in prime-empire/

Phase 2 — Co-op AI + Bank Zone
  ├── Teammate-enemy freeze on contact
  ├── Teammate-rescues-player on contact
  └── Bank facade visual (T_GOAL zone → recognizable bank building)

Phase 3 — Bank Scene + Slot Machine
  ├── GameScene → BankScene transition (scene.launch + scene.sleep)
  ├── BankScene interior (8 slot machines, 1 golden/secret)
  ├── Slot mini-game (3 masked reels, tap-to-stop, biased win)
  └── Win sequence (key animation → "Abschnitt 2 kommt…" screen)

Phase 4 — Polish
  ├── Web Audio (copy tone() from 1x1-trainer; freeze/unfreeze/slot sounds)
  ├── Freeze countdown ring (arc animation on frozen entities)
  ├── Ninjago color palette + teammate name labels
  └── Difficulty balance (player 2500ms freeze, enemy 5000ms, enemy speed ≤ player speed)
```

---

## Architecture Summary

```
Module-level (shared, unchanged)
  MAP, generateMap(), bfsStep(), isWalkable(), drawNinja()
  ROADBLOCKS (Set — clear in every scene's create())

GameState (plain object, module-level)  ← new
  { playerLives, elapsed, tmAlive[] }
  Written by GameScene; read by BankScene init(data)

Entity hierarchy (unchanged)
  Entity → Player / Enemy / Teammate / Roadblock

Scenes (updated registration order)
  BootScene → GameScene → BankScene [new] → WinScene
                        → GameOverScene
  (BankScene is launched with scene.sleep; not a linear start chain)

Slot machine
  NOT a separate Phaser.Scene — built as _buildSlotUI() Container
  inside BankScene. Show/hide on secret machine interaction.
```

---

## Open Questions for Planning

- **Slot interaction trigger:** Does Luise walk into the machine tile, or tap/press a button? (affects BankScene movement model)
- **After jackpot win:** `scene.stop('GameScene')` (clean GC) or keep sleeping? (affects Abschnitt 2 integration later)
- **Reel symbols:** Drawn graphics shapes vs Unicode emoji text objects in Phaser?

---

*Research synthesis: 2026-05-10*
