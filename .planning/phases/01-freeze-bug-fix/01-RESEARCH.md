# Phase 1: Freeze-Bug Fix — Research

**Researched:** 2026-05-11
**Domain:** Phaser 3 Entity-State-Machine, Timer-API, Graphics-API (Brownfield — single-file HTML)
**Confidence:** HIGH

---

## Zusammenfassung (Summary)

Das Freeze-System in `prime-empire/index.html` hat zwei strukturelle Bugs.
**C1** ("Re-Collision Loop"): Nach dem Auftauen gibt es keine räumliche Trennung der Entities —
sie überlappen weiterhin, werden beim nächsten Frame sofort wieder eingefroren und bleiben
dauerhaft stecken.
**C2** ("Mid-Transit Desync"): `freeze()` setzt `moving=false` ohne den Sprite auf die Ziel-Tile
zu snappen — nach dem Auftauen startet die Entity von einer Zwischen-Position und läuft scheinbar
durch Wände.

Beide Bugs lassen sich mit gezielten Änderungen in der `Entity`-Basisklasse (< 60 neue Zeilen)
beheben. Zusätzlich wird der manuelle `tickFreeze`-Counter durch `scene.time.delayedCall`
ersetzt (lifecycle-sicher, kein Delta-Drift) und der Freeze-Countdown-Ring mit
`tweens.addCounter` + `Graphics.arc` implementiert.

**Primary recommendation:** Alle vier Fixes in der `Entity`-Klasse und an den zwei
Kollisions-Call-Sites umsetzen. Keine neue Datei, keine neue Klasse — alles in `index.html`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Entity-Freeze-Zustand | Browser / Client | — | Phaser-managed in-memory state |
| Freeze-Timer | Browser / Client | — | `scene.time.delayedCall` bleibt im Canvas-Loop |
| Countdown-Ring (FREEZE-04) | Browser / Client | — | Phaser Graphics child des Sprite-Containers |
| Asymmetrische Freeze-Zeit (FREEZE-03) | Browser / Client | — | Call-Site-Parameter in `_checkCollisions()` |
| Spatial Separation (C1-Fix) | Browser / Client | — | Liest `scene.player/enemies/teammates` direkt |

Alle Capabilities sind Single-Tier (Browser/Client). Das Spiel hat keinen Server.

---

## Project Constraints (from CLAUDE.md)

- **Single-file HTML:** Alle JS + CSS in `prime-empire/index.html`. Keine separaten `.js`-Dateien.
- **Phaser 3.90.0** via CDN (unveränderlich, kein npm).
- **Kein Build-Step** — direkt im Browser öffnen.
- **UI-Text auf Deutsch** — alle sichtbaren Labels/Strings auf Deutsch.
- **iOS + Desktop** — touch-action:none, safe-area-insets berücksichtigen.
- **Keine Henry-Referenzen** in `prime-empire/` (wird in Phase 2 bereinigt, hier nicht relevant).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FREEZE-01 | Entities bewegen sich nach Einfrieren immer wieder weiter — kein permanentes Hängenbleiben | C1-Fix: `_separateTo()` in `_unfreeze()` + `thinkDelay=0` verhindert Re-Collision-Loop |
| FREEZE-02 | Entities springen beim Einfrieren sofort auf ihre Zieltile (kein Wanddurchlaufen) | C2-Fix: Snap `col=tCol; row=tRow; sprite.x/y` in `freeze()` vor `moving=false` |
| FREEZE-03 | Spieler-Einfrierzeit 2500ms; Gegner-Einfrierzeit 5000ms (asymmetrisch) | Call-Site-Änderung in `_checkCollisions()` Zeilen 733–736 |
| FREEZE-04 | Freeze-Countdown-Ring: visueller Kreis-Zähler der sich leert | `tweens.addCounter` + `Graphics.arc()` als Child von `this.sprite` |
</phase_requirements>

---

## Standard Stack

