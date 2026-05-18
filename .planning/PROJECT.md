# Prime Empire – Abschnitt 1

## What This Is

Ein Ninjago-inspiriertes Browser-Spiel für Luise: Top-Down-2D (Pac-Man-Stil), in dem der Spieler durch ein Straßennetzwerk navigiert, KI-Teammitglieder koordiniert, Gegner ausweicht und schließlich in einer Bank eine geheime Slot-Maschine findet. Das Spiel läuft direkt im Browser (Desktop + iOS Safari), ohne Build-Schritt. Es ist Abschnitt 1 von Welt 1 einer geplanten 3-Welten-Geschichte.

## Core Value

Luise navigiert durch die Stadt, kommt lebend zur Bank und löst die Slot-Maschine — das muss reibungslos und spaßig funktionieren.

## Requirements

### Validated

- ✓ Tile-basierte Stadtkarte rendert (17×58 Grid, europäisches Straßennetz mit Sackgassen und Abkürzungen) — bestehend
- ✓ Spieler bewegt sich via Pfeiltasten durch das Straßennetz — bestehend
- ✓ 5 KI-Entities (1 Player, 4 Teammates, 5 Enemies) mit BFS-Pathfinding — bestehend
- ✓ Freeze-Mechanik bei Kontakt (Entities pausieren) — bestehend (buggy)
- ✓ Phaser-Scenes: Boot, GameScene, GameOver, Win — bestehend
- ✓ Ninjago-Ninja-Grafik (drawNinja mit Cape, Körper, Typen) — bestehend

### Active

- [ ] Freeze-Bug fixen: Entities müssen sich nach 5 Sekunden wieder bewegen (aktuell bleiben sie hängen)
- [ ] D-Pad Touch-Controls für iOS (virtuelle Pfeiltasten on-screen)
- [ ] Henry-Referenzen aus prime-empire/ entfernen (kein Hard-Coding von Namen)
- [ ] Bank-Gebäude als Zielzone: visuell erkennbar (Fassade, Schild), nicht nur T_GOAL-Tiles
- [ ] Bank-Szene: 8 Slot-Automaten in der Bank, einer davon ist geheim
- [ ] Klassisches 3-Walzen Slot-Maschinen-Mini-Spiel: Walzen drehen, Touch/Taste stoppt jede einzeln
- [ ] Gewinn-Bedingung: 3 gleiche Symbole → Schlüssel-Animation → "Abschnitt 2 kommt…"-Screen
- [ ] Ninjago-Farbpalette + synthesized Sound (Web Audio API)
- [ ] Mittlere Schwierigkeit: balanciert für Kinder, herausfordernd aber nicht frustrierend

### Out of Scope

- Abschnitt 2 (Welt 1) — kommt in einer späteren Phase
- Welt 2 und Welt 3 — zukünftige Meilensteine
- Unity-Migration — für spätere Welten erwägen
- Nutzerverwaltung, Highscores, Persistenz — kein Bedarf für Abschnitt 1
- Hard-coded Name "Luise" im Code — UI bleibt generisch oder konfigurierbar

## Context

- Brownfield: Prototyp `prime-empire/index.html` (~855 Zeilen) existiert, gebaut mit Phaser 3 von CDN
- Das Mono-Repo enthält 4 Spiele; prime-empire folgt dem "Single-File HTML"-Pattern
- Parallelprojekt 1x1-trainer (für Henry/andere Spieler) zeigt bewährtes Muster: Pure-Logic in `logic.js`, State-Migrations, Web-Audio
- Zielgerät iOS (primär) + Desktop Mac; `env(safe-area-inset-*)`, `100dvh`, `touch-action:none` schon in Verwendung
- Laufzeitabhängigkeit: `phaser@3.90.0` von CDN (kein Offline-Fallback)

## Constraints

- **Technologie**: Kein Build-Schritt — reines HTML5/CSS3/JS, alles in einer `index.html`-Datei
- **Framework**: Phaser 3 (`3.90.0` von CDN) — Spielengine bleibt unveränderlich für Abschnitt 1
- **Audio**: Web Audio API synthesized — keine Audiodateien (kein Server-Overhead, iOS-kompatibel)
- **Sprache**: Alle UI-Texte auf Deutsch
- **Plattform**: Desktop-Browser + iOS Safari; touch-first design

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phaser 3 als Engine | Bereits implementiert, CDN-geladen, keine Installation nötig | — Pending |
| Single-file HTML | Mono-Repo-Konvention; kein Build-Step, einfaches Deployment | ✓ Gut |
| Slot-Maschine: 3 Walzen, Tap-to-Stop | Einfach, intuitiv für Kinder, klassisches Game-in-Game-Gefühl | — Pending |
| D-Pad für Mobile | Direktionale Steuerung passt zu Grid-basiertem Pac-Man-Gameplay | — Pending |
| Medium-Difficulty | Luise soll Spaß haben, nicht frustriert werden | — Pending |

## Evolution

Dieses Dokument entwickelt sich bei Phasen-Übergängen und Meilenstein-Grenzen.

**Nach jeder Phase** (via `/gsd-transition`):
1. Requirements invalidiert? → Nach Out of Scope mit Begründung
2. Requirements validiert? → Nach Validated mit Phasen-Referenz
3. Neue Requirements? → Nach Active
4. Entscheidungen? → Zu Key Decisions hinzufügen
5. "What This Is" noch korrekt? → Aktualisieren falls nötig

**Nach jedem Meilenstein** (via `/gsd-complete-milestone`):
1. Vollständige Review aller Abschnitte
2. Core Value Check — noch die richtige Priorität?
3. Out of Scope prüfen — Begründungen noch valide?
4. Context aktualisieren

---
*Last updated: 2026-05-10 nach Initialisierung*
