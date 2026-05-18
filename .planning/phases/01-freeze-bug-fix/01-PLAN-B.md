---
phase: 01-freeze-bug-fix
plan: B
type: execute
wave: 2
depends_on:
  - 01-PLAN-A
files_modified:
  - prime-empire/index.html
autonomous: true
requirements:
  - FREEZE-03
  - FREEZE-04

must_haves:
  truths:
    - "Spieler ist nach Feindkontakt genau 2,5 Sekunden eingefroren (nicht 3 Sekunden)"
    - "Gegner ist nach Feindkontakt genau 5 Sekunden eingefroren"
    - "Eine eingefrorene Entity zeigt einen hellen Bogen-Ring der sich leert (von voll auf leer in der Freeze-Dauer)"
    - "Der Countdown-Ring verschwindet wenn das Auftauen beginnt"
  artifacts:
    - path: "prime-empire/index.html"
      provides: "Asymmetrische Freeze-Zeiten an Enemy-Player-Kollisions-Call-Site"
      contains: "player.freeze(2500)"
    - path: "prime-empire/index.html"
      provides: "Countdown-Ring via tweens.addCounter + Graphics.arc"
      contains: "_startFreezeRing"
  key_links:
    - from: "GameScene._checkCollisions()"
      to: "Entity.freeze(2500) / Entity.freeze(5000)"
      via: "Asymmetrische Call-Site-Parameter"
      pattern: "player\\.freeze(2500)"
    - from: "Entity._startFreezeRing(ms)"
      to: "Graphics.arc()"
      via: "tweens.addCounter onUpdate callback"
      pattern: "_freezeRing\\.arc"
---

<objective>
Baue auf dem Walking Skeleton (Plan A) auf: Implementiere asymmetrische Freeze-Zeiten
(FREEZE-03) und den Freeze-Countdown-Ring (FREEZE-04).

Nach diesem Plan:
- Spieler friert 2,5 Sekunden ein, Gegner 5 Sekunden — Co-op-Asymmetrie ist sichtbar
- Jede eingefrorene Entity zeigt einen hellen Bogen der sich in Echtzeit leert

Purpose: Spielgefühl und Lesbarkeit. Luise sieht genau wie lange eine Entity noch eingefroren
ist und erholt sich schneller als die Gegner.

Output: Modifiziertes prime-empire/index.html — Phase 1 komplett abgeschlossen.

VORBEDINGUNG: Plan A muss vollständig ausgeführt worden sein.
_startFreezeRing() und _stopFreezeRing() wurden in Plan A bereits implementiert —
dieser Plan konfiguriert nur noch die Call-Sites und verifiziert die Ring-Sichtbarkeit.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/marco/dev/gaming/.planning/ROADMAP.md
@/Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-RESEARCH.md
@/Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-PATTERNS.md
@/Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-A-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Asymmetrische Freeze-Zeiten an Enemy-Player-Kollisions-Call-Site (FREEZE-03)</name>

  <read_first>
    - /Users/marco/dev/gaming/prime-empire/index.html — Zeilen 730–748 (_checkCollisions, Enemy-vs-Player-Block)
    - /Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-RESEARCH.md — Abschnitt "Fix-Strategie: FREEZE-03"
    - /Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-PATTERNS.md — Pattern Assignment 8
  </read_first>

  <files>prime-empire/index.html</files>

  <action>
Ändere die zwei Freeze-Werte in GameScene._checkCollisions() im Enemy-vs-Player-Block.

WICHTIG: Lies zunächst die aktuellen Zeilen um die Call-Site zu lokalisieren.
Nach Plan A haben sich die Zeilen leicht verschoben. Suche mit:
`grep -n "e.freeze(3000)\|player.freeze(3000)" prime-empire/index.html`

Die aktuellen Zeilen lauten (vor dieser Änderung):
```javascript
          e.freeze(3000);
          this.player.lives=Math.max(0,this.player.lives-1);
          this.player.freeze(3000);
```