### Kern (alle bereits im Projekt vorhanden)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser 3 | 3.90.0 (CDN, locked) | Game engine | Bereits in Produktion |
| Phaser `Time.Clock` | — (Teil von Phaser 3) | `scene.time.delayedCall` | Lifecycle-sicher, kein Delta-Drift |
| Phaser `Tweens` | — (Teil von Phaser 3) | `tweens.addCounter` für Ring-Animation | Offiziell unterstützt, sauber cancellierbar |
| Phaser `Graphics` | — (Teil von Phaser 3) | `arc()` + `strokePath()` für Ring | Bereits für `_frozenOverlay` genutzt |

**Keine neuen Abhängigkeiten.** Alle benötigten APIs sind in `phaser@3.90.0` enthalten.
[VERIFIED: Context7 /phaserjs/phaser — `tweens.addCounter`, `Graphics.arc`, `Graphics.strokePath`]

---

## Fundstellen im Code (Exact Line Numbers)

Alle Zeilenangaben beziehen sich auf `/Users/marco/dev/gaming/prime-empire/index.html`
und wurden durch direktes Lesen der Datei verifiziert. [VERIFIED: codebase grep]

| Symbol | Zeilen | Relevanz |
|--------|--------|----------|
| `Entity` constructor | 192–211 | `_frozenOverlay` anlegen; hier auch `_freezeRing` anlegen |
| `Entity.freeze()` | 217–224 | **C2-Bug hier**: `moving=false` ohne Snap, `freezeMs=ms` statt `delayedCall` |
| `Entity._unfreeze()` | 225–232 | **C1-Bug hier**: kein `_separateTo()`, `invincibleMs=3000` statt `delayedCall` |
| `Entity._startBlink()` | 233–236 | Unverändert — bleibt |
| `Entity._stopBlink()` | 237–240 | Unverändert — bleibt |
| `Entity.tickFreeze()` | 241–244 | **Wird komplett gelöscht** (ersetzt durch Timer) |
| `Entity.setTarget()` | 245–250 | Unverändert |
| `Entity._moveTo()` | 253–261 | Unverändert |
| `Entity.destroy()` | 262–266 | **Muss erweitert werden**: Timer + Ring-Tween canceln |
| Enemy-Teammate-Kollision | 722–724 | `e.freeze(5000)`, `tm.freeze(5000)` — Teammate-Zeit unklar (→ Open Question) |
| Enemy-Player-Kollision | 733–736 | `e.freeze(3000)`, `player.freeze(3000)` — **FREEZE-03: ändern zu 5000 / 2500** |
| `Player.update()` | 282–289 | Ruft `tickFreeze(delta)` auf — Call nach Refactor entfernen |
| `Enemy.update()` | 317–325 | Ruft `tickFreeze(delta)` auf — Call nach Refactor entfernen |
| `Teammate.update()` | 363–368 | Ruft `tickFreeze(delta)` auf — Call nach Refactor entfernen |

---

## Architektur-Muster

### Bestehende Entity-Hierarchie

```
Entity (Basisklasse, Zeilen 191–267)
  ├── Player  (Zeilen 272–290)
  ├── Enemy   (Zeilen 297–349)
  ├── Teammate (Zeilen 356–381)
  └── Roadblock (eigenständig, kein Entity-Erbe)
```

Der gesamte Freeze-Fix landet in `Entity` und an zwei Call-Sites in `GameScene._checkCollisions()`.
Unterklassen werden nur minimal angefasst: `Enemy` überschreibt `_unfreeze()` (für `thinkDelay=0`).

### Datenfluss nach dem Fix

