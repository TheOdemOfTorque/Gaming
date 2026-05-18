---
phase: 01-freeze-bug-fix
plan: A
subsystem: ui
tags: [phaser3, game, entity, state-machine, timer]

# Dependency graph
requires: []
provides:
  - "Entity.freeze(ms) mit C2-Snap (col/row/sprite auf tCol/tRow vor frozen=true)"
  - "Entity._unfreeze() mit C1-Separation (_findSafeNeighbor + _separateTo)"
  - "delayedCall-basierte Freeze/Invincibility-Timer (_freezeTimer, _invincibleTimer)"
  - "Freeze-Countdown-Ring (_startFreezeRing/_stopFreezeRing mit tweens.addCounter + Graphics.arc)"
  - "Entity.destroy() canceliert Timer und Ring-Tween vor sprite.destroy()"
  - "Enemy._unfreeze() Override mit thinkDelay=0 fuer sofortiges Re-Pathfinding"
affects: [01-freeze-bug-fix-plan-B, prime-empire]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cancellable delayedCall — handle in Feld speichern, .remove(false) in destroy()/guard"
    - "Graphics als Sprite-Child — scene.make.graphics({add:false}) + sprite.add(child)"
    - "tweens.addCounter fuer lineare Fortschrittsanimation mit onUpdate-Callback"
    - "Guard + nullify teardown — if(handle){handle.remove(false);handle=null;}"

key-files:
  created: []
  modified:
    - prime-empire/index.html

key-decisions:
  - "tickFreeze-Delta-Counter durch scene.time.delayedCall ersetzt — Frame-Spike-sicher, pausiert mit Scene"
  - "C2-Snap auf tCol/tRow in freeze() — Ziel-Tile ist immer walkable (setTarget prueft isWalkable)"
  - "C1-Separation in _unfreeze() via _findSafeNeighbor — null-sicherer Fallback: Entity bleibt in Place, Invincibility laeuft trotzdem an"
  - "Enemy._unfreeze() Override mit thinkDelay=0 — verhindert Post-Freeze-Stillstand durch id*300ms-Delay"
  - "Teammate-Freeze-Zeit unveraendert bei 5000ms (symmetrisch zu Gegnern) — Open Question A1 aus RESEARCH.md bestaetigt"

patterns-established:
  - "Pattern: Freeze-State-Machine mit delayedCall statt Delta-Counter in update()"
  - "Pattern: Spatial Separation nach State-Exit (Entity trennt sich von Kollisionspartnern)"
  - "Pattern: Timer-Cancel in destroy() vor sprite.destroy() — verhindert Post-Destroy-Callback"

requirements-completed: [FREEZE-01, FREEZE-02, FREEZE-04]

# Metrics
duration: 25min
completed: 2026-05-11
---

# Phase 1 Plan A: Freeze-Bug Fix Summary

**Entity-Freeze-State-Machine mit delayedCall-Timer, C1/C2-Snap-Fixes und Countdown-Ring (tweens.addCounter + Graphics.arc)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-11T (Ausfuehrungsbeginn)
- **Completed:** 2026-05-11
- **Tasks:** 2 / 2
- **Files modified:** 1

## Accomplishments

- C2-Bug behoben: freeze() snappt col/row/sprite.x/y auf tCol/tRow wenn moving=true — kein Wanddurchlaufen nach Auftauen mehr
- C1-Bug behoben: _unfreeze() ruft _findSafeNeighbor() + _separateTo() vor Invincibility — keine Re-Collision-Loop mehr
- tickFreeze()-Delta-Counter durch scene.time.delayedCall ersetzt — kein Frame-Drift-Bug, pausiert automatisch mit der Phaser-Scene
- Freeze-Countdown-Ring implementiert via tweens.addCounter + Graphics.arc als Sprite-Child
- Entity.destroy() absichert Timer und Ring-Tween vor sprite.destroy() — kein Post-Destroy-Callback-Fehler wenn Teammate 0 Leben hat
- Enemy._unfreeze() Override setzt thinkDelay=0 fuer sofortiges Re-Pathfinding nach Auftauen

