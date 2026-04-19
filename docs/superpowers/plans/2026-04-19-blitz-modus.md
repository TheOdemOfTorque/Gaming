# Blitz-Modus Erweiterung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blitz-Modus um Reihen-Auswahl, Hauptseiten-Rekord und Top-5-Highscore-Seite erweitern.

**Architecture:** Alles in `1x1-trainer/index.html` (eine Datei, inline CSS+JS). State in localStorage unter `henry_einmaleins`. STATE_VERSION 2→3 mit Migration. Neues Modal für Reihen-Picker, neue Screen-Sektion für Highscores.

**Tech Stack:** Vanilla JS, HTML/CSS, Web Storage API, kein Build-Schritt.

---

## Datei-Übersicht

- Modify: `1x1-trainer/index.html` — alle Änderungen landen hier
- Modify: `sw.js` — Cache-Version hochzählen (Task 6)

---

### Task 1: State-Migration v2 → v3

**Files:**
- Modify: `1x1-trainer/index.html:869-876` (defaultState)
- Modify: `1x1-trainer/index.html:884` (STATE_VERSION)
- Modify: `1x1-trainer/index.html:911` (Migrations-Placeholder)

- [ ] **Schritt 1: STATE_VERSION erhöhen**

Zeile 884 ändern:
```js
const STATE_VERSION = 3;
```

- [ ] **Schritt 2: defaultState um neue Felder erweitern**

Zeile 869–875 (`defaultState`) — `blitzConfig` und `blitzListe` ergänzen:
```js
function defaultState() {
  return { _version: STATE_VERSION, name: '', xp: 0, achievements: [], totalCorrect: 0, totalGames: 0,
           streak: 0, lastPlayDate: null,
           highScores: { blitz: 0, turnier: 0, blitzListe: [] },
           blitzConfig: { reihen: [], alleReihen: true },
           trainedReihen: [], settings: defaultSettings(), reiheStats: defaultReiheStats(),
           streakFreezeUsedDate: null, streakFreezeTotal: 0,
           questionStats: {},
           stars: 0, gameSecondsLeft: 0 };
}
```

- [ ] **Schritt 3: Migration v2→v3 eintragen**

Den Kommentar `// v2 → v3, … : hier künftige Migrationen ergänzen` (Zeile 911) ersetzen durch:
```js
  // v2 → v3: blitzConfig + blitzListe
  (s) => {
    if (!s.blitzConfig) s.blitzConfig = { reihen: [], alleReihen: true };
    if (!s.highScores.blitzListe) s.highScores.blitzListe = [];
    return s;
  },
```

- [ ] **Schritt 4: Im Browser prüfen**

`python3 -m http.server 8080` starten, `http://localhost:8080/1x1-trainer/` öffnen.
DevTools → Application → Local Storage: Eintrag löschen, Seite neu laden.
Erwartung: `henry_einmaleins._version === 3`, `blitzConfig` und `highScores.blitzListe` vorhanden.

- [ ] **Schritt 5: Commit**
```bash
git add 1x1-trainer/index.html
git commit -m "feat(blitz): State v3 — blitzConfig + blitzListe"
```

---

### Task 2: Frage-Generierung im Blitz-Modus

**Files:**
- Modify: `1x1-trainer/index.html:1451-1452` (makeQuestion, blitz-Branch)

- [ ] **Schritt 1: Hilfsfunktion `pickBlitzReihe` hinzufügen**

Direkt vor `function makeQuestion()` (Zeile 1447) einfügen:
```js
function pickBlitzReihe() {
  const cfg = state.blitzConfig;
  if (cfg.alleReihen || !cfg.reihen.length) return rnd(1, getMaxReihe());
  return cfg.reihen[rnd(0, cfg.reihen.length - 1)];
}
```

- [ ] **Schritt 2: makeQuestion im blitz-Branch aktualisieren**

Zeile 1452 (aktuell: `a = rnd(1, getMaxReihe()); b = rnd(1, getMaxFactor(a));`) ersetzen:
```js
  } else if (game.mode === 'blitz') {
    a = pickBlitzReihe(); b = rnd(1, getMaxFactor(a));
```

- [ ] **Schritt 3: Im Browser prüfen**

Blitz-Modus starten. DevTools Console: `state.blitzConfig = {reihen:[3], alleReihen:false}` eingeben.
Nächste Frage beobachten — der erste Faktor sollte immer 3 sein.

