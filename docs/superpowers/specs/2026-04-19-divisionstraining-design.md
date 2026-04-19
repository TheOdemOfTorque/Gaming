# Divisionstraining — Design-Spec

**Datum:** 2026-04-19
**GitHub Issue:** #8 (TheOdemOfTorque/Gaming)
**Status:** Approved

---

## Überblick

Division wird als dritte Rechenart in alle drei Spielmodi integriert (Training, Blitz, Turnier). Vor jedem Start wählt man zwischen Multiplikation (×), Division (÷) und Gemischt (× ÷). Die Wahl wird pro Modus persistent gespeichert. Fortschritt und Highscores werden getrennt nach Rechenart erfasst.

---

## Datenmodell

### Erweiterung bestehender Configs

```js
// blitzConfig (bestehendes Objekt, neues Feld)
state.blitzConfig.rechenart = 'mult' // 'mult' | 'div' | 'gemischt'

// trainingConfig (neu)
state.trainingConfig = { rechenart: 'mult' }

// turnierConfig (neu)
state.turnierConfig = { rechenart: 'mult' }
```

**Default überall:** `'mult'` — Verhalten wie bisher für bestehende Saves.

### reiheStats — separater Divisions-Zähler

```js
reiheStats[n] = {
  consecutivePerfect: 0,   // Multiplikation (bestehend, Migration: bleibt)
  correct: 0,
  wrong: 0,
  divConsecutivePerfect: 0, // Division (neu)
  divCorrect: 0,
  divWrong: 0
}
```

Eine Reihe gilt für × als gemeistert bei `consecutivePerfect >= 6`, für ÷ bei `divConsecutivePerfect >= 6`.

### Highscores — neue Felder

```js
highScores.blitzDiv      = 0   // bester ÷-Blitz-Score
highScores.blitzGemischt = 0   // bester ×÷-Blitz-Score
// blitzListe-Einträge erhalten zusätzliches Feld:
//   rechenart: 'mult' | 'div' | 'gemischt'
// (bestehende Einträge ohne dieses Feld → als 'mult' behandeln)

highScores.turnierDiv      = 0
highScores.turnierGemischt = 0
// state.highScores.turnier bleibt (= Multiplikation)
```

### State-Migration

`STATE_VERSION` → 4. Migration v3→v4:
- `state.trainingConfig` anlegen mit `{ rechenart: 'mult' }`
- `state.turnierConfig` anlegen mit `{ rechenart: 'mult' }`
- `state.blitzConfig.rechenart` auf `'mult'` setzen falls fehlt
- Alle `reiheStats[n]` um `divConsecutivePerfect`, `divCorrect`, `divWrong` erweitern (Default 0)
- `highScores.blitzDiv`, `highScores.blitzGemischt`, `highScores.turnierDiv`, `highScores.turnierGemischt` auf 0 setzen

---

## Frage-Generierung

### Hilfsfunktion `resolveRechenart(modus)`

```js
function resolveRechenart(modus) {
  const cfg = modus === 'blitz' ? state.blitzConfig
            : modus === 'turnier' ? state.turnierConfig
            : state.trainingConfig;
  if (cfg.rechenart === 'gemischt') return Math.random() < 0.5 ? 'mult' : 'div';
  return cfg.rechenart;
}
```

### Erweiterung `makeQuestion()`

`a` und `b` werden wie bisher bestimmt (je nach Modus). Danach:

```js
const rechenart = resolveRechenart(game.mode); // 'mult' | 'div'
const ans     = rechenart === 'div' ? b          : a * b;
const display = rechenart === 'div' ? `${a*b} ÷ ${a} = ?` : `${a} × ${b} = ?`;

// Distractors bei Division: ± kleine Ganzzahlen um b
const pool = new Set();
if (rechenart === 'div') {
  [-2,-1,1,2,3,4].forEach(d => { if (b+d > 0) pool.add(b+d); });
} else {
  // bestehende Distractor-Logik (unverändert)
}
```