## Task Commits

Jeder Task wurde atomar committed:

1. **Task 1: Entity-Constructor + freeze() + _unfreeze() — C1+C2 Bugs + Timer-Refactor** — `4608a02` (fix)
2. **Task 2: tickFreeze-CallSites entfernt + destroy() + Enemy._unfreeze() Override** — `b326e5c` (fix)

## Files Created/Modified

- `prime-empire/index.html` — Entity-Freeze-State-Machine neu implementiert (C1+C2-Fix, delayedCall-Timer, Countdown-Ring, destroy()-Absicherung, Enemy-Override)

## Decisions Made

- **delayedCall statt Delta-Counter:** `tickFreeze()` komplett entfernt, Freeze/Invincibility-Timings durch `scene.time.delayedCall` gesteuert. Verhindert Frame-Spike-Bugs und haelt den Code im Einklang mit dem Phaser-Lifecycle.
- **C2-Snap auf Ziel-Tile:** In `freeze()` wird bei `moving=true` sofort auf `tCol/tRow` gesprungen. `setTarget()` prueft `isWalkable()` vor dem Setzen — Ziel-Tile ist garantiert begehbar.
- **C1-Separation mit Fallback:** `_findSafeNeighbor()` gibt `null` zurueck wenn alle Nachbarn belegt/Waende sind. `if(safe) _separateTo(safe.c,safe.r)` — kein Crash, Entity bleibt in Place. Kartentopologie bestätigt: Grenzfall praktisch nicht erreichbar.
- **Enemy._unfreeze() Override:** `thinkDelay` existiert nur in Enemy (initialisiert als `id*300`). Override in Enemy-Klasse statt Conditional in Entity-Basisklasse — sauberere Hierarchie.
- **Teammate-Freeze-Zeit 5000ms unveraendert:** FREEZE-03 spezifiziert nur Spieler (2500ms) und Gegner (5000ms). Teammates bleiben bei 5000ms (symmetrisch, vorhersagbares Co-op-Timing). Entscheid gemaess Open Question A1 aus RESEARCH.md.

## Deviations from Plan

Keine — Plan wurde exakt wie beschrieben ausgefuehrt.

Hinweis: Die Task-1-Acceptance-Criteria enthalten einen bekannten Widerspruch: "grep tickFreeze liefert 0 Treffer" ist nach Task 1 alleine nicht erfuellt (3 Call-Sites noch vorhanden), da diese erst in Task 2 entfernt werden. Holistische Verifikation nach Task 2 ergibt 0 Treffer — korrekt.

## Issues Encountered

- `prime-empire/` war nicht in git verfolgt (untracked directory in main repo). Loesung: `git add` mit explizitem `GIT_DIR`/`GIT_WORK_TREE` aus dem Hauptrepo-Verzeichnis in den Worktree-Branch gestaged. Erste Commit-Transaktion erstellt die Datei neu im Worktree-Branch (`create mode 100644 prime-empire/index.html`).

## User Setup Required

Keins — Single-file HTML Game, kein Build-Step, kein Server-Setup erforderlich.

Browsertest-Anleitung (optional, fuer manuelle Verifikation):
```bash
python3 -m http.server 8080 --directory /Users/marco/dev/gaming
# Dann: http://localhost:8080/prime-empire/
```
Erwartetes Verhalten: Spiel startet ohne Konsolenfehler. Spieler friert nach Feindkontakt ein (blauer Overlay + Countdown-Ring), taut nach ~3s auf und blinkt waehrend Invincibility.

## Next Phase Readiness

Plan A ist vollstaendig. Bereit fuer Plan B:
- Plan B (FREEZE-03): Asymmetrische Freeze-Zeiten (Spieler 2500ms, Gegner 5000ms) in `_checkCollisions()` Zeilen 733–736
- Plan B nutzt `freeze(ms)` direkt — keine weiteren Entity-Aenderungen erforderlich

---
*Phase: 01-freeze-bug-fix*
*Completed: 2026-05-11*
