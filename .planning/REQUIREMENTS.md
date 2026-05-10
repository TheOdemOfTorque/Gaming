# Requirements: Prime Empire — Abschnitt 1

**Defined:** 2026-05-10
**Core Value:** Luise navigiert durch die Stadt, kommt lebend zur Bank und löst die Slot-Maschine — das muss reibungslos und spaßig funktionieren.

## v1 Requirements

### Freeze-Bugfix

- [ ] **FREEZE-01**: Entities (Spieler, Gegner, Mitspieler) bewegen sich nach 5 Sekunden Einfrieren immer wieder selbstständig weiter — kein permanentes Hängenbleiben
- [ ] **FREEZE-02**: Entities springen beim Einfrieren sofort auf ihre Zieltile (kein Wanddurchlaufen nach dem Auftauen)
- [ ] **FREEZE-03**: Spieler-Einfrierzeit: 2,5 Sekunden; Gegner-Einfrierzeit: 5 Sekunden (asymmetrisch)
- [ ] **FREEZE-04**: Freeze-Countdown-Ring: Eingefrorene Entity zeigt einen visuellen Kreis-Zähler der sich leert

### Touch-Controls

- [ ] **DPAD-01**: Virtuelles D-Pad erscheint auf dem Screen (iOS + Desktop)
- [ ] **DPAD-02**: Finger von einem Button zum nächsten ziehen wechselt die Richtung korrekt (kein Richtungsverlust beim Slide)
- [ ] **DPAD-03**: D-Pad respektiert Safe-Area-Insets auf notched iPhones

### Cleanup

- [ ] **CLEAN-01**: Alle Referenzen auf den Namen "Henry" sind aus `prime-empire/` entfernt

### Co-op KI

- [ ] **COOP-01**: Mitspieler-Entities frieren Gegner ein wenn sie diese berühren (5 Sekunden)
- [ ] **COOP-02**: Mitspieler haben sichtbare Ninjago-Namen (Kai / Zane / Jay / Cole) als Label über ihrem Sprite

### Bank-Szene

- [ ] **BANK-01**: Bank-Gebäude ist als visuell erkennbares Ziel auf der Stadtkarte dargestellt (Fassade + Schild)
- [ ] **BANK-02**: Das Erreichen der Bank löst eine dramatische Szenenübergang aus: Kamera-Zoom → Fade → "BANK DER PRIME EMPIRE" Titel-Card
- [ ] **BANK-03**: Bank-Interieur zeigt 8 Slot-Automaten; einer davon hat goldenen Rahmen und pulsierendes Leuchten (der geheime)
- [ ] **BANK-04**: Interaktion mit dem geheimen Automaten startet das 3-Walzen Slot-Mini-Game

### Slot-Mini-Game

- [ ] **SLOT-01**: 3 Walzen drehen sich gleichzeitig; jede wird durch Antippen (Touch) oder beliebige Taste gestoppt
- [ ] **SLOT-02**: Dritte Walze verlangsamt automatisch auf 30% Geschwindigkeit für 1,5 Sekunden vor dem finalen Stopp (Spannungs-Beat)
- [ ] **SLOT-03**: Drei gleiche Symbole = Jackpot; garantiert innerhalb von 3–8 Versuchen durch biased RNG
- [ ] **SLOT-04**: Jackpot löst Gewinn-Sequenz aus: Schlüssel-Animation + "ABSCHNITT 2 KOMMT…" Screen mit Typewriter-Effekt
- [ ] **SLOT-05**: Kein "Du hast verloren"-Zustand: Nicht-Jackpot-Versuche zeigen eine kleine Feier-Animation + "Nochmal!"-Button

### Audio

- [ ] **AUDIO-01**: Synthesized Sounds über Web Audio API: Einfrieren (Eis-Abstieg), Auftauen (Aufstiegs-Chime), Slot-Walze-Tick, Walze-Stop, Jackpot-Fanfare, Bank-Eintritt
- [ ] **AUDIO-02**: Audio funktioniert auf iOS Safari (AudioContext wird in erstem Touch-Handler entsperrt)

## v2 Requirements

### Co-op KI (erweitert)

- **COOP-V2-01**: Mitspieler befreit eingefrorenen Spieler durch Berühren (Rescue-Mechanik)
- **COOP-V2-02**: Richtungspfeil zeigt kurzfristig an, welchen Gegner ein Mitspieler gerade anpeilt

### Karte

- **MAP-V2-01**: Choke-Tile-Schutz: Engpass-Tiles (col-5-Bypass) können nicht durch Roadblocks blockiert werden
- **MAP-V2-02**: Roadblocks materialisiern nie unter dem Spieler oder einem Mitspieler

### Performance

- **PERF-V2-01**: BFS nutzt Index-Pointer statt `q.shift()` (O(1) Dequeue) + 800ms Retry-Backoff nach null-Return

## Out of Scope

| Feature | Grund |
|---------|-------|
| Abschnitt 2 (Welt 1) | Kommt in einer späteren Phase |
| Welt 2 und Welt 3 | Zukünftige Meilensteine |
| Unity-Migration | Für spätere Welten erwägen |
| Mitspieler rettet Spieler (Rescue) | Verschoben auf v2 — Grundmechanik wichtiger |
| Nutzerverwaltung / Persistenz / Highscores | Kein Bedarf für Abschnitt 1 |
| Hard-coded Name "Luise" im Code | UI bleibt generisch |
| Countdown-Timer/Zeitlimit im Straßennetz | Erzeugt Stress; Gegner-Druck reicht als Pacing |
| "Du verlierst"-Zustand im Slot-Game | Anti-Pattern für Kinder; immer Nochmal-Option |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FREEZE-01 | Phase 1 | Pending |
| FREEZE-02 | Phase 1 | Pending |
| FREEZE-03 | Phase 1 | Pending |
| FREEZE-04 | Phase 1 | Pending |
| DPAD-01 | Phase 2 | Pending |
| DPAD-02 | Phase 2 | Pending |
| DPAD-03 | Phase 2 | Pending |
| CLEAN-01 | Phase 2 | Pending |
| COOP-01 | Phase 3 | Pending |
| COOP-02 | Phase 3 | Pending |
| BANK-01 | Phase 4 | Pending |
| BANK-02 | Phase 4 | Pending |
| BANK-03 | Phase 5 | Pending |
| BANK-04 | Phase 5 | Pending |
| SLOT-01 | Phase 5 | Pending |
| SLOT-02 | Phase 5 | Pending |
| SLOT-03 | Phase 5 | Pending |
| SLOT-04 | Phase 5 | Pending |
| SLOT-05 | Phase 5 | Pending |
| AUDIO-01 | Phase 6 | Pending |
| AUDIO-02 | Phase 6 | Pending |

**Coverage:**
- v1 Requirements: 21 total
- Phasen zugeordnet: 21
- Nicht zugeordnet: 0 ✓

---
*Requirements defined: 2026-05-10*
*Last updated: 2026-05-10 after initial definition*
