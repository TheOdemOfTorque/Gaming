# Testable-Logic-Extraction — Design-Spec

**Datum:** 2026-05-16
**Projekt:** 1x1-trainer
**Branch (geplant):** `feature/testable-logic`
**Status:** Approved (Brainstorming abgeschlossen)

---

## Überblick

Pure Funktionen aus `1x1-trainer/index.html` in `1x1-trainer/logic.js` extrahieren, damit sie mit Jest testbar werden. Das aktuelle Browser-Verhalten ist die Source of Truth — das Refactoring darf es **nicht** verändern. Drei Klassen von Funktionen, drei Behandlungs-Strategien. Ergebnis: ~17 testbare Funktionen in `logic.js`, neue Unit-Test-Files für alle bisher ungetesteten Bereiche, neue Playwright-Smoke-Suite zur Regression-Sicherung.

---

## Motivation — Status Quo

- `1x1-trainer/index.html` enthält ~3325 Zeilen, das meiste inline JS.
- `1x1-trainer/logic.js` existiert (55 Zeilen, 5 pure Funktionen) und ist via `module.exports` Jest-testbar.
- **Aber**: `logic.js` wird **nirgendwo** im `index.html` per `<script src>` geladen.
  - Folge 1: Funktionen sind dupliziert (`pickBlitzReihe`, `resolveRechenart` existieren beide inline und in `logic.js`).
  - Folge 2: `pickBlitzReihe` divergiert sogar in der API — `logic.js`: `(cfg, max) → number|null`; inline: `() → number`.
  - Folge 3: Die existierenden Jest-Tests sind **Vapor-Tests** — sie schützen Code, den der Browser nicht ausführt.
- Service Worker (`sw.js`) listet `logic.js` bereits im Cache-Asset-Array — die Deploy-Pipeline ist also schon halb vorbereitet, nur der Script-Tag im HTML fehlt.

---

## Iron Rule — Verhaltenserhalt

Das aktuelle `index.html`-Verhalten ist die **Source of Truth**. Tests werden zur Versicherung gegen unbeabsichtigte Drift, nicht zum Treiber neuen Verhaltens. Bei Diskrepanz zwischen `logic.js` und `index.html` gewinnt `index.html`.

### Was als „beobachtbar" gilt (muss erhalten bleiben)

- Output für gegebenen Input
- Mutationen am `state`-Objekt (Shape, Werte, Reihenfolge)
- Exception-Verhalten (welche Calls werfen / nicht werfen)
- Object-Identität von `state.questionStats[r][f]` (Best Effort)

### Was nicht als beobachtbar gilt

- RNG-Consumption-Pattern (keine Seeded-RNG im Projekt)
- Performance (Funktionsaufruf-Overhead vernachlässigbar)
- Exception-Texte (nur ob/dass geworfen wird, zählt)

---

## Architektur

### Status Quo

```
1x1-trainer/
  index.html     ~3325 Zeilen, alles inline, Duplikate gegen logic.js
  logic.js       55 Zeilen, IM BROWSER NICHT GELADEN

tests/unit/
  blitz-logic.test.js     existierend, testet ungenutzten Code (Vapor)
  division-logic.test.js  dito
tests/e2e/
  blitz.spec.js, division.spec.js
playwright.config.js
package.json   Jest + @playwright/test
```

### Ziel-Zustand

```
1x1-trainer/
  index.html     ~3100 Zeilen, lädt logic.js, keine Logik-Duplikate
  logic.js       ~250-300 Zeilen, alle pure Funktionen
  sw.js          CACHE auf v19 hochgezählt
  ...

tests/unit/
  blitz-logic.test.js, division-logic.test.js   bestehend, ggf. auditiert
  state-defaults.test.js                         NEU
  state-migrations.test.js                       NEU
  level-progression.test.js                      NEU
  leitner.test.js                                NEU
  random-helpers.test.js                         NEU
tests/e2e/
  refactoring-smoke.spec.js                      NEU
```

### Lade-Mechanismus

```html
<script src="logic.js"></script>     <!-- VOR dem inline-Script -->
<script>
  /* bestehender inline-Code, ruft logic.js-Funktionen direkt auf */
</script>
```

Reihenfolge ist kritisch — beide Scripts sind synchron, `logic.js` muss vor dem inline-Script evaluiert sein.

### Sichtbarkeit zwischen Scripts (Konvention für `logic.js`)

