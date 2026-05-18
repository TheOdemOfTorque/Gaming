# Feature Landscape: Prime Empire — Abschnitt 1

**Domain:** Pac-Man-style top-down browser game for children (Ninjago theme)
**Target player:** Luise, ~6-10 years old; design for the 6-year-old end (the constraining case)
**Milestone scope:** Brownfield — basic navigation exists; adding freeze fix, cooperative AI, slot machine, bank scene
**Researched:** 2026-05-10
**Overall confidence:** HIGH (code directly examined) / MEDIUM (child UX recommendations grounded in established principles)

---

## Table Stakes

Features the game must have or it feels broken / unfair to a child.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Freeze mechanic that actually unfreezes | Already coded but buggy — child notices immediately when game breaks | Low | Bug fix; 5s freeze + 3s invincibility already structured correctly in `Entity.tickFreeze` |
| Invincibility blink after freeze | Prevents instant double-punishment — child must be able to recover safely | Low | Already implemented via `_startBlink()` + 3000ms invincibleMs |
| Visual indicator that you ARE frozen | Child must understand why they can't move | Low | `_frozenOverlay` (blue circle) exists; add a visible countdown ring on top |
| D-Pad touch controls | Primary device is iOS; keyboard-only means the game doesn't work | Medium | Already in project requirements |
| Bank goal zone visually obvious | Child must know where they are going | Low | `T_GOAL` tiles exist but bank facade / signage needed |
| Teammates visually distinct from enemies | Child cannot apply co-op strategy if they cannot tell sides apart | Low | Color coding exists (green = teammate, warm red/pink = enemy) — reinforce |
| Recovery after enemy contact, not instant game-over | Age 6 cannot accept zero-tolerance failure | Low | 3-life system exists; invincibility window already correct |
| Sound feedback on key events | Immediate audio feedback essential for young players | Medium | Web Audio API: freeze sting, unfreeze chime, slot win fanfare |
| Winning path always reachable | Child must not get permanently stuck | Medium | BFS exists; roadblock system could block all paths — needs path-availability check |

---

## Differentiators

Features that make this "Ninjago / Prime Empire" rather than a generic Pac-Man clone.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Named Ninja teammates (Kai/Zane/Jay/Cole) | Emotional investment — "Zane is helping me!" | Low | Assign canonical Ninjago colors + name labels above sprites |
| Teammates physically intercept enemies | Co-op loop closes: ally rushes to enemy, freezes it, child escapes | Medium | Not currently implemented — teammate-enemy collision + freeze |
| Teammate rescue: unfreezes player on contact | "My friends rescued me" — emotional payoff of co-op theme | Medium | NOT implemented; highest-value missing feature |
| Cyberpunk Ninjago city aesthetic | Cohesive world-feel: neon, dark buildings, grid roads | Low | Already excellent in `_drawMap()` — extend to bank interior |
| Secret slot machine among 8 identical ones | Discovery moment — child feels clever finding the right one | Low | Visual differentiation (golden glow, different sound) |
| 3-reel tap-to-stop slot mechanic | Classic, instantly learnable, satisfying to control | Medium | Must feel earned, not purely random |
| Key unlock animation + "Abschnitt 2 kommt…" payoff | Narrative continuity; adventure continues | Low | Phaser tween + text sequence; celebration, not a menu |
| Bank scene as distinct interior space | Physical transition marks narrative progress | High | New Phaser scene + camera transition |

---

## Anti-Features

Things that frustrate children. Explicitly do NOT build these.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Restart from the very beginning on game-over | A 6yo will quit permanently after losing 20 minutes of progress | Respawn at start of current segment with lives remaining |
| Score / point counter visible during play | Numbers add cognitive load; kids this age are goal-oriented | Goal indicators only ("Bank: ↓", teammate count) |
| Near-miss slot feedback ("2 out of 3!") | Casino dark pattern exploiting disappointment | Every spin gives a positive response; never highlight "almost" |
| "You lose" state on slot machine | Pure loss with no recourse creates shutdown frustration | Consolation animation + "Nochmal!" button always |
| Tutorial text walls | A 6yo skips reading | Embed teaching in play: first freeze shows countdown ring |
| Time limit / countdown on the street | Constant clock pressure inappropriate for this age; creates anxiety | Use enemy pressure as pacing (already present) |
| Enemy speed that outpaces player | Child must feel agency | Current ratio: enemy 100px/s, player 128px/s — correct, do not close gap |
| Slot machine requiring 20+ attempts to win | Child loses interest after 3-4 tries | Design jackpot to hit within ~5-7 average attempts |

---

## Detailed UX: Four Key Areas

### 1. Cooperative AI Teammate Behavior

**Emotional goal:** Child feels "my ninja friends are protecting me."