```
Freeze ausgelöst (Kollision)
  → Entity.freeze(ms)
      ├── [C2-Fix] if moving: snap col/row/sprite.x/y to tCol/tRow
      ├── frozen=true, moving=false
      ├── _frozenOverlay.setVisible(true)
      ├── _freezeTimer = scene.time.delayedCall(ms, _unfreeze)
      └── _startFreezeRing(ms)   ← neu (FREEZE-04)

Freeze läuft ab (Timer feuert)
  → Entity._unfreeze()
      ├── frozen=false
      ├── _frozenOverlay.setVisible(false)
      ├── _stopFreezeRing()      ← neu
      ├── [C1-Fix] _separateTo() — snap zu freiem Nachbar-Tile
      ├── invincible=true
      └── _invincibleTimer = scene.time.delayedCall(3000, () => invincible=false)

Enemy._unfreeze() (Override)
  → super._unfreeze()
  → this.thinkDelay = 0   ← sofortiges Re-Pathfinding
```

---

## Fix-Strategie: C2 — Mid-Transit Desync

**Bug (Zeilen 217–224):** `freeze()` setzt `moving=false` ohne Sprite-Position zu korrigieren.
Wenn eine Entity mitten zwischen zwei Tiles eingefroren wird, ist `sprite.x/y` zwischen
`tc(col,row)` und `tc(tCol,tRow)`. Nach dem Auftauen startet `_decide()` von `(col,row)` —
dem Ausgangstile — und die Entity "springt" scheinbar durch die Zwischenposition.

**Fix:**

```javascript
freeze(ms) {
  if (this.frozen || this.invincible) return false;

  // C2-Fix: snap to target tile if mid-transit
  if (this.moving) {
    this.col = this.tCol;
    this.row = this.tRow;
    const pos = tc(this.tCol, this.tRow);
    this.sprite.x = pos.x;
    this.sprite.y = pos.y;
    this._syncGlow();
  }

  this.frozen = true;
  this.moving = false;
  this._frozenOverlay.setVisible(true);
  this.glow1.setFillStyle(0x6688AA, 0.12);
  this.glow2.setFillStyle(0x6688AA, 0.05);

  // Cancel any existing timer before starting new one
  if (this._freezeTimer) this._freezeTimer.remove(false);
  this._freezeTimer = this.scene.time.delayedCall(ms, () => this._unfreeze(), [], this);

  this._startFreezeRing(ms); // FREEZE-04

  return true;
}
```

**Warum `tCol/tRow` sicher ist:** `setTarget(c,r)` prüft `isWalkable(c,r)` bevor es
`tCol/tRow` setzt (Zeile 246). Das Ziel-Tile ist also immer begehbar.
[VERIFIED: codebase — Zeile 246 `if(!isWalkable(c,r)) return false;`]

---

## Fix-Strategie: C1 — Post-Unfreeze Re-Collision Loop

**Bug (Zeilen 225–232):** `_unfreeze()` macht die Entity sichtbar und invincible, aber
bewegt sie nicht. Wenn zwei Entities nach dem Auftauen noch überlappen und die Invincibility
nach 3000ms abläuft, löst der nächste Frame sofort wieder eine Kollision aus → Endlosschleife.

**Fix — `_separateTo()` Helper:**