Top-Level `var` für Konstanten + `function` für Funktionen — beide werden in nicht-Module-Scripts zu Properties des globalen Objekts und sind damit cross-script sichtbar. `const` und `let` wären **nicht** cross-script sichtbar (script-scoped) — bewusst vermieden, kein Build-Step.

```js
// logic.js
var STATE_VERSION = 4;
var STAR_COSTS = [800, 1400, 2000, 2800];
var LEVELS = [ /* ... */ ];

function defaultSettings() { /* ... */ }
function migrateState(s) { /* ... */ }
function getLevelInfo(xp) { /* ... */ }
// ...

if (typeof module !== 'undefined') {
  module.exports = { STATE_VERSION, STAR_COSTS, LEVELS,
                     defaultSettings, /* ... */ };
}
```

---

## Komponenten — Funktions-Mapping

### Klasse 1: Pure, direkter Move (keine API-Änderung)

| Funktion / Konstante | Quelle (heute) |
|---|---|
| `STATE_VERSION` | `index.html:976` |
| `STAR_COSTS` | `index.html:883` |
| `LEVELS` | `index.html:885` |
| `defaultSettings()` | `index.html:940` |
| `defaultReiheStats()` | `index.html:946` |
| `defaultState()` | `index.html:955` |
| `defaultQS()` *(neu, extrahiert aus `getQS`-Inline-Init)* | — |
| `STATE_MIGRATIONS` | `index.html:978` |
| `migrateState(s)` | `index.html:1031` |
| `getLevelInfo(xp)` | `index.html:1059` |
| `shuffle(a)` | `index.html:1728` |
| `rnd(min, max)` | `index.html:1732` |

### Klasse 2: State-lesend, API-Änderung zu Parametern

| Vorher (in HTML) | Nachher (in `logic.js`) |
|---|---|
| `getMaxReihe()` | `getMaxReihe(settings)` |
| `getMaxFactor(reihe)` | `getMaxFactor(settings, reihe)` |
| `getQuestionWeight(reihe, factor)` | `getQuestionWeight(questionStats, reihe, factor)` |
| `pickWeightedFactor(reihe, maxF)` | `pickWeightedFactor(questionStats, reihe, maxF)` |

Call-Sites in `index.html` werden pro Funktion angepasst, z.B.:
```js
// vorher:
const max = getMaxFactor(reihe);
// nachher:
const max = getMaxFactor(state.settings, reihe);
```

### Klasse 3: State-mutierend, gespalten (Wrapper bleibt in HTML)

`getQS(reihe, factor)` bleibt als dünner Wrapper in `index.html`, ruft `defaultQS()` aus `logic.js` für die Initial-Form:

```js
// In index.html (bleibt):
function getQS(reihe, factor) {
  if (!state.questionStats[reihe])         state.questionStats[reihe] = {};
  if (!state.questionStats[reihe][factor]) state.questionStats[reihe][factor] = defaultQS();
  return state.questionStats[reihe][factor];
}
```

Begründung: Referenz-Identität bei wiederholtem Aufruf muss erhalten bleiben (Aufrufer mutiert die Rückgabe).

### Bestehend in `logic.js` — Audit-Bedarf

| Funktion | Audit-Entscheidung |
|---|---|
| `pickBlitzReihe(cfg, max)` | API der pure Variante behalten. Inline-Duplikat aus `index.html:1777` löschen. Call-Site auf `pickBlitzReihe(state.blitzConfig, getMaxReihe(state.settings)) ?? rnd(1, getMaxReihe(state.settings))` umstellen. |
| `resolveRechenart(cfg)` | Identisch zu Inline-Version. Inline-Duplikat aus `index.html:1783` löschen. |
| `addBlitzListeEntry(liste, entry)` | Auditieren: wird die Funktion vom Browser-Code aufgerufen? Falls nicht, Inline-Stelle finden und durch Aufruf ersetzen. |
| `migrateBlitzState(s)` | Vermutlich Duplikat zu `STATE_MIGRATIONS[2]` (v2→v3). Entscheidung: aus `logic.js` entfernen, `STATE_MIGRATIONS[2]` ist Single Source. Tests entsprechend anpassen. |
| `migrateDivState(s)` | Analog zu `STATE_MIGRATIONS[3]` (v3→v4). Entfernen. |

### Was in `index.html` bleibt (bewusst nicht extrahiert)

