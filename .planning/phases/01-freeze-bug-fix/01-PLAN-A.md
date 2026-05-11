---
phase: 01-freeze-bug-fix
plan: A
type: execute
wave: 1
depends_on: []
files_modified:
  - prime-empire/index.html
autonomous: true
requirements:
  - FREEZE-01
  - FREEZE-02
  - FREEZE-04

must_haves:
  truths:
    - "Nach 5 Sekunden Einfrieren bewegt sich eine Entity wieder selbstständig (kein permanentes Hängenbleiben)"
    - "Eine Entity springt beim Einfrieren sofort auf ihre Ziel-Tile (col/row/sprite.x/y werden synchronisiert)"
    - "Nach dem Auftauen klippt keine Entity durch Wände (Startposition ist immer ein begehbares Tile)"
    - "Kein Runtime-Error wenn eine Teammate-Entity bei 0 Leben zerstört wird während sie eingefroren ist"
  artifacts:
    - path: "prime-empire/index.html"
      provides: "Komplette Entity-Freeze-State-Machine"
      contains: "_separateTo"
    - path: "prime-empire/index.html"
      provides: "delayedCall-Timer für Freeze"
      contains: "_freezeTimer"
    - path: "prime-empire/index.html"
      provides: "delayedCall-Timer für Invincibility"
      contains: "_invincibleTimer"
  key_links:
    - from: "Entity.freeze(ms)"
      to: "Entity._unfreeze()"
      via: "scene.time.delayedCall(_freezeTimer)"
      pattern: "_freezeTimer=this.scene.time.delayedCall"
    - from: "Entity._unfreeze()"
      to: "_separateTo / _findSafeNeighbor"
      via: "C1-Fix spatial separation"
      pattern: "_separateTo\\|_findSafeNeighbor"
    - from: "Entity.destroy()"
      to: "_freezeTimer.remove"
      via: "teardown guard"
      pattern: "_freezeTimer\\.remove"
---

<objective>
Walking Skeleton: Behebe die zwei strukturellen Bugs im Entity-Freeze-System (C1 und C2) und
ersetze den manuellen tickFreeze-Counter durch scene.time.delayedCall.

Nach diesem Plan:
- Entities frieren korrekt ein UND tauen korrekt auf — kein permanentes Hängenbleiben (FREEZE-01)
- Entities schnappen beim Einfrieren sofort auf ihre Ziel-Tile — kein Wanddurchlaufen (FREEZE-02)
- Das gesamte Freeze-Lifecycle ist timer-basiert (delayedCall) statt delta-basiert

Purpose: Fundamentale Spielbarkeit. Ohne diesen Fix ist Prime Empire in bestimmten Situationen
unspielbar (Luise bleibt dauerhaft stecken nach Feindkontakt).

Output: Modifiziertes prime-empire/index.html mit korrektem Entity-Freeze-System.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/marco/dev/gaming/.planning/ROADMAP.md
@/Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-RESEARCH.md
@/Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-PATTERNS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Entity-Constructor + freeze() + _unfreeze() — C1+C2 Bugs beheben + Timer-Refactor</name>

  <read_first>
    - /Users/marco/dev/gaming/prime-empire/index.html — Zeilen 191–267 (Entity-Klasse komplett)
    - /Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-RESEARCH.md — Abschnitte "Fix-Strategie: C2", "Fix-Strategie: C1", "tickFreeze-Refactor"
    - /Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-PATTERNS.md — Pattern Assignments 1, 2, 3
  </read_first>

  <files>prime-empire/index.html</files>

  <action>
Führe alle folgenden Änderungen in einem einzigen Edit an prime-empire/index.html durch.
Alle Zeilennummern beziehen sich auf den AKTUELLEN Stand der Datei (vor diesem Edit).

**Änderung 1 — Entity-Constructor (Zeilen 195–196): freezeMs/invincibleMs entfernen, Timer-Felder hinzufügen**

Ersetze:
```javascript
    this.frozen=false; this.freezeMs=0;
    this.invincible=false; this.invincibleMs=0;
    this.lives=3; this.bodyColor=bodyColor; this.accentColor=accentColor;
    this.size=size; this.lastDir='DOWN'; this._blinkTween=null;
```
Mit:
```javascript
    this.frozen=false;
    this.invincible=false;
    this._freezeTimer=null;
    this._invincibleTimer=null;
    this._freezeRingTween=null;
    this._freezeRing=null;
    this.lives=3; this.bodyColor=bodyColor; this.accentColor=accentColor;
    this.size=size; this.lastDir='DOWN'; this._blinkTween=null;
```