```javascript
_separateTo(targetC, targetR) {
  // Snap col/row/sprite to given tile; update glow
  this.col = targetC;
  this.row = targetR;
  this.tCol = targetC;
  this.tRow = targetR;
  const pos = tc(targetC, targetR);
  this.sprite.x = pos.x;
  this.sprite.y = pos.y;
  this._syncGlow();
}

_findSafeNeighbor() {
  // Check 4 orthogonal neighbors; return first that is walkable and not occupied
  const scene = this.scene;
  const occupied = new Set();
  if (scene.player) occupied.add(`${scene.player.col},${scene.player.row}`);
  if (scene.enemies) scene.enemies.forEach(e => { if (e !== this) occupied.add(`${e.col},${e.row}`); });
  if (scene.teammates) scene.teammates.forEach(t => { if (t !== this) occupied.add(`${t.col},${t.row}`); });

  for (const [dc, dr] of Object.values(DIRS)) {
    const nc = this.col + dc, nr = this.row + dr;
    if (isWalkable(nc, nr) && !occupied.has(`${nc},${nr}`)) return { c: nc, r: nr };
  }
  return null; // corner case: completely surrounded; stay in place
}

_unfreeze() {
  this.frozen = false;
  this._freezeTimer = null;
  this._frozenOverlay.setVisible(false);
  this.glow1.setFillStyle(this.bodyColor, 0.17);
  this.glow2.setFillStyle(this.bodyColor, 0.07);
  this._stopFreezeRing(); // FREEZE-04

  // C1-Fix: spatial separation before invincibility
  const safe = this._findSafeNeighbor();
  if (safe) this._separateTo(safe.c, safe.r);

  this.invincible = true;
  if (this._invincibleTimer) this._invincibleTimer.remove(false);
  this._invincibleTimer = this.scene.time.delayedCall(3000, () => {
    this.invincible = false;
    this._invincibleTimer = null;
    this._stopBlink();
  }, [], this);
  this._startBlink();
}
```

**Enemy-Override für `thinkDelay`:**

```javascript
// In Enemy class, add:
_unfreeze() {
  super._unfreeze();
  this.thinkDelay = 0; // force immediate re-pathfinding
}
```

**Warum `thinkDelay` nur in Enemy:** `thinkDelay` existiert ausschließlich auf `Enemy`
(Zeile 303: `this.thinkDelay=id*300`). Player und Teammate haben dieses Feld nicht.
Daher Override in Enemy statt Conditional in Entity. [VERIFIED: codebase]

---

## Fix-Strategie: FREEZE-03 — Asymmetrische Freeze-Zeiten

**Änderung an Zeilen 733–736 (`_checkCollisions`):**

```javascript
// Vorher:
e.freeze(3000);
this.player.lives = Math.max(0, this.player.lives - 1);
this.player.freeze(3000);

// Nachher (FREEZE-03):
e.freeze(5000);           // Gegner: 5 Sekunden
this.player.lives = Math.max(0, this.player.lives - 1);
this.player.freeze(2500); // Spieler: 2,5 Sekunden
```

**Zeilen 722–724 (Enemy-Teammate-Kollision) — unverändert bei 5000ms für Gegner.**
Die Teammate-Freeze-Zeit ist eine Open Question (siehe unten).
[VERIFIED: codebase — aktuelle Werte: e.freeze(5000) Zeile 722, tm.freeze(5000) Zeile 724]

---

## Implementation: FREEZE-04 — Countdown-Ring

**API-Verifikation:** `tweens.addCounter(config)` und `Graphics.arc()` + `Graphics.strokePath()`
sind in Phaser 3.90.0 dokumentiert und verfügbar.
[VERIFIED: Context7 /phaserjs/phaser]

**Pattern:**

```javascript
_startFreezeRing(ms) {
  // Lazy-create the ring graphics as child of sprite container
  if (!this._freezeRing) {
    this._freezeRing = this.scene.make.graphics({ x: 0, y: 0, add: false });
    this.sprite.add(this._freezeRing);
  }
  this._freezeRing.setVisible(true);

  const radius = this.size * 0.60;
  const startAngle = -Math.PI / 2; // 12 o'clock

  if (this._freezeRingTween) this._freezeRingTween.stop();
  this._freezeRingTween = this.scene.tweens.addCounter({
    from: 1,
    to: 0,
    duration: ms,
    ease: 'Linear',
    onUpdate: (tween) => {
      const progress = tween.getValue(); // 1.0 → 0.0
      this._freezeRing.clear();
      if (progress <= 0) return;
      this._freezeRing.lineStyle(3, 0xAADDFF, 0.90);
      this._freezeRing.beginPath();
      this._freezeRing.arc(0, 0, radius, startAngle, startAngle + progress * Math.PI * 2, false);
      this._freezeRing.strokePath();
    },
    onComplete: () => {
      this._freezeRing.setVisible(false);
      this._freezeRingTween = null;
    }
  });
}

_stopFreezeRing() {
  if (this._freezeRingTween) {
    this._freezeRingTween.stop();
    this._freezeRingTween = null;
  }
  if (this._freezeRing) {
    this._freezeRing.clear();
    this._freezeRing.setVisible(false);
  }
}
```