**Two critical gaps identified in current code:**

**Gap 1 — Teammates do not freeze enemies on contact.** The freeze system only triggers on player-enemy collision in `GameScene.update()`. Teammate-enemy collision checking does not exist. Adding it closes the co-op loop entirely.

**Gap 2 — Teammates do not unfreeze the player.** A teammate walking past a frozen player and touching them should call `player._unfreeze()` immediately. This is the single highest-value feature for making AI feel like real teammates.

**Precise spec:**
- Within 12 tiles of player AND enemy within 12 tiles: BFS toward nearest enemy (current behavior, keep)
- On teammate-enemy contact: freeze that enemy for 5000ms (new)
- Player is frozen AND teammate within 6 tiles: BFS toward player; on contact, call `player._unfreeze()` (new)
- No enemy nearby: maintain offset formation around player (current behavior, keep)
- Name labels: small "Kai", "Zane", "Jay", "Cole" above each teammate sprite

### 2. Freeze Mechanic UX

**Asymmetric duration is essential:**
- **Player freeze: 2500ms** (reduced from 5000ms) — long enough to feel punishing, short enough to not cause shutdown
- **Enemy freeze: 5000ms** (keep or extend to 6000ms) — long enough for player to benefit from teammate intercept
- **Countdown ring:** Circular arc on frozen entity depleting from full to empty (Phaser `graphics.arc()` updated from `freezeMs / totalMs`)
- **Audio:** Freeze sting (low buzz, 0.3s) on contact; unfreeze chime (bright ascending tone, 0.2s) on release
- **Invincibility: 3000ms blink** — correct, do not reduce

### 3. Slot Machine Design

**Design principle:** Celebration mechanic, not gambling simulation.

**Reel behavior spec:**
- All 3 reels start spinning simultaneously at high speed
- First tap: reel 1 stops with "clunk" sound + scale-bounce (0.95→1.05→1.0, 150ms)
- Second tap: reel 2 stops same way
- **Third reel: automatically slows to ~30% speed for 1.5s before child taps** — anticipation moment
- Third tap: reel 3 stops

**Win probability:**
- 5 Ninjago symbols: lightning bolt, katana, dragon, yin-yang, shuriken
- Any 2 matching: ~50% probability — small celebration (confetti burst, ascending tone)
- Jackpot (3 matching): ~20% probability at the secret machine
- Non-secret machines: always return a result but never jackpot — "Diese Maschine funktioniert nicht"
- **No "you lose" state** — every spin resolves with small or large celebration

**Win animation sequence (jackpot):**
1. Reel 3 stops, all three match
2. 0.3s pause (anticipation)
3. Golden flash across machine
4. Symbols scale up, spin, emit particle sparks in Ninjago colors
5. Synth fanfare: ascending 5-note run, ~1.5s
6. Key materializes with glow animation (~1s)
7. "ABSCHNITT 2 KOMMT…" text fades in with typewriter effect
8. Total: ~4-5 seconds — earned but not dragging

### 4. Scene Transition (Street → Bank)

**What makes it dramatic:**
- **Anticipation pause:** 0.3s stillness after hitting T_GOAL tiles before anything moves
- **Camera dolly:** `cameras.main.zoomTo(1.5, 1500)` toward bank entrance
- **Audio crossfade:** Street ambient fades, interior tone begins
- **Fade + title card:** 0.4s black → "BANK DER PRIME EMPIRE" in gold (1s) → fade to interior
- **Total duration: ~2.5s** for first visit; subsequent entries: fade only (0.4s)

**Bank interior:**
- Warmer tile colors (brown/gold vs dark/neon exterior)
- 8 slot machines in a row; one at far end with golden frame + pulsing glow
- Player walks among machines; approach + interact (tap/spacebar) triggers slot game

---

## Feature Dependencies

```
Freeze bug fix → Teammate rescue mechanic
Freeze bug fix → Bank scene (player must be mobile when entering)
Bank facade rendering → Scene transition
Bank scene interior → Slot machine mini-game
Slot machine jackpot → Key animation → "Abschnitt 2" screen
D-Pad controls → Everything (iOS playability gates all other features)
```

---

## Recommended Build Order

1. **Freeze bug fix** — unblocks everything
2. **D-Pad touch controls** — unblocks iOS testing
3. **Teammate rescue + enemy freeze on contact** — closes co-op loop
4. **Bank visual zone** — facade rendering + T_GOAL visual upgrade
5. **Bank scene transition** — camera zoom + fade + title card + interior
6. **Bank interior + slot machine UI** — 8 machines rendered, one distinct
7. **Slot mini-game** — 3 reels, tap-to-stop, win detection, celebration
8. **Sound design** — weave in as each feature is built

---

*Feature research: 2026-05-10*