**Änderung 2 — Entity.freeze() (Zeilen 217–224): C2-Fix + delayedCall + _startFreezeRing**

Ersetze:
```javascript
  freeze(ms){
    if(this.frozen||this.invincible) return false;
    this.frozen=true; this.freezeMs=ms; this.moving=false;
    this._frozenOverlay.setVisible(true);
    this.glow1.setFillStyle(0x6688AA,0.12);
    this.glow2.setFillStyle(0x6688AA,0.05);
    return true;
  }
```
Mit:
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

**Änderung 3 — Entity._unfreeze() (Zeilen 225–232): C1-Fix + delayedCall für Invincibility**

Ersetze:
```javascript
  _unfreeze(){
    this.frozen=false; this.freezeMs=0;
    this._frozenOverlay.setVisible(false);
    this.glow1.setFillStyle(this.bodyColor,0.17);
    this.glow2.setFillStyle(this.bodyColor,0.07);
    this.invincible=true; this.invincibleMs=3000;
    this._startBlink();
  }
```
Mit:
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

**Änderung 4 — Entity.tickFreeze() (Zeilen 241–244): Methode vollständig löschen**

Lösche diese Zeilen komplett:
```javascript
  tickFreeze(delta){
    if(this.frozen){this.freezeMs-=delta;if(this.freezeMs<=0)this._unfreeze();}
    if(this.invincible){this.invincibleMs-=delta;if(this.invincibleMs<=0){this.invincible=false;this.invincibleMs=0;this._stopBlink();}}
  }
```

**Änderung 5 — Neue Methoden _startFreezeRing / _stopFreezeRing: nach _stopBlink einfügen (nach Zeile 240)**