- [ ] **Schritt 4: Commit**
```bash
git add 1x1-trainer/index.html
git commit -m "feat(blitz): Frage-Generierung respektiert blitzConfig"
```

---

### Task 3: Blitz-Reihen-Picker Modal (HTML + CSS + JS)

**Files:**
- Modify: `1x1-trainer/index.html` — CSS ergänzen, Modal-HTML nach training-modal, JS-Funktionen

- [ ] **Schritt 1: CSS für blitz-modal ergänzen**

Im `<style>`-Block (nach `.reihe-btn.green { ... }`, ca. Zeile 187) einfügen:
```css
.blitz-reihe-btn { padding: 10px 4px; background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.12); border-radius: 10px; color: #fff; font-size: 0.95rem; font-weight: 700; cursor: pointer; text-align: center; transition: transform 0.1s; }
.blitz-reihe-btn:active { transform: scale(0.93); }
.blitz-reihe-btn.selected { background: rgba(245,158,11,0.25); border-color: #F59E0B; }
.blitz-alle-btn { width: 100%; padding: 12px; background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; color: rgba(255,255,255,0.8); font-size: 0.95rem; font-weight: 700; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.blitz-alle-btn.selected { background: rgba(245,158,11,0.15); border-color: #F59E0B; color: #fbbf24; }
```

- [ ] **Schritt 2: Modal-HTML einfügen**

Direkt nach dem schließenden `</div>` des training-modal (nach Zeile 716) einfügen:
```html
<!-- BLITZ-MODUS REIHEN-PICKER -->
<div class="modal-overlay" id="blitz-modal">
  <div class="modal-sheet">
    <div class="modal-title">⚡ Blitz-Modus</div>
    <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-bottom:12px">Welche Reihen sollen abgefragt werden?</div>
    <button class="blitz-alle-btn" id="blitz-alle-btn" onclick="toggleBlitzAlle()">
      <span id="blitz-alle-icon">☐</span>
      <div>
        <div style="font-weight:700">Alle Reihen</div>
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.4)" id="blitz-alle-sub">Reihen 1–10 gemischt</div>
      </div>
    </button>
    <div style="font-size:0.72rem;color:rgba(255,255,255,0.4);margin-bottom:6px">Oder bis zu 4 Reihen auswählen:</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px" id="blitz-reihe-grid"></div>
    <button class="btn btn-primary" id="blitz-start-btn" onclick="startBlitz()">▶ Los geht's!</button>
    <button class="btn btn-secondary mt-8" onclick="closeBlitzModal()">Abbrechen</button>
  </div>
</div>
```

- [ ] **Schritt 3: JS-Funktionen für den Picker einfügen**

Direkt vor `// ── GAME STATE ─────────────────────────────────────` (Zeile 1395) einfügen:
```js
// ── BLITZ-MODUS PICKER ─────────────────────────────────
function showBlitzPicker() {
  const cfg = state.blitzConfig;
  const maxR = getMaxReihe();
  // Alle-Button
  const alleBtn = document.getElementById('blitz-alle-btn');
  document.getElementById('blitz-alle-icon').textContent = cfg.alleReihen ? '✅' : '☐';
  alleBtn.classList.toggle('selected', cfg.alleReihen);
  document.getElementById('blitz-alle-sub').textContent = `Reihen 1–${maxR} gemischt`;
  // Grid aufbauen
  const grid = document.getElementById('blitz-reihe-grid');
  grid.innerHTML = '';
  for (let i = 1; i <= maxR; i++) {
    const btn = document.createElement('button');
    btn.className = 'blitz-reihe-btn' + (cfg.reihen.includes(i) ? ' selected' : '');
    btn.textContent = i + 'er';
    btn.disabled = cfg.alleReihen;
    btn.style.opacity = cfg.alleReihen ? '0.4' : '1';
    btn.onclick = () => toggleBlitzReihe(i, btn);
    grid.appendChild(btn);
  }
  updateBlitzStartBtn();
  document.getElementById('blitz-modal').classList.add('active');
}

function toggleBlitzAlle() {
  const cfg = state.blitzConfig;
  cfg.alleReihen = !cfg.alleReihen;
  if (cfg.alleReihen) cfg.reihen = [];
  saveState();
  showBlitzPicker();
}

function toggleBlitzReihe(n, btn) {
  const cfg = state.blitzConfig;
  cfg.alleReihen = false;
  const idx = cfg.reihen.indexOf(n);
  if (idx >= 0) {
    cfg.reihen.splice(idx, 1);
    btn.classList.remove('selected');
  } else {
    if (cfg.reihen.length >= 4) {
      // älteste entfernen
      const oldest = cfg.reihen.shift();
      document.querySelectorAll('#blitz-reihe-grid .blitz-reihe-btn').forEach(b => {
        if (b.textContent === oldest + 'er') b.classList.remove('selected');
      });
    }
    cfg.reihen.push(n);
    btn.classList.add('selected');
  }
  saveState();
  // Alle-Button aktualisieren
  document.getElementById('blitz-alle-icon').textContent = '☐';
  document.getElementById('blitz-alle-btn').classList.remove('selected');
  updateBlitzStartBtn();
}

function updateBlitzStartBtn() {
  const cfg = state.blitzConfig;
  const btn = document.getElementById('blitz-start-btn');
  if (cfg.alleReihen || !cfg.reihen.length) {
    btn.textContent = '▶ Los geht\'s! (Alle)';
  } else {
    btn.textContent = '▶ Los geht\'s! (' + cfg.reihen.slice().sort((a,b)=>a-b).map(r=>r+'er').join(', ') + ')';
  }
}

function closeBlitzModal() {
  document.getElementById('blitz-modal').classList.remove('active');
}

function startBlitz() {
  const cfg = state.blitzConfig;
  if (!cfg.alleReihen && cfg.reihen.length === 0) cfg.alleReihen = true;
  saveState();
  closeBlitzModal();
  startGame('blitz');
}

document.getElementById('blitz-modal').addEventListener('click', function(e) {
  if (e.target === this) closeBlitzModal();
});
```