**Warum als Child von `this.sprite`:** `_frozenOverlay` (Zeile 206–209) ist bereits ein
`make.graphics({ add: false })`-Objekt im Sprite-Container. Dasselbe Pattern ist idiomatisch
und bewegt den Ring automatisch mit dem Sprite — kein separates Positionen-Tracking nötig.
[VERIFIED: codebase — Zeilen 204–210]

**Winkel-Konvention:** `arc(x, y, radius, startAngle, endAngle, anticlockwise)` — Winkel in
Radians. `startAngle = -Math.PI/2` ist 12 Uhr (oben). Ring läuft im Uhrzeigersinn (anticlockwise=false).
[VERIFIED: Context7 /phaserjs/phaser — Graphics.arc Signatur]

---

## tickFreeze-Refactor

`Entity.tickFreeze()` (Zeilen 241–244) wird **vollständig gelöscht**. Die Methode wird an
drei Stellen aufgerufen:

| Aufrufort | Zeile | Aktion |
|-----------|-------|--------|
| `Player.update()` | 284 | `this.tickFreeze(delta);` — löschen |
| `Enemy.update()` | 318 | `this.tickFreeze(delta);` — löschen |
| `Teammate.update()` | 364 | `this.tickFreeze(delta);` — löschen |

Instanzvariablen `freezeMs` und `invincibleMs` aus dem Constructor (Zeilen 195–196) ebenfalls
löschen (`this.freezeMs=0; this.invincibleMs=0;`).

Neue Timer-Referenzen im Constructor initialisieren:
```javascript
this._freezeTimer = null;
this._invincibleTimer = null;
this._freezeRingTween = null;
this._freezeRing = null;  // lazy-created in _startFreezeRing
```

---

## Entity.destroy() — notwendige Erweiterungen

Die bestehende `destroy()`-Methode (Zeilen 262–266) muss Timer und Ring-Tween canceln,
sonst feuern diese nach dem Zerstören der Entity (z.B. wenn ein Teammate 0 Leben hat):

```javascript
destroy() {
  this._stopBlink();
  this._stopFreezeRing();
  if (this._freezeTimer) { this._freezeTimer.remove(false); this._freezeTimer = null; }
  if (this._invincibleTimer) { this._invincibleTimer.remove(false); this._invincibleTimer = null; }
  this.sprite.destroy(true);
  this.glow1.destroy();
  this.glow2.destroy();
}
```

**Warum kritisch:** Zeile 727 `tm.destroy()` feuert wenn ein Teammate 0 Leben hat.
Ohne Timer-Cancel würde `_unfreeze()` nach dem Destroy auf `this.scene.teammates`
zugreifen (bereits gelöscht) → Runtime Error. [VERIFIED: codebase — Zeile 727]

---

## Don't Hand-Roll

| Problem | Nicht bauen | Stattdessen | Warum |
|---------|-------------|-------------|-------|
| Freeze-Timer | `freezeMs -= delta` in update() | `scene.time.delayedCall(ms, fn)` | Frame-Spike-sicher, pausiert mit Scene |
| Ring-Animation | manueller Counter in update() | `tweens.addCounter({from:1,to:0,...})` | Cancellierbar, keine Update-Logik |
| Kreisbogen | Canvas 2D direkt | `Graphics.arc()` + `strokePath()` | Phaser-nativer API, kein Canvas-Kontext-Leak |

---

## Häufige Fallstricke (Common Pitfalls)