Rückgabe: `{ a, b, rechenart, ans, display, choices }` — `display` wird in `nextQuestion()` ins DOM geschrieben statt des fixen `${a} × ${b} = ?`.

### Leitner-Buchung in `endGame`

```js
if (game.op === 'div') {
  stat.divCorrect  += game.correct;
  stat.divWrong    += game.wrong;
  if (allCorrect) stat.divConsecutivePerfect++;
  else            stat.divConsecutivePerfect = 0;
} else {
  // bestehende Mult-Logik
}
```

`game.rechenart` wird in `_doStartGame` auf den Config-Wert des Modus gesetzt (z.B. `'gemischt'`). Pro Frage löst `resolveRechenart()` bei `'gemischt'` zufällig auf `'mult'` oder `'div'` auf und speichert das Ergebnis in `q.rechenart`.

---

## UI

### Rechenart-Toggle (wiederverwendete Komponente)

Drei Buttons nebeneinander: **×**, **÷**, **× ÷**. Der aktive Button ist in der Akzentfarbe des Modus hervorgehoben (gelb für Blitz, blau für Turnier, grün für Training).

### ① Blitz-Picker

Rechenart-Toggle als erste Zeile, vor dem Alle-Reihen-Toggle. Start-Button-Label: `▶ Los geht's! (Alle · ÷)` oder `▶ Los geht's! (3er, 5er · × ÷)`.

### ② Turnier

`onclick="startGame('turnier')"` → `onclick="showTurnierPicker()"`. Neues Mini-Modal:
- Titel: `🏆 Turnier`
- Subtitle: `10 Fragen · steigende Schwierigkeit`
- Rechenart-Toggle
- Start-Button + Abbrechen-Link

### ③ Training-Reihen-Auswahl

Rechenart-Toggle oben über dem bestehenden Reihen-Grid. Jede Reihen-Karte zeigt zwei Fortschrittszeilen:
- `× gemeistert ✅` / `× N von 6 ⭐` / `× noch nicht geübt`
- `÷ gemeistert ✅` / `÷ N von 6 ⭐` / `÷ noch nicht geübt`

### Frage-Bildschirm

Modus-Label (`#game-mode-label`) zeigt Rechenart: `⚡ Blitz · ÷` oder `🏆 Turnier · × ÷`. Fragetext kommt aus `q.display`.

### Blitz-Rekord auf Startseite

`updateBlitzRekordLabel()` zeigt den Rekord der zuletzt gespeicherten Blitz-Rechenart:
- `🏆 Rekord: 42 (×)` — wenn `blitzConfig.rechenart === 'mult'`
- `🏆 Rekord: 28 (÷)` — wenn `blitzConfig.rechenart === 'div'`
- `🏆 Rekord: 35 (× ÷)` — wenn `blitzConfig.rechenart === 'gemischt'`

### Blitz-Highscore-Seite

Jeder Eintrag zeigt Rechenart-Badge: `× · ⌨️ Eintippen · 19.04.2026`. Bestehende Einträge ohne `rechenart`-Feld werden als `×` dargestellt.

---

## Highscore-Buchung

```js
// in endGame, Blitz-Block:
const hsKey = game.rechenart === 'div' ? 'blitzDiv'
            : game.rechenart === 'gemischt' ? 'blitzGemischt'
            : 'blitz';
if (game.correct > state.highScores[hsKey]) state.highScores[hsKey] = game.correct;

// Turnier analog mit 'turnier' | 'turnierDiv' | 'turnierGemischt'
```

---

## Nicht im Scope

- Getrennte Top-5-Listen pro Rechenart (eine globale `blitzListe` für alle drei)
- Divisions-Achievements (können später als Issue ergänzt werden)
- Reihen-Power-Seite mit Divisions-Fortschritt (bestehende Seite bleibt unverändert; `consecutivePerfect` für × bleibt Basis der „gemeistert"-Anzeige)