- [ ] **Schritt 4: Blitz-Karte onclick auf showBlitzPicker umstellen**

Zeile 447 (aktuell: `<div class="mode-card blitz" onclick="startGame('blitz')">`):
```html
<div class="mode-card blitz" onclick="showBlitzPicker()">
```

- [ ] **Schritt 5: Im Browser prüfen**

Seite neu laden. Blitz-Karte antippen → Modal öffnet sich.
- „Alle Reihen" ist vorausgewählt (✅), Grid-Buttons ausgegraut.
- „Alle Reihen" antippen → deselektiert, Grid aktiv.
- Reihen 3 und 5 antippen → grün markiert, Start-Button zeigt „3er, 5er".
- 4 weitere antippen (5. Auswahl) → älteste wird automatisch abgewählt.
- „Los geht's!" antippen → Blitz-Spiel startet.
- Blitz beenden → Picker erneut öffnen → letzte Auswahl ist vorausgewählt.

- [ ] **Schritt 6: Commit**
```bash
git add 1x1-trainer/index.html
git commit -m "feat(blitz): Reihen-Picker Modal mit Multi-Select und Persistenz"
```

---

### Task 4: Rekord-Anzeige auf der Blitz-Karte

**Files:**
- Modify: `1x1-trainer/index.html:448-451` (Blitz-Karte HTML)
- Modify: `1x1-trainer/index.html` — `renderHome()` oder Init-Funktion

- [ ] **Schritt 1: HTML der Blitz-Karte erweitern**

Zeilen 448–451 (aktuell):
```html
      <span class="mode-icon">⚡</span>
      <div class="mode-name">Blitz-Modus</div>
      <div class="mode-desc">60 Sekunden</div>
```
Ersetzen durch:
```html
      <span class="mode-icon">⚡</span>
      <div class="mode-name">Blitz-Modus</div>
      <div class="mode-desc">60 Sekunden</div>
      <div id="blitz-rekord-label" style="font-size:0.7rem;color:#fbbf24;margin-top:4px;display:none">🏆 Rekord: <strong id="blitz-rekord-val">0</strong></div>
```

- [ ] **Schritt 2: Funktion zum Aktualisieren des Rekord-Labels**

Direkt nach der `updateBlitzStartBtn`-Funktion (Task 3) einfügen:
```js
function updateBlitzRekordLabel() {
  const best = state.highScores.blitz;
  const el = document.getElementById('blitz-rekord-label');
  if (!el) return;
  if (best > 0) {
    document.getElementById('blitz-rekord-val').textContent = best;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}
```

- [ ] **Schritt 3: Label beim Homescreen-Rendern aktualisieren**