### Pitfall 1: `_findSafeNeighbor()` findet keinen freien Nachbarn
**Was schiefgeht:** Entity ist in einer Ecke, alle 4 Nachbar-Tiles sind belegt oder Wände.
**Warum es passiert:** Enge Kartentopologie, mehrere Entities gleichzeitig aufgetaut.
**Lösung:** `if (safe) _separateTo(safe.c, safe.r)` — kein Crash ohne sicheren Nachbarn,
Entity bleibt in Place. Invincibility läuft trotzdem an — temporäres Überlappen für 3 Sekunden
ist akzeptabler Fallback.
**Warnsignal:** Entity-Positionen nach Auftauen auf demselben Tile.

### Pitfall 2: `destroy()` vor Timer-Ablauf
**Was schiefgeht:** Teammate wird bei 0 Leben in `_checkCollisions()` (Zeile 727) zerstört.
Der `_freezeTimer` feuert danach noch → `_unfreeze()` greift auf bereits GC'd Objekte zu.
**Lösung:** Immer `_freezeTimer.remove(false)` in `destroy()` aufrufen (vor `.sprite.destroy()`).
**Warnsignal:** JavaScript-Fehler "Cannot read property of null" nach Teammate-Tod.

### Pitfall 3: `_freezeRing` Graphics ohne `add: false`
**Was schiefgeht:** `scene.add.graphics()` fügt das Objekt der Display List hinzu UND zum
Sprite-Container — doppeltes Rendering, falsche Depth.
**Lösung:** `scene.make.graphics({ x: 0, y: 0, add: false })` — wie `_frozenOverlay`.
**Warnsignal:** Ring erscheint doppelt oder an falscher Position.

### Pitfall 4: `arc()` Winkel-Richtung
**Was schiefgeht:** `arc(x, y, r, startAngle, endAngle, true)` (anticlockwise=true) füllt
den Ring rückwärts → leert sich im Uhrzeigersinn statt sichtbar zu sein.
**Lösung:** `anticlockwise=false` (Standard); von `startAngle` bis `startAngle + progress * 2π`.
Ring läuft beim Einfrieren von voll (1.0) zu leer (0.0) → progress 1→0 korrekt.

### Pitfall 5: `invincibleMs` wird vergessen
**Was schiefgeht:** Nur `freezeMs` aus dem Constructor löschen, `invincibleMs` vergessen →
`tickFreeze` (wenn versehentlich nicht gelöscht) decrementiert `undefined`.
**Lösung:** Beide Variablen aus Constructor löschen; `invincible`-Reset via `_invincibleTimer`.

---

## Code-Beispiele

### Vollständiger `freeze()` nach Fix
```javascript
// Source: codebase analysis + Phaser 3.90.0 Time.Clock API
freeze(ms) {
  if (this.frozen || this.invincible) return false;

  // C2-Fix: snap to destination tile if mid-transit
  if (this.moving) {
    this.col = this.tCol;
    this.row = this.tRow;
    const pos = tc(this.tCol, this.tRow);
    this.sprite.x = pos.x;
    this.sprite.y = pos.y;
    this._syncGlow();
  }

  this.frozen = true;
  this.moving = false;
  this._frozenOverlay.setVisible(true);
  this.glow1.setFillStyle(0x6688AA, 0.12);
  this.glow2.setFillStyle(0x6688AA, 0.05);

  if (this._freezeTimer) this._freezeTimer.remove(false);
  this._freezeTimer = this.scene.time.delayedCall(ms, () => this._unfreeze(), [], this);
  this._startFreezeRing(ms);
  return true;
}
```

### `tweens.addCounter` — offizielles Muster
```javascript
// Source: Context7 /phaserjs/phaser (verified)
const counter = this.tweens.addCounter({
  from: 1,
  to: 0,
  duration: ms,
  ease: 'Linear',
  onUpdate: (tween) => {
    const progress = tween.getValue(); // 1.0 down to 0.0
    // ...redraw arc...
  }
});
```