Ersetze mit (FREEZE-03 — asymmetrische Zeiten per STATE.md Entscheid 2026-05-10):
```javascript
          e.freeze(5000);           // Gegner: 5 Sekunden
          this.player.lives=Math.max(0,this.player.lives-1);
          this.player.freeze(2500); // Spieler: 2,5 Sekunden
```

NICHT ändern: Die Enemy-Teammate-Kollisions-Call-Site (Zeile ~722/724):
```javascript
          const ok=e.freeze(5000);
          if(ok){
            if(tm.freeze(5000)){...}
```
Teammate-Freeze bleibt 5000ms (symmetrisch zu Gegner, Open Question A1 aus RESEARCH.md
wurde durch Planer entschieden: 5000ms beibehalten — Co-op-Timing vorhersagbar).
  </action>

  <verify>
    grep -n "e.freeze\|player.freeze\|tm.freeze" /Users/marco/dev/gaming/prime-empire/index.html
  </verify>

  <acceptance_criteria>
    - grep "player.freeze(2500)" liefert genau 1 Treffer (Enemy-vs-Player-Block)
    - grep "player.freeze(3000)" liefert 0 Treffer (alter Wert ist entfernt)
    - grep "e.freeze(5000)" liefert genau 2 Treffer (Enemy-vs-Teammate-Block + Enemy-vs-Player-Block)
    - grep "e.freeze(3000)" liefert 0 Treffer (alter Wert ist entfernt)
    - grep "tm.freeze(5000)" liefert genau 1 Treffer (Enemy-vs-Teammate-Block — unverändert)
    - Browsertest: Nach Feindkontakt friert Spieler ein und taut nach ca. 2,5 Sekunden auf (visuell erkennbar, nicht 5 Sekunden)
  </acceptance_criteria>

  <done>
    Enemy-vs-Player-Call-Site: e.freeze(5000) + player.freeze(2500).
    Enemy-vs-Teammate-Call-Site: unverändert bei 5000ms / 5000ms.
    FREEZE-03 ist erfüllt: Spieler erholt sich in 2,5s, Gegner in 5s.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Freeze-Countdown-Ring sichtbar prüfen (FREEZE-04)</name>

  <read_first>
    - /Users/marco/dev/gaming/prime-empire/index.html — grep nach "_startFreezeRing" um zu prüfen dass Plan A korrekt implementiert hat
    - /Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-RESEARCH.md — Abschnitt "Implementation: FREEZE-04 — Countdown-Ring"
  </read_first>

  <what-built>
Plan A hat _startFreezeRing() und _stopFreezeRing() implementiert.
Plan B Task 1 hat die Freeze-Zeiten korrekt gesetzt (2500ms Spieler, 5000ms Gegner).
Der Ring wird automatisch in freeze() gestartet und in _unfreeze() gestoppt.

Prüfe vor diesem Checkpoint:
```bash
grep -n "_startFreezeRing\|_stopFreezeRing\|tweens.addCounter\|Graphics.arc" /Users/marco/dev/gaming/prime-empire/index.html
```
Erwartete Treffer: mindestens 6 (je 2 pro Methode + arc + addCounter).

Falls _startFreezeRing fehlt: Plan A wurde nicht korrekt ausgeführt. Melde Failure und führe Plan A erneut aus — dieses Checkpoint implementiert keine Fallback-Lösung.
  </what-built>

  <how-to-verify>
1. Starte lokalen Server: `cd /Users/marco/dev/gaming && python3 -m http.server 8080`
2. Öffne http://localhost:8080/prime-empire/ im Browser
3. Starte das Spiel
4. Lasse einen Gegner den Spieler berühren

ERWARTETES VERHALTEN:
- Spieler-Sprite zeigt sofort nach Kontakt einen hellen blauen/weißen Bogen-Ring (12-Uhr-Position, Uhrzeigersinn)
- Der Bogen wird kleiner während die Freeze-Zeit läuft (ca. 2,5 Sekunden von voll auf leer)
- Nach dem Auftauen verschwindet der Ring, der Spieler blinkt (Invincibility)
- Der eingefrorene Gegner zeigt ebenfalls einen Ring der in 5 Sekunden abläuft