Die Funktion `renderHome()` suchen (grep nach `function renderHome` oder nach `stats-home-desc`). Dort am Ende `updateBlitzRekordLabel()` aufrufen. Falls keine eigene `renderHome`-Funktion existiert, den Aufruf an `showScreen('home')` anhängen — in der `showScreen`-Funktion nach dem Block `if (id === 'home')` einfügen:
```js
    updateBlitzRekordLabel();
```

- [ ] **Schritt 4: Im Browser prüfen**

Blitz-Spiel spielen und beenden. Homescreen: Blitz-Karte zeigt `🏆 Rekord: {n}`.
Seite neu laden: Rekord bleibt sichtbar (aus localStorage).

- [ ] **Schritt 5: Commit**
```bash
git add 1x1-trainer/index.html
git commit -m "feat(blitz): Rekord-Anzeige auf der Hauptseite"
```

---

### Task 5: Highscore nach Spielende eintragen

**Files:**
- Modify: `1x1-trainer/index.html:1694` (endGame, highScores-Update)

- [ ] **Schritt 1: blitzListe nach jedem Blitz-Spiel aktualisieren**

Zeile 1694 (aktuell: `if (game.mode==='blitz' && game.correct > state.highScores.blitz) ...`).
Den Blitz-Block ersetzen durch:
```js
  if (game.mode === 'blitz') {
    if (game.correct > state.highScores.blitz) state.highScores.blitz = game.correct;
    const entry = {
      score: game.correct,
      reihen: state.blitzConfig.alleReihen ? [] : state.blitzConfig.reihen.slice().sort((a,b)=>a-b),
      alleReihen: state.blitzConfig.alleReihen || !state.blitzConfig.reihen.length,
      datum: new Date().toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric'})
    };
    state.highScores.blitzListe.push(entry);
    state.highScores.blitzListe.sort((a,b) => b.score - a.score);
    state.highScores.blitzListe = state.highScores.blitzListe.slice(0, 5);
  }
```

- [ ] **Schritt 2: Im Browser prüfen**

Blitz-Spiel spielen. DevTools → Local Storage → `henry_einmaleins`:
`highScores.blitzListe` enthält einen Eintrag mit `score`, `reihen`, `alleReihen`, `datum`.
Mehrere Spiele spielen → Liste wächst bis max. 5, absteigend sortiert.

- [ ] **Schritt 3: Commit**
```bash
git add 1x1-trainer/index.html
git commit -m "feat(blitz): Top-5-Highscore nach jedem Spiel eintragen"
```

---

### Task 6: Highscore-Seite (neue Screen-Sektion)

**Files:**
- Modify: `1x1-trainer/index.html` — HTML-Screen, Nav-Karte, JS-Render-Funktion

- [ ] **Schritt 1: HTML-Screen einfügen**

Direkt nach dem schließenden `</div>` von `screen-trophies` (nach Zeile 570) einfügen:
```html
<!-- BLITZ HIGHSCORES -->
<div id="screen-blitz-highscores" class="screen">
  <div style="text-align:center;padding:20px 0 10px;width:100%">
    <h1 style="font-size:1.8rem;font-weight:900">⚡ Blitz-Rekorde</h1>
    <p style="font-size:0.85rem;color:rgba(255,255,255,0.4);margin-top:4px">Deine besten 5 Blitz-Runden</p>
  </div>
  <div id="blitz-highscores-list" style="width:100%"></div>
  <div class="spacer"></div>
  <button class="btn btn-secondary mt-16" onclick="showScreen('home')" style="max-width:180px">← Zurück</button>
</div>
```

- [ ] **Schritt 2: Render-Funktion für die Highscore-Liste**

Direkt nach `updateBlitzRekordLabel()` (Task 4) einfügen:
```js
function renderBlitzHighscores() {
  const list = state.highScores.blitzListe || [];
  const container = document.getElementById('blitz-highscores-list');
  if (!container) return;
  const medals = ['🥇','🥈','🥉'];
  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);padding:40px 0">Noch keine Blitz-Runde gespielt</div>';
    return;
  }
  container.innerHTML = list.map((entry, i) => {
    const reihenText = entry.alleReihen ? 'Alle Reihen' : 'Reihen: ' + entry.reihen.join(', ');
    const rank = i < 3 ? medals[i] : `<span style="color:rgba(255,255,255,0.3);font-size:0.9rem">${i+1}.</span>`;
    const highlight = i === 0 ? 'background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.35)' : 'background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1)';
    const scoreColor = i === 0 ? '#fbbf24' : i < 3 ? '#e5e7eb' : '#9ca3af';
    const scoreSize = i === 0 ? '1.15rem' : i < 3 ? '1rem' : '0.9rem';
    return `<div style="border:1px solid;border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;${highlight}">
      <div style="font-size:${i < 3 ? '1.3rem' : '1rem'};min-width:28px;text-align:center">${rank}</div>
      <div style="flex:1">
        <div style="font-weight:800;color:${scoreColor};font-size:${scoreSize}">${entry.score} richtig</div>
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.35)">${reihenText} · ${entry.datum}</div>
      </div>
    </div>`;
  }).join('');
}
```