- `getQS` (Wrapper, siehe oben)
- `saveState`, `getName`, `getActiveRechenartCfg` — nicht pure
- Alle UI/DOM/Audio-Funktionen
- `ACHIEVEMENTS`-Array + Unlock-Logik (eng gekoppelt mit State-Mutation + UI; potenzielle pure Detection-Funktion ist Folge-Refactor)
- `generateTrainingSequence(reihe)` — könnte später pure werden, aber nicht in Wave 1

---

## PWA / Versionierung

| Datei | Heute | Nach Refactoring | Warum |
|---|---|---|---|
| `sw.js` `CACHE` | `'1x1-trainer-v18'` | `'1x1-trainer-v19'` | Cache-Invalidation für bestehende PWAs |
| `sw.js` `ASSETS` | enthält `logic.js` schon | unverändert | bereits korrekt |
| `index.html` `APP_VERSION` | `'2.3'` | `'2.4'` | Settings-Anzeige, Konvention laut Code-Kommentar |

Version-Bumps gehören in den **letzten Commit** vor Merge/Release, nicht in die einzelnen Extraktions-Commits.

---

## Edge Cases zum Erhalten

Auswahl, alle muss-erhalten. Vollständige Liste in den Test-Files (`leitner.test.js`, `state-migrations.test.js`, `level-progression.test.js`).

| Funktion | Edge Input | Erwartetes Verhalten |
|---|---|---|
| `getMaxFactor` | `settings.grosses1x1 === true`, `settings.reiheMax[reihe]` fehlt oder 0 | `20` (Fallback `\|\| 20`) |
| `getQuestionWeight` | `questionStats[reihe][factor]` fehlt | `5` |
| `getQuestionWeight` | `consecutiveCorrect === 6` | `1` |
| `getQuestionWeight` | `correct === 0`, `wrong === 3` | `10` (`Math.min(4+6, 12)`) |
| `getLevelInfo` | `xp === 0` | Level 1 (`LEVELS[0]`) |
| `getLevelInfo` | `xp === LEVELS[last].xp` | `progress === 1`, kein `next` |
| `migrateState` | `{}` (leer) | komplettes v4-Schema |
| `migrateState` | `_version > STATE_VERSION` | unverändert |
| `migrateState` | unbekannte Top-Level-Felder | bleiben erhalten |
| `pickBlitzReihe(cfg, max)` | `alleReihen: true` oder leere `reihen` | `null` (Caller-Fallback) |

### Bewusst nicht behandelt

- Neue Input-Validation (Iron Rule: nichts hinzufügen, was heute nicht da ist)
- Forward-Compat-Migrations für `_version > STATE_VERSION`
- Defensive Null-Checks, die `index.html` heute nicht hat
- Error-Recovery für nicht ladende `logic.js` (Smoke-Test findet das sofort)

---

## Test-Strategie

### Unit-Tests (Jest, `tests/unit/`)

| Datei | Funktionen | Test-Cases (Richtwert) |
|---|---|---|
| `state-defaults.test.js` | `defaultSettings`, `defaultReiheStats`, `defaultState`, `defaultQS` | ~6 |
| `state-migrations.test.js` | `migrateState`, `STATE_MIGRATIONS[0..3]` | ~12 |
| `level-progression.test.js` | `getLevelInfo`, `LEVELS`-Boundaries | ~8 |
| `leitner.test.js` | `getMaxReihe`, `getMaxFactor`, `getQuestionWeight`, `pickWeightedFactor` | ~15 |
| `random-helpers.test.js` | `shuffle`, `rnd` | ~5 |
| `blitz-logic.test.js`, `division-logic.test.js` | bestehend, Audit-Anpassungen + Entfernung von Tests für `migrateBlitzState` / `migrateDivState` | minus ~5 |

### Konvention für Test-Aufbau

Pro `describe`-Block: Happy Path, Boundary Cases (aus Tabelle oben), Idempotenz/Side-Effect-Erwartung, ggf. Charakterisierungs-Test mit Vorher-Nachher-Snapshot. Beschreibungen deutsch, an `blitz-logic.test.js`-Stil orientiert.

### Stochastische Funktionen

`Math.random` deterministisch via `jest.spyOn(Math, 'random').mockReturnValue(x)`. Zusätzlich statistische Tests (1000 Runs, Verteilungs-Toleranz ±25%) gegen subtile Gewichtungs-Drift.

