# Blitz-Modus Erweiterung — Design-Spec

**Datum:** 2026-04-19  
**GitHub Issue:** #6 (TheOdemOfTorque/Gaming)  
**Status:** Approved

---

## Überblick

Der Blitz-Modus wird um drei Features erweitert:
1. Reihen-Auswahl beim Start (Modal, max. 4 Reihen oder „Alle")
2. Rekord-Anzeige direkt auf der Blitz-Karte (Hauptseite)
3. Neue Highscore-Seite mit den Top-5-Ergebnissen

---

## Datenmodell

### Neues Feld: `state.blitzConfig`
Persistent gespeichert, beim nächsten Start vorausgewählt.

```js
blitzConfig: {
  reihen: [3, 5],   // Array mit 1–4 Zahlen; leer = alleReihen aktiv
  alleReihen: false // true → alle Reihen, ignoriert reihen[]
}
```

**Default:** `{ reihen: [], alleReihen: true }` (alle Reihen, wie bisher).

### Neues Feld: `state.highScores.blitzListe`
Array mit max. 5 Einträgen, absteigend nach `score` sortiert.

```js
blitzListe: [
  { score: 42, reihen: [3, 5], alleReihen: false, datum: "2026-04-19" },
  { score: 38, reihen: [],     alleReihen: true,  datum: "2026-04-18" },
  ...
]
```

**Bestehender `state.highScores.blitz`** (Einzelzahl) bleibt erhalten — Rückwärtskompatibilität, wird weiterhin für Achievement-Checks genutzt.

### State-Migration
`STATE_VERSION` wird auf 3 erhöht. Migration v2→v3:
- `state.blitzConfig` anlegen mit Default
- `state.highScores.blitzListe` als leeres Array anlegen

---

## Frage-Generierung

```js
// Bisher:
a = rnd(1, getMaxReihe());

// Neu (Blitz-Modus):
if (state.blitzConfig.alleReihen || !state.blitzConfig.reihen.length) {
  a = rnd(1, getMaxReihe());
} else {
  a = state.blitzConfig.reihen[rnd(0, state.blitzConfig.reihen.length - 1)];
}
```

---

## UI

### ① Blitz-Karte (Hauptseite)
- Unterhalb von „60 Sek. · so viele wie möglich": kleiner goldener Rekord-Text
- Format: `🏆 Rekord: 42` (aus `highScores.blitz`, dem bisherigen Maximum)
- Leer wenn noch kein Ergebnis vorhanden

### ② Reihen-Picker Modal (erscheint beim Antippen der Blitz-Karte)
- Aufbau wie das bestehende Turnier-Reihen-Modal
- Oben: „Alle Reihen"-Toggle (Checkbox-Style)
- Darunter: Reihen-Grid 1–10 (oder 1–20 wenn Großes 1×1 aktiv), **der Größe nach sortiert**
- Multi-Select: bis zu 4 Reihen anwählbar; bei Auswahl einer 5. wird die älteste deselektiert
- „Alle Reihen" deaktiviert Grid-Auswahl (und umgekehrt)
- Start-Button zeigt aktive Reihen: `▶ Los geht's! (3er, 5er)` oder `▶ Los geht's! (Alle)`
- Letzte Auswahl wird aus `state.blitzConfig` wiederhergestellt

### ③ Highscore-Seite (neue Seite)
- Navigation: im Hauptmenü zwischen Spiel-Karten und Reihen-Power
- Titel: `⚡ Blitz-Rekorde`
- Liste mit max. 5 Einträgen:
  - Platz 1: Medaille 🥇, goldene Hervorhebung
  - Platz 2: 🥈, Platz 3: 🥉, Plätze 4–5: schlichte Nummerierung
  - Pro Eintrag: `{score} richtig · Reihen: 3, 5 · {datum}` (oder „Alle Reihen")
- Zurück-Button

---

## Nicht im Scope

- Getrennte Highscore-Listen pro Konfiguration (bewusst: eine globale Top-5)
- Reset-Button für Highscores (existiert bereits in den Einstellungen)
- Mehr als 5 Einträge
