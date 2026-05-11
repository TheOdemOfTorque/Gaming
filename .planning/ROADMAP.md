# Roadmap: Prime Empire — Abschnitt 1

**Mode:** Vertical MVP
**Created:** 2026-05-10
**Goal:** Luise navigiert durch die Stadt, kommt lebend zur Bank und löst die Slot-Maschine.
**Done when:** Jackpot → Schlüssel-Animation → "Abschnitt 2 kommt…" Screen erscheint.

---

## Phase 1 — Freeze-Bug Fix

**Goal:** Entities (Spieler, Gegner, Mitspieler) frieren korrekt ein und bewegen sich danach wieder — kein permanentes Hängenbleiben.
**Mode:** mvp

**Requirements:** FREEZE-01, FREEZE-02, FREEZE-03, FREEZE-04

**Plans:** 2 plans

Plans:
- [ ] 01-PLAN-A.md — Entity-Freeze-Core: C1+C2-Bugs beheben + tickFreeze durch delayedCall ersetzen (FREEZE-01, FREEZE-02)
- [ ] 01-PLAN-B.md — Asymmetrische Zeiten + Countdown-Ring (FREEZE-03, FREEZE-04)

**Deliverables:**
- `freeze()` snappt Sprite sofort auf Ziel-Tile (behebt C2 mid-transit desync)
- `_unfreeze()` ruft `_separateTo(safeNeighbor)` auf + reset `thinkDelay=0` (behebt C1 re-collision loop)
- `scene.time.delayedCall()` ersetzt manuelles `freezeMs -= delta`
- Asymmetrische Freeze-Zeiten: Spieler 2500ms, Gegner 5000ms
- Freeze-Countdown-Ring: `graphics.arc()` auf gefrorener Entity

**Success Criteria:**
- [ ] Entities bleiben nie permanent stehen nach Kontakt
- [ ] Kein Wanddurchlaufen nach Auftauen
- [ ] Sichtbarer Ring zählt bei gefrorener Entity runter

---

## Phase 2 — Touch-Controls + Cleanup

**Goal:** D-Pad erscheint auf iOS; Henry-Referenzen aus `prime-empire/` entfernt.
**Mode:** mvp

**Requirements:** DPAD-01, DPAD-02, DPAD-03, CLEAN-01

**Deliverables:**
- Virtuelles D-Pad (4 Richtungs-Zonen) rendert auf Screen (iOS + Desktop)
- Single-zone `pointermove` Modell: Richtung aus Touch-Delta relativ zum D-Pad-Zentrum (`Rectangle.Contains()`)
- Safe-Area-Offset via `env(safe-area-inset-bottom)` → Phaser Display-Scale
- `input.addPointer(3)` + Pointer-Polling in `update()`
- Alle "Henry"-Strings in `prime-empire/index.html` durch generische Texte ersetzt

**Success Criteria:**
- [ ] D-Pad erscheint und reagiert auf Touch (iOS Safari)
- [ ] Finger-Slide zwischen Buttons wechselt Richtung korrekt
- [ ] D-Pad nicht hinter iPhone Notch/Home-Indicator
- [ ] `grep -ri "henry" prime-empire/` liefert 0 Treffer

---

## Phase 3 — Co-op KI

**Goal:** KI-Mitspieler frieren Gegner ein und tragen sichtbare Ninja-Namen.
**Mode:** mvp

**Requirements:** COOP-01, COOP-02

**Deliverables:**
- Teammate-Enemy Kollisions-Check in `GameScene.update()` (analog zu Player-Enemy)
- Bei Kontakt: `enemy._freeze(5000)` aufrufen
- Invincibility-Window für Teammate nach Freeze (verhindert Sofort-Re-Freeze)
- Name-Labels: `scene.add.text()` über jedem Teammate-Sprite (Kai / Zane / Jay / Cole)
- Labels folgen Sprite-Position in `update()`

**Success Criteria:**
- [ ] Mitspieler frieren Gegner ein bei Berührung
- [ ] Kai / Zane / Jay / Cole Label sichtbar über jeweiligem Sprite
- [ ] Kein Sofort-Re-Freeze nach Teammate-Enemy Kontakt

---

## Phase 4 — Bank-Zone

**Goal:** Bank-Gebäude ist visuell als Ziel erkennbar; Erreichen löst dramatischen Szenenübergang aus.
**Mode:** mvp

**Requirements:** BANK-01, BANK-02

**Deliverables:**
- Bank-Fassade auf `T_GOAL`-Tiles: Fenster, Tür, "BANK"-Schild (Phaser Graphics)
- Pulsierendes Leuchten auf Bank-Tiles (Tween auf `alpha`)
- `_checkWin()`: `cameras.main.zoomTo(1.5, 1500)` → Fade-Out (0.4s) → Titel-Card "BANK DER PRIME EMPIRE" (gold, 1s) → `scene.launch('BankScene', {elapsed, lives, tmAlive})` + `this.scene.sleep('GameScene')`
- `BankScene.init(data)` empfängt State-Daten

**Success Criteria:**
- [ ] Bank-Gebäude visuell erkennbar auf Karte (Fassade + Schild)
- [ ] Kamera-Zoom → Fade → Titel-Card Sequenz läuft durch
- [ ] BankScene startet mit korrektem Spielstand (Leben, Zeit)

