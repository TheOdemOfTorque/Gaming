# Design: Sterne-System & Spiele-Integration

**Datum:** 2026-04-04  
**Issues:** #3 (XP → Sterne), #4 (Space Invader Integration)  
**Status:** Approved

---

## Zusammenfassung

XP-Punkte erzeugen Sterne. Sterne berechtigen zu Spielzeit im Space-Invader-Spiel. Das Spiel ist nur über den 1x1-Trainer erreichbar — nicht direkt im Browser aufrufbar. Außerdem wird ein neues, moderneres App-Icon erstellt.

---

## 1. Architektur

### Space Invader Integration (Option C — kein iframe)

Der Space-Invader-Code wird vollständig in `1x1-trainer/index.html` integriert als neuer Screen `<div id="screen-invader">`. Das Spiel ist nur über den Sterne-Mechanismus erreichbar.

`space-invader-revibed/index.html` bekommt einen **Redirect Guard**: prüft ob die Seite direkt aufgerufen wird (nicht in 1x1-trainer eingebettet) und leitet dann auf `../1x1-trainer/` weiter.

```js
// In space-invader-revibed/index.html (oben im <script>)
if (window.location.pathname.includes('space-invader-revibed')) {
  window.location.replace('../1x1-trainer/');
}
```

### Warum kein iframe

- Spielzeit-Timer läuft im selben JS-Kontext → kein `postMessage` nötig
- Kein direkter URL-Zugriff möglich
- Service Worker cached alles in einer Datei
- PWA auf iOS/Android/Desktop funktioniert ohne Zusatzaufwand

---

## 2. Sterne-System

### XP → Stern (automatisch, progressiver Preis)

Nach jeder Übung wird geprüft ob der Spieler genug XP für einen neuen Stern hat. XP werden abgezogen, Sterne-Zähler steigt.

| Aktuelle Sterne | XP-Kosten für nächsten Stern |
|---|---|
| 0 | 400 XP |
| 1 | 600 XP |
| 2 | 900 XP |
| 3+ | 1200 XP (Cap) |

**Formel:** `STAR_COSTS = [400, 600, 900, 1200]`  
`costForNextStar = STAR_COSTS[Math.min(state.stars, STAR_COSTS.length - 1)]`

### State-Erweiterung

```js
state.stars: number           // aktuelle Sterne (0–n)
state.gameMinutesLeft: number // verbleibende Spielminuten (über Sessions persistent)
```

### Stern verdienen

- Läuft in `endGame()` nach XP-Vergabe
- Schleife: solange `state.xp >= cost && state.xp >= cost` → Stern vergeben, XP abziehen
- Max. 1 Stern pro Übung (verhindert mehrfaches Verdienen auf einmal)
- Toast-Benachrichtigung: „⭐ Neuer Stern! Du hast 10 Minuten Spielzeit verdient!"

### Spielzeit

- 1 Stern = 10 Minuten
- Sterne werden beim Betreten des Spiele-Screens eingelöst (alle verfügbaren Sterne → Minuten umrechnen, `state.stars` auf 0 setzen)
- `state.gameMinutesLeft` bleibt über Sessions gespeichert → nicht verbrauchte Spielzeit geht nicht verloren

---

## 3. UI

### Home-Screen — Spiele-Leiste (Option C)

Breite Leiste unterhalb der 4 Mode-Cards:

**Mit Sternen (≥1):**
```
🎮 Spiele          ⭐⭐ · 20 min    [Los! →]
```
Goldener Gradient-Border, anklickbar.

**Ohne Sterne (0):**
```
🔒 Spiele    Du hast gerade keine Sterne!
```
Ausgegraut, nicht anklickbar (`pointer-events: none`).

### Spiele-Screen

- Space Invader füllt den Bildschirm
- **Timer-Overlay** oben rechts: `⏱ 18:42` (Countdown, gelb → rot unter 2 min)
- **Beenden-Button** oben links: `✕`
- Bei Timer = 0: Spiel stoppt, Toast „⏱ Zeit abgelaufen!", zurück zu Home
- **Pausierung**: `document.addEventListener('visibilitychange')` — Timer pausiert wenn Tab/App nicht sichtbar, läuft weiter wenn wieder sichtbar

### Sterne-Anzeige in Home-Stats

Der vorhandene `stat-streak`-Bereich zeigt weiterhin Streak. Sterne-Info erscheint **nur** in der Spiele-Leiste (kein extra Stats-Slot nötig, da Sterne-Logik dort direkt sichtbar ist).

---

## 4. Neues App-Icon

Ersetzt `icon-192.png` und `icon-512.png`.

**Design:**
- Hintergrund: dunkles Blau-Violett (`#0d0d2b`) mit leichtem radialen Gradienten zur Mitte
- Zentral: `1×1` in fetter, weißer Schrift (gerundet, modern)
- Darunter: kleiner goldener Stern `⭐`
- Schmaler lila-blauer Glow-Rahmen (`#6C63FF`)
- Generiert via Node.js Canvas-Script (`scripts/generate-icons.js`) — kein externes Tool

---

## 5. Redirect Guard

`space-invader-revibed/index.html` bekommt als allererste Zeile im `<script>`:

```js
if (!window.__1x1trainer) { window.location.replace('../1x1-trainer/'); }
```

`1x1-trainer/index.html` setzt `window.__1x1trainer = true` bevor der Invader-Screen initialisiert wird.

---

## 6. Service Worker

`sw.js` ASSETS-Liste um Space-Invader-Assets erweitern (da Code integriert wird, sind keine separaten Dateien nötig — alles in `index.html`). Cache-Version bump auf v13.

---

## Nicht in diesem Scope

- Passwort-geschützter Eltern-Bereich (separate Feature-Idee, gespeichert in Memory)
- Weitere Spiele (Architektur ist erweiterbar: Spiele-Screen kann mehrere Spiele anbieten)
- Spiele-Highscores in Statistik