### `Graphics.arc()` — offizielles Muster
```javascript
// Source: Context7 /phaserjs/phaser (verified)
// arc(x, y, radius, startAngle, endAngle, anticlockwise, overshoot)
gfx.lineStyle(3, 0xAADDFF, 0.90);
gfx.beginPath();
gfx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2, false);
gfx.strokePath();
```

---

## State of the Art

| Altes Muster | Aktuelles Muster | Geändert seit | Auswirkung |
|--------------|------------------|---------------|------------|
| `freezeMs -= delta` in update() | `scene.time.delayedCall(ms, fn)` | Phaser 3 (immer vorhanden) | Kein Delta-Drift, kein Frame-Spike-Bug |
| Invincibility per `invincibleMs -= delta` | `scene.time.delayedCall(3000, fn)` | Phaser 3 | Konsistentes Muster |
| Ring-Animation per Update-Counter | `tweens.addCounter({onUpdate})` | Phaser 3 | Cancellierbar, keine Update-Logik nötig |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Teammate-Freeze-Zeit bleibt 5000ms (wie Gegner) — Anforderung FREEZE-03 spezifiziert nur Spieler+Gegner | Open Questions | Falsche Spielbalance |

**Alle anderen Claims wurden durch direktes Lesen von `index.html` oder Context7 verifiziert.**

---

## Open Questions

1. **Teammate-Freeze-Zeit (FREEZE-03)**
   - Was wir wissen: FREEZE-03 spezifiziert Spieler=2500ms und Gegner=5000ms. Zeile 724
     `tm.freeze(5000)` setzt Teammates aktuell auf 5000ms.
   - Was unklar ist: Sollen Teammates auch 5000ms eingefroren bleiben, oder eine andere Zeit bekommen?
   - Empfehlung: 5000ms beibehalten (symmetrisch zu Gegnern). Macht Co-op-Timing vorhersagbar.
     Der Planner soll dies als Entscheidung markieren oder beim User bestätigen lassen.

---

## Environment Availability

Step 2.6: SKIPPED (keine externen Abhängigkeiten — Single-file HTML mit CDN-Script-Tag).

---

## Validation Architecture

`nyquist_validation` ist explizit auf `false` gesetzt in `.planning/config.json`. Dieser Abschnitt
wird ausgelassen.

---

## Security Domain

Single-Player-Browser-Game. Keine Netzwerkkommunikation, keine Authentication, kein Backend,
keine persistierten Nutzerdaten in dieser Phase. ASVS-Kategorien nicht anwendbar.

---

## Quellen

### Primär (HIGH confidence)
- **Context7 /phaserjs/phaser** — `tweens.addCounter`, `Graphics.arc`, `Graphics.strokePath`,
  `scene.time.delayedCall` — direkt verifiziert
- **`prime-empire/index.html`** — alle Zeilenangaben aus direktem Lesen der Datei

### Sekundär (MEDIUM confidence)
- **`.planning/research/STACK.md`** — Phaser 3 API-Empfehlungen (vorherige Research-Phase,
  2026-05-10)
- **`.planning/research/PITFALLS.md`** — C1/C2 Bug-Analyse (vorherige Research-Phase)
- **`.planning/research/SUMMARY.md`** — Top-5-Pitfalls und Build-Reihenfolge

### Keine LOW-confidence Claims in diesem Dokument.

---

## Metadata

**Confidence breakdown:**
- Fundstellen im Code: HIGH — direkt gelesen
- Fix-Strategie C1+C2: HIGH — Code-verifizierte Bugs, klare Lösung
- Countdown-Ring API: HIGH — Context7 verifiziert
- Asymmetrische Zeiten: HIGH — Call-Site klar identifiziert
- Teammate-Freeze-Zeit: LOW — ASSUMED (Open Question A1)

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (Phaser 3 stabile API, 30 Tage)