---

## Phase 5 — Bank-Interieur + Slot-Maschine

**Goal:** Bank zeigt 8 Slot-Automaten; geheimer startet 3-Walzen Mini-Game; Jackpot → Gewinn-Screen.
**Mode:** mvp

**Requirements:** BANK-03, BANK-04, SLOT-01, SLOT-02, SLOT-03, SLOT-04, SLOT-05

**Deliverables:**
- Bank-Interieur: 8 Slot-Automaten in einer Reihe (wärmere Tile-Farben, braun/gold)
- Einer mit goldenem Rahmen + pulsierendem Leuchten (der geheime)
- Spieler-Bewegung in BankScene (reduziertes Grid)
- Interaktion mit geheimem Automat (Tile-Nähe + Taste/Touch) → Slot-UI einblenden
- Slot-Reel-System: `Container` + `createGeometryMask()` + `repeat:-1` Tween
- 5 Ninjago-Symbole: ⚡ ⚔️ 🐉 ☯️ 🌀 (Phaser Text-Objekte im Container)
- Tap/Taste stoppt Walze 1 → 2 → 3 (Walze 3 verlangsamt 1.5s vor Stop)
- Biased RNG: Jackpot garantiert innerhalb von 3–8 Versuchen
- Walze stoppt auf Symbol-Boundary (Settle-Tween)
- Jackpot: Goldener Flash → Symbol-Scale-Animation → Schlüssel materialiert
- "ABSCHNITT 2 KOMMT…" Typewriter-Text → Fade
- Kein Verlier-Zustand: Nicht-Jackpot → kleine Feier-Animation + "Nochmal!"-Button
- `inputLocked` Flag: Slot-Interaktion blockiert D-Pad-Bewegung (F3 Pitfall)
- `ROADBLOCKS.clear()` in `BankScene.create()` (M6 Pitfall)

**Success Criteria:**
- [ ] 8 Automaten sichtbar, einer visuell hervorgehoben
- [ ] 3 Walzen drehen sich, Tap/Taste stoppt jede einzeln
- [ ] Walze 3 verlangsamt vor finalem Stop
- [ ] Jackpot erscheint innerhalb von ≤8 Versuchen
- [ ] Jackpot → Schlüssel → "ABSCHNITT 2 KOMMT…" Sequenz läuft durch
- [ ] Kein "Du hast verloren"-Screen existiert

---

## Phase 6 — Audio

**Goal:** Synthesized Sounds über Web Audio API für alle Key-Events; iOS-kompatibel.
**Mode:** mvp

**Requirements:** AUDIO-01, AUDIO-02

**Deliverables:**
- `tone()`-Hilfsfunktion (kopiert aus `1x1-trainer/index.html`) + `AudioContext` in `game.registry`
- `AudioContext` lazy-erstellt + `ctx.resume()` synchron im ersten `pointerdown`-Handler (iOS Unlock)
- `visibilitychange`-Listener: `ctx.resume()` wenn Seite wieder sichtbar
- Sounds: Einfrieren (tiefer Buzz 0.3s), Auftauen (aufsteigendes Chime 0.2s), Slot-Walze-Tick, Walze-Stop (Thunk), Jackpot-Fanfare (5-Noten, 1.5s), Bank-Eintritt (Chord)
- Sound-Aufrufe an allen relevanten Event-Punkten eingewoben

**Success Criteria:**
- [ ] Alle 6 Sound-Events spielen auf Desktop
- [ ] Alle 6 Sound-Events spielen auf iOS Safari (erster Touch entsperrt Audio)
- [ ] Kein AudioContext-Fehler in Safari DevTools

---

## Dependency Graph

```
Phase 1 (Freeze Fix)
  └─→ Phase 3 (Co-op KI braucht funktionierendes Freeze)
  └─→ Phase 4 (Bank-Entry: Spieler muss mobil sein)

Phase 2 (D-Pad)
  └─→ Alles (iOS-Spielbarkeit)

Phase 4 (Bank-Zone)
  └─→ Phase 5 (Bank-Interieur + Slot)

Phase 5 (Slot-Maschine)
  └─→ Phase 6 (Audio webt sich in Phase 5 ein)

Phase 6 kann parallel zu Phase 5 begonnen werden (tone() zuerst aufsetzen)
```

---

## Summary

| Phase | Titel | Requirements | Est. Complexity |
|-------|-------|--------------|-----------------|
| 1 | Freeze-Bug Fix | FREEZE-01..04 | Medium |
| 2 | Touch-Controls + Cleanup | DPAD-01..03, CLEAN-01 | Medium |
| 3 | Co-op KI | COOP-01..02 | Low |
| 4 | Bank-Zone | BANK-01..02 | Medium |
| 5 | Bank-Interieur + Slot | BANK-03..04, SLOT-01..05 | High |
| 6 | Audio | AUDIO-01..02 | Low |

**Total v1 Requirements covered: 21/21**

---

*Roadmap created: 2026-05-10*
*Last updated: 2026-05-11 Phase 1 geplant (2 Plans, 2 Waves)*