### Charakterisierungs-Tests während Extraktion

Für Klasse-2-Funktionen vor dem Refactor einen Test schreiben, der die HTML-Inline-Version gegen eine Input-Tabelle laufen lässt und das Ergebnis snapshottet. Nach dem Move muss derselbe Test gegen die pure Version grün bleiben. Diese Tests bleiben als reguläre Unit-Tests in den entsprechenden `*.test.js`-Files.

### E2E-Smoke (Playwright, `tests/e2e/`)

Neuer File `refactoring-smoke.spec.js`. Mindestens diese Tests:

1. **logic.js geladen**: `typeof getLevelInfo === 'function'` etc. via `page.evaluate`
2. **Migration v1→v4**: alten Save in `localStorage` injizieren, reload, geänderten State auslesen, Schema prüfen
3. **Training-Flow**: Reihe wählen, Frage beantworten, XP-Update
4. **Blitz-Flow**: Modus starten, Timer läuft, Highscore wird gespeichert
5. **Console-Errors**: über kompletten App-Durchlauf keine Errors
6. **Service Worker + logic.js im Cache**

**Lauf-Mechanik**: `npm run test:e2e` läuft alle E2E-Tests (`tests/e2e/`). `playwright.config.js:9` ist heute hartkodiert auf eine Worktree-Path; im Plan branch-unabhängig machen — ein Vorschlag: `command: 'python3 -m http.server 8080 --directory .'` zusammen mit `cwd: __dirname` im `webServer`-Block. Damit liegt das Serving immer im Wurzelverzeichnis der jeweiligen Worktree.

### Chrome-MCP-Extension (optional, ad hoc)

Ergänzend für interaktives Debugging bei rotem Test oder spontaner Sanity-Visite. Setzt Claude-Code-Restart nach Extension-Installation voraus. Kein primärer Smoke-Mechanismus, kein Bestandteil der Definition of Done.

---

## Definition of Done

Das Refactoring gilt als abgeschlossen, wenn:

1. ✅ `logic.js` enthält alle Klasse-1- und Klasse-2-Funktionen aus dem Mapping oben
2. ✅ `defaultQS()` ist extrahiert; `getQS`-Wrapper in `index.html` ruft es
3. ✅ `index.html` lädt `logic.js` per `<script src>`, keine Inline-Duplikate mehr
4. ✅ Klasse-2-Call-Sites in `index.html` sind auf neue Signaturen umgestellt
5. ✅ `migrateBlitzState` und `migrateDivState` sind aus `logic.js` entfernt, Tests entsprechend
6. ✅ Neue Unit-Test-Files (5 Stück) sind angelegt und grün
7. ✅ Playwright-Smoke-Suite (`refactoring-smoke.spec.js`) ist angelegt und grün
8. ✅ Bestehende Tests (`blitz-logic.test.js`, `division-logic.test.js`, `blitz.spec.js`, `division.spec.js`) sind weiterhin grün
9. ✅ `sw.js` `CACHE` und `APP_VERSION` sind hochgezählt
10. ✅ Manueller Smoke (kurz, einmalig am Ende) bestätigt: Browser-App funktioniert wie vor dem Refactoring

---

## Bewusst außerhalb des Scopes

| Aspekt | Wann (falls überhaupt) |
|---|---|
| `generateTrainingSequence` pure machen | Folge-Refactor |
| Pure Achievement-Detection (`(state) → newlyUnlockedIds[]`) | Folge-Refactor |
| Code-Coverage-Threshold setzen | Nicht jetzt — Edge-Cases sind der Treiber, nicht Quoten |
| CI-Setup (GitHub Action für `npm test`) | Nice-to-have, könnte im Plan als Bonus auftauchen, nicht Definition of Done |
| `CLAUDE.md`-Aktualisierung (Hinweis auf Jest/Playwright statt „no setup") | Sollte als kleiner Folge-Commit im Plan auftauchen |
| Visuelle Regression / Screenshot-Tests | Nicht relevant — Smoke deckt UI-Funktion ab |

---

## Verweise

- Architektur-Konvention im Repo: `CLAUDE.md` (Stand veraltet, siehe Folge-Commit oben)
- Bestehende Specs als Format-Vorbild: `docs/superpowers/specs/2026-04-19-divisionstraining-design.md`
- Bestehende E2E-Tests als Code-Vorbild: `tests/e2e/blitz.spec.js`