Füge nach der schließenden Klammer von `_stopBlink()` (nach Zeile 240) ein:
```javascript
  _startFreezeRing(ms){
    if(!this._freezeRing){
      this._freezeRing=this.scene.make.graphics({x:0,y:0,add:false});
      this.sprite.add(this._freezeRing);
    }
    this._freezeRing.setVisible(true);
    const radius=this.size*0.60;
    const startAngle=-Math.PI/2; // 12 Uhr
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

HINWEIS zu Änderung 5: Die Methode `_startFreezeRing` wird durch `freeze()` aufgerufen
(Änderung 2), und `_stopFreezeRing` durch `_unfreeze()` (Änderung 3). Der Ring selbst
wird in Plan B (FREEZE-04) genutzt — die Methode ist hier aber bereits vollständig zu
implementieren, da `freeze()` und `_unfreeze()` sie bereits referenzieren.
  </action>

  <verify>
    grep -n "_freezeTimer=this.scene.time.delayedCall" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "_invincibleTimer=this.scene.time.delayedCall" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "_separateTo" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "_findSafeNeighbor" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "tickFreeze" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "freezeMs" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "invincibleMs" /Users/marco/dev/gaming/prime-empire/index.html
  </verify>

  <acceptance_criteria>
    - grep "_freezeTimer=this.scene.time.delayedCall" liefert genau 1 Treffer (in freeze())
    - grep "_invincibleTimer=this.scene.time.delayedCall" liefert genau 1 Treffer (in _unfreeze())
    - grep "_separateTo" liefert mindestens 2 Treffer (Definition + Aufruf in _unfreeze)
    - grep "_findSafeNeighbor" liefert mindestens 2 Treffer (Definition + Aufruf in _unfreeze)
    - grep "tickFreeze" liefert 0 Treffer — Methode und alle Aufrufe sind entfernt
    - grep "freezeMs" liefert 0 Treffer — Feld ist aus Constructor und _unfreeze entfernt
    - grep "invincibleMs" liefert 0 Treffer — Feld ist aus Constructor und tickFreeze entfernt
    - grep "_startFreezeRing" liefert mindestens 2 Treffer (Definition + Aufruf in freeze())
    - grep "_stopFreezeRing" liefert mindestens 2 Treffer (Definition + Aufruf in _unfreeze())
  </acceptance_criteria>

  <done>
    Entity.freeze() implementiert C2-Snap + delayedCall-Timer + _startFreezeRing.
    Entity._unfreeze() implementiert C1-Separation + delayedCall-Invincibility + _stopFreezeRing.
    _separateTo, _findSafeNeighbor, _startFreezeRing, _stopFreezeRing sind neue Methoden in Entity.
    tickFreeze() ist gelöscht. freezeMs und invincibleMs sind aus dem Constructor entfernt.
    _freezeTimer, _invincibleTimer, _freezeRingTween, _freezeRing sind im Constructor initialisiert.
  </done>
</task>

<task type="auto">
  <name>Task 2: tickFreeze-Aufrufe aus update()-Methoden entfernen + Enemy._unfreeze()-Override + Entity.destroy() absichern</name>

  <read_first>
    - /Users/marco/dev/gaming/prime-empire/index.html — Zeilen 282–290 (Player.update), 317–326 (Enemy.update), 363–368 (Teammate.update), 262–266 (Entity.destroy), 297–349 (Enemy-Klasse)
    - /Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-PATTERNS.md — Pattern Assignments 4, 5, 7
    - /Users/marco/dev/gaming/.planning/phases/01-freeze-bug-fix/01-RESEARCH.md — Abschnitte "tickFreeze-Refactor", "Entity.destroy()", "Enemy-Override für thinkDelay"
  </read_first>

  <files>prime-empire/index.html</files>

  <action>
Führe alle folgenden Änderungen in einem einzigen Edit durch.
WICHTIG: Nach Task 1 hat sich die Datei geändert — lies die aktuellen Zeilennummern
der betroffenen Stellen VOR dem Edit (grep hilft: `grep -n "tickFreeze" index.html`
ergibt nach Task 1 die verbleibenden Aufrufe in update()-Methoden).

**Änderung 1 — Player.update(): `this.tickFreeze(delta);` entfernen**

In Player.update() (Zeile ~284 nach Task 1):
Ersetze:
```javascript
  update(delta,inputDir){
    if(this.done) return;
    this.tickFreeze(delta);
    if(this.frozen) return;
```
Mit:
```javascript
  update(delta,inputDir){
    if(this.done) return;
    if(this.frozen) return;
```

**Änderung 2 — Enemy.update(): `this.tickFreeze(delta);` entfernen**

In Enemy.update() (Zeile ~318 nach Task 1):
Ersetze:
```javascript
  update(delta,pc,pr){
    this.tickFreeze(delta);
    this.roadblockCooldown=Math.max(0,this.roadblockCooldown-delta);
```
Mit:
```javascript
  update(delta,pc,pr){
    this.roadblockCooldown=Math.max(0,this.roadblockCooldown-delta);
```

**Änderung 3 — Teammate.update(): `this.tickFreeze(delta);` entfernen**

In Teammate.update() (Zeile ~364 nach Task 1):
Ersetze:
```javascript
  update(delta,pc,pr,enemies){
    this.tickFreeze(delta);
    if(this.frozen) return;
```
Mit:
```javascript
  update(delta,pc,pr,enemies){
    if(this.frozen) return;
```

**Änderung 4 — Entity.destroy(): Timer und Ring-Tween canceln**

Ersetze die aktuelle destroy()-Methode:
```javascript
  destroy(){
    this._stopBlink();
    this.sprite.destroy(true);
    this.glow1.destroy(); this.glow2.destroy();
  }
```
Mit:
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

KRITISCH: Timer-Cancels müssen VOR `sprite.destroy(true)` stehen.
Begründung: `tm.destroy()` wird bei Zeile 727 aufgerufen wenn Teammate 0 Leben hat.
Ohne Timer-Cancel würde `_unfreeze()` nach dem Destroy auf ein bereits zerstörtes Sprite zugreifen.

**Änderung 5 — Enemy._unfreeze() Override: in Enemy-Klasse einfügen**

Füge am Ende der Enemy-Klasse (vor der schließenden Klammer `}` nach `_decide()`-Methode,
also nach der aktuellen Zeile ~349) eine neue Methode ein:
```javascript
  _unfreeze(){
    super._unfreeze();
    this.thinkDelay=0; // sofortiges Re-Pathfinding nach Auftauen
  }
```

Begründung: `thinkDelay` (initialisiert bei `this.thinkDelay=id*300`) existiert nur in Enemy.
Ohne Reset würde ein aufgetauter Gegner bis zu id*300ms stillstehen und sofort wieder eingefroren.
`thinkDelay=0` lässt `_decide()` im nächsten Update-Frame laufen.
  </action>

  <verify>
    grep -n "tickFreeze" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "_freezeTimer.remove" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "_invincibleTimer.remove" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "super._unfreeze" /Users/marco/dev/gaming/prime-empire/index.html
    grep -n "thinkDelay=0" /Users/marco/dev/gaming/prime-empire/index.html
  </verify>

  <acceptance_criteria>
    - grep "tickFreeze" liefert 0 Treffer (alle Aufrufe und die Methode sind entfernt)
    - grep "_freezeTimer.remove" liefert genau 1 Treffer (in destroy())
    - grep "_invincibleTimer.remove" liefert genau 1 Treffer (in destroy())
    - grep "super._unfreeze" liefert genau 1 Treffer (Enemy._unfreeze Override)
    - grep "thinkDelay=0" liefert mindestens 1 Treffer (in Enemy._unfreeze Override)
    - Browsertest (Python HTTP-Server starten, index.html öffnen): Spiel startet ohne JavaScript-Fehler in der Browser-Konsole
    - Browsertest: Spieler bewegt sich korrekt mit Pfeiltasten/WASD
    - Browsertest: Nach Feindkontakt friert Spieler ein und bewegt sich nach ~2.5s (wird in Plan B auf 2500ms gesetzt) oder 3000ms (aktueller Wert) wieder selbstständig
  </acceptance_criteria>

  <done>
    tickFreeze()-Aufrufe aus Player.update(), Enemy.update(), Teammate.update() entfernt.
    Entity.destroy() cancelt _freezeTimer und _invincibleTimer vor sprite.destroy().
    Enemy._unfreeze() Override setzt thinkDelay=0 für sofortiges Re-Pathfinding.
    Das Spiel startet fehlerfrei im Browser. Entities frieren ein und tauen auf.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser JS ↔ Phaser scene | Alle State-Änderungen laufen im selben JS-Kontext; kein Netzwerk-Crossing |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-A-01 | Denial | Entity.destroy() + Timer | mitigate | Timer mit `.remove(false)` canceln vor sprite.destroy() — verhindert Post-Destroy-Callback auf zerstörtem Objekt (Pitfall 2 aus RESEARCH.md) |
| T-01-A-02 | Denial | _findSafeNeighbor() null return | accept | Fallback: Entity bleibt in Place, Invincibility läuft trotzdem an. Kartentopologie bestätigt: kein isoliertes Road-Tile (Pitfall 7 aus RESEARCH.md) |
</threat_model>

<verification>
Nach Task 1 + Task 2 zusammen:

```bash
# Kein tickFreeze mehr vorhanden
grep -c "tickFreeze" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: 0

# Timer-Referenzen vorhanden
grep -c "_freezeTimer" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: >= 5 (Constructor-Init, freeze(), _unfreeze(), destroy(), ggf. Guard)

# C1+C2-Fix-Methoden vorhanden
grep -c "_separateTo\|_findSafeNeighbor" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: >= 4

# Ring-Methoden vorhanden
grep -c "_startFreezeRing\|_stopFreezeRing" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: >= 4

# Enemy Override vorhanden
grep -c "super._unfreeze" /Users/marco/dev/gaming/prime-empire/index.html
# erwartet: 1
```

Browsertest (python3 -m http.server 8080, dann http://localhost:8080/prime-empire/):
1. Spiel startet ohne Konsolenfehler
2. Spieler bewegt sich mit Pfeiltasten
3. Nach Feindkontakt: Spieler friert ein (blaue Overlay), blinkt nach Auftauen
4. Gegner friert nach Kontakt ebenfalls ein, bewegt sich danach wieder
5. Kein "Cannot read property" Fehler in Konsole
</verification>

<success_criteria>
FREEZE-01 erfüllt: Entities bleiben nie permanent stecken — sie tauen nach dem delayedCall-Timer
automatisch auf (kein manueller tickFreeze-Counter mehr der durch Frame-Spikes verfehlt werden kann).

FREEZE-02 erfüllt: Entity.freeze(ms) snappt col/row/sprite.x/y auf tCol/tRow wenn moving=true —
nach dem Auftauen startet _decide() von einem validen, begehbaren Tile (kein Wanddurchlaufen).

Technisch: Kein JavaScript-Fehler im Browser. Alle Entity-Typen (Spieler, Gegner, Mitspieler)
frieren ein und tauen auf. Keine Memory-Leaks durch unkanncelierte Timer nach Entity-Destroy.
</success_criteria>

<output>
Nach Abschluss: Erstelle `.planning/phases/01-freeze-bug-fix/01-A-SUMMARY.md`

Format: Nutze @$HOME/.claude/get-shit-done/templates/summary.md
Halte fest: Alle geänderten Zeilen in index.html, welche Bugs behoben wurden (C1+C2),
welche neuen Methoden hinzugefügt wurden, und den Open-Question-A1-Entscheid
(Teammate 5000ms — unverändert).
</output>