- [ ] **Schritt 3: renderBlitzHighscores beim Wechsel auf die Seite aufrufen**

In der `showScreen`-Funktion den Block für Screen-Wechsel suchen. Dort ergänzen:
```js
  if (id === 'blitz-highscores') renderBlitzHighscores();
```

- [ ] **Schritt 4: Navigations-Karte auf der Hauptseite einfügen**

Direkt vor der Reihen-Power-Karte (Zeile 467, vor dem `<div class="mode-card" onclick="showScreen('stats')"`) einfügen:
```html
    <div class="mode-card" onclick="showScreen('blitz-highscores')" style="grid-column:1/-1;border-color:rgba(245,158,11,0.3);flex-direction:row;justify-content:flex-start;gap:14px;padding:14px 20px;text-align:left">
      <span style="font-size:2rem">🏆</span>
      <div>
        <div class="mode-name">Blitz-Rekorde</div>
        <div class="mode-desc" id="blitz-highscores-nav-desc">Noch keine Runden gespielt</div>
      </div>
    </div>
```

- [ ] **Schritt 5: Nav-Beschreibung beim Home-Render aktualisieren**

In `updateBlitzRekordLabel()` (oder direkt danach in der gleichen Aufrufsreihe) ergänzen:
```js
function updateBlitzHighscoresNavDesc() {
  const list = state.highScores.blitzListe || [];
  const el = document.getElementById('blitz-highscores-nav-desc');
  if (!el) return;
  el.textContent = list.length ? `${list.length} Einträge · Rekord: ${list[0].score}` : 'Noch keine Runden gespielt';
}
```
Und `updateBlitzHighscoresNavDesc()` im selben Ort wie `updateBlitzRekordLabel()` aufrufen (beim Home-Screen-Render).

- [ ] **Schritt 6: Im Browser prüfen**

Homescreen: neue „Blitz-Rekorde"-Karte sichtbar (zwischen Trophäen-Zeile und Reihen-Power).
Antippen → Highscore-Seite öffnet sich.
Nach mehreren Blitz-Spielen: Liste zeigt bis zu 5 Einträge, 🥇/🥈/🥉 korrekt, Zurück-Button funktioniert.

- [ ] **Schritt 7: Commit**
```bash
git add 1x1-trainer/index.html
git commit -m "feat(blitz): Highscore-Seite mit Top-5-Liste"
```

---

### Task 7: resetHighscores um blitzListe erweitern + SW-Cache

**Files:**
- Modify: `1x1-trainer/index.html:1236` (resetHighscores)
- Modify: `1x1-trainer/sw.js` (Cache-Name hochzählen)

- [ ] **Schritt 1: resetHighscores aktualisieren**

Zeile 1236 (aktuell: `state.highScores = { blitz: 0, turnier: 0 };`):
```js
  state.highScores = { blitz: 0, turnier: 0, blitzListe: [] };
```

- [ ] **Schritt 2: APP_VERSION und SW-Cache hochzählen**

In `index.html` Zeile 883: `const APP_VERSION = '2.2';`

In `sw.js` den Cache-Namen suchen (z.B. `const CACHE = 'einmaleins-v15'`) und auf `v16` erhöhen.

- [ ] **Schritt 3: Im Browser prüfen**

Einstellungen → „Highscores zurücksetzen": `blitzListe` ist danach leer, Rekord-Label verschwindet, Nav-Karte zeigt „Noch keine Runden gespielt".

- [ ] **Schritt 4: Commit und Push**
```bash
git add 1x1-trainer/index.html 1x1-trainer/sw.js
git commit -m "feat(blitz): resetHighscores + SW v16 + APP_VERSION 2.2"
git push
```