BEKANNTE EINSCHRÄNKUNG (kein Bug): Der Ring dreht sich mit der Blickrichtung der Entity
(weil er als Sprite-Child implementiert ist). Das ist auf diesem Maßstab für eine Kinder-App
akzeptabel (dokumentiert in RESEARCH.md Pitfall 6).
  </how-to-verify>

  <resume-signal>
Tippe "approved" wenn der Ring sichtbar ist und sich korrekt leert.
Oder beschreibe das Problem (z.B. "Ring nicht sichtbar", "Ring dreht sich nicht ab",
"JavaScript-Fehler in Konsole") damit der nächste Schritt korrigiert werden kann.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser JS ↔ Phaser scene | Kein Netzwerk; alle Änderungen im selben JS-Kontext |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-B-01 | Denial | tweens.addCounter onUpdate callback | accept | Tween wird in _stopFreezeRing() mit .stop() cancelliert bevor es weiter feuert. Phaser 3 Tween-Lifecycle ist stabil (API verifiziert via Context7) |
| T-01-B-02 | Denial | Freeze-Ring als Sprite-Child + Entity-Rotation | accept | Ring dreht sich mit Sprite-Rotation — auf diesem Maßstab akzeptabler Kompromiss (RESEARCH.md Pitfall 6). Keine Sicherheits-Relevanz |
</threat_model>

<verification>
Nach Task 1:

```bash
# Asymmetrische Zeiten korrekt
grep -n "player.freeze" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: player.freeze(2500) — genau 1 Treffer

grep -n "e.freeze" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: e.freeze(5000) — 2 Treffer (Teammate-Block + Player-Block)

# Ring-Implementation vorhanden (aus Plan A)
grep -c "_startFreezeRing\|_stopFreezeRing" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: >= 4
```

Nach Task 2 (manuell, Browsertest):
- Ring erscheint nach Feindkontakt auf Spieler und Gegner
- Ring leert sich in korrekter Dauer (Spieler ~2,5s, Gegner ~5s)
- Ring verschwindet beim Auftauen
- Keine JavaScript-Fehler in Browser-Konsole während Ring läuft
</verification>

<success_criteria>
FREEZE-03 erfüllt: `player.freeze(2500)` an der Enemy-vs-Player-Call-Site in _checkCollisions().
Spieler erholt sich in 2,5 Sekunden, Gegner in 5 Sekunden — Co-op-Asymmetrie ist implementiert.

FREEZE-04 erfüllt: _startFreezeRing(ms) rendert einen `Graphics.arc()`-Bogen via
`tweens.addCounter` der synchron mit dem delayedCall-Timer abläuft. Ring ist visuell bestätigt.

Phase 1 Gesamtzustand nach Plan A + Plan B:
- FREEZE-01: Entities hängen nicht mehr permanent — delayedCall-Timer löst _unfreeze() aus
- FREEZE-02: C2-Snap in freeze() — kein Wanddurchlaufen nach Auftauen
- FREEZE-03: 2500ms Spieler / 5000ms Gegner — asymmetrische Call-Site-Parameter
- FREEZE-04: Countdown-Ring via tweens.addCounter + Graphics.arc — visuell sichtbar und bestätigt
</success_criteria>

<output>
Nach Abschluss: Erstelle `.planning/phases/01-freeze-bug-fix/01-B-SUMMARY.md`

Format: Nutze @$HOME/.claude/get-shit-done/templates/summary.md
Halte fest: Geänderte Zeilen für freeze-Zeiten, Bestätigung dass Ring sichtbar war (Checkpoint-Ergebnis),
Phase-1-Gesamtstatus (alle 4 FREEZE-Requirements erfüllt).
</output>
