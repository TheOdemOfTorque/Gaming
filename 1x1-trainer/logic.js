// Pure functions — kein DOM, kein localStorage, keine Globals

// ── RNG ────────────────────────────────────────────────
// Standard ist Math.random. Für Multiplayer-Challenges kann ein Spieler:innen-Paar
// per initSeededRNG(seed) deterministisch synchronisiert werden — alle shuffle/rnd-
// Aufrufe in logic.js gehen dann über _rng() und liefern identische Sequenzen.
var _rng = function () { return Math.random(); };
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function initSeededRNG(seed) { _rng = mulberry32(seed); }
function resetRNG()           { _rng = function () { return Math.random(); }; }

var STATE_VERSION = 13;
// Recalibrated 2026-05-16: 3× alte Werte, damit ein Stern ~25-30 min Spielzeit kostet.
var STAR_COSTS = [2400, 4200, 6000, 8400];

// Diamanten als Streak-Schutz-Currency (#18). Fix-Preis 2000 XP, weiches Cap bei 3
// — verhindert, dass Henry einen Dauer-Polster anhäuft und Streaks an Bedeutung verlieren.
var DIAMOND_PRICE = 2000;
var DIAMOND_CAP   = 3;
var LEVELS = [
  { xp:    0, title: '⭐ Anfänger',           avatar: '🚀' },
  { xp:  200, title: '🌟 Lehrling',           avatar: '🌱' },
  { xp:  500, title: '📚 Schüler',            avatar: '📖' },
  { xp:  900, title: '🔢 Fleißiger Rechner',  avatar: '🧮' },
  { xp: 1400, title: '🎯 Mathe-Fan',          avatar: '🎯' },
  { xp: 2000, title: '🦸 Zahlen-Held',        avatar: '🦸' },
  { xp: 2800, title: '⚔️ Rechen-Ritter',      avatar: '⚔️' },
  { xp: 3800, title: '🗡️ Mathe-Krieger',      avatar: '🗡️' },
  { xp: 5000, title: '🏆 Zahlen-Meister',     avatar: '🏆' },
  { xp: 6500, title: '👑 Einmaleins-Legende', avatar: '👑' },
];

function defaultSettings() {
  const reiheMax = {};
  for (let i = 1; i <= 20; i++) reiheMax[i] = 20;
  return { grosses1x1: false, reiheMax, inputMode: 'both', rechenart: 'both' };
}

function defaultReiheStats() {
  const s = {};
  for (let i = 1; i <= 20; i++) s[i] = {
    sessions: 0, totalCorrect: 0, totalQuestions: 0, consecutivePerfect: 0,
    divConsecutivePerfect: 0, divCorrect: 0, divWrong: 0,
    lastAccuracy: null   // v9: Accuracy der letzten Trainings-Session dieser Reihe (0-100, null = noch nie geübt)
  };
  return s;
}

function defaultQS() { return { correct: 0, wrong: 0, consecutiveCorrect: 0 }; }

function defaultState() {
  return { _version: STATE_VERSION, name: '', xp: 0, achievements: [], totalCorrect: 0, totalGames: 0,
           streak: 0, lastPlayDate: null, lastRoundDate: null,
           highScores: { blitz: 0, turnier: 0, blitzListe: [],
                         blitzDiv: 0, blitzGemischt: 0,
                         turnierDiv: 0, turnierGemischt: 0 },
           blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
           trainingConfig: { rechenart: 'mult', reihen: [], alleReihen: false },
           turnierConfig: { rechenart: 'mult' },
           trainedReihen: [], settings: defaultSettings(), reiheStats: defaultReiheStats(),
           streakFreezeUsedDate: null, streakFreezeTotal: 0,
           questionStats: {},
           stars: 0, gameSecondsLeft: 0, diamonds: 0,
           mp: { enabled: false, groupCode: null, nickname: null,
                 pinHash: null, token: null, pendingUploads: [],
                 lastSeedDate: null, lastSeed: null, lastChallengeId: null },
           changelogSeenVersion: null,
           // v12: knobel/jnr müssen hier mit rein — defaultState() setzt _version
           // direkt auf STATE_VERSION, migrateState() würde die v11→v12-Migration
           // für einen Neuinstall also nie laufen lassen.
           knobel: { tagesXp: { datum: null, xp: 0 }, stufe: { mauer: 1, kaefige: 1 } },
           jnr: { v: 1, levels: {}, lastLevel: null, funkenTotal: 0, xpAwarded: {},
                  options: { steuerung: 'standard', mathe: 'ziel', farbhilfe: true, musik: true },
                  tutorialGesehen: false } };
}

var STATE_MIGRATIONS = [
  // v0 → v1: settings, reiheStats, streakFreeze, stars, gameSecondsLeft, questionStats
  (s) => {
    if (!s.settings)                          s.settings           = defaultSettings();
    if (!s.settings.reiheMax)                 s.settings.reiheMax  = defaultSettings().reiheMax;
    if (!s.settings.inputMode)                s.settings.inputMode = 'both';
    if (s.streakFreezeUsedDate === undefined) s.streakFreezeUsedDate = null;
    if (s.streakFreezeTotal    === undefined) s.streakFreezeTotal    = 0;
    if (!s.questionStats)                     s.questionStats      = {};
    if (s.stars           === undefined)      s.stars              = 0;
    if (s.gameSecondsLeft === undefined)      s.gameSecondsLeft    = 0;
    if (!s.reiheStats)                        s.reiheStats         = defaultReiheStats();
    for (let i = 1; i <= 20; i++) {
      if (!s.reiheStats[i]) s.reiheStats[i] = { sessions:0, totalCorrect:0, totalQuestions:0, consecutivePerfect:0 };
    }
    for (let i = 1; i <= 20; i++) {
      if (!s.settings.reiheMax[i]) s.settings.reiheMax[i] = 20;
    }
    return s;
  },
  // v1 → v2: inputMode-Default von 'tap' auf 'both' migrieren
  (s) => {
    if (s.settings && s.settings.inputMode === 'tap') s.settings.inputMode = 'both';
    return s;
  },
  // v2 → v3: blitzConfig + blitzListe
  (s) => {
    if (!s.blitzConfig) s.blitzConfig = { reihen: [], alleReihen: true };
    if (!s.highScores) s.highScores = {};
    if (!s.highScores.blitzListe) s.highScores.blitzListe = [];
    return s;
  },
  // v3 → v4: Division-Rechenart + separate Highscores + reiheStats-Div-Felder
  (s) => {
    if (!s.trainingConfig) s.trainingConfig = { rechenart: 'mult' };
    if (!s.turnierConfig)  s.turnierConfig  = { rechenart: 'mult' };
    if (!s.blitzConfig.rechenart) s.blitzConfig.rechenart = 'mult';
    if (!s.highScores) s.highScores = {};
    if (s.highScores.blitzDiv      === undefined) s.highScores.blitzDiv      = 0;
    if (s.highScores.blitzGemischt === undefined) s.highScores.blitzGemischt = 0;
    if (s.highScores.turnierDiv      === undefined) s.highScores.turnierDiv      = 0;
    if (s.highScores.turnierGemischt === undefined) s.highScores.turnierGemischt = 0;
    if (!s.reiheStats) s.reiheStats = defaultReiheStats();
    for (let i = 1; i <= 20; i++) {
      if (!s.reiheStats[i]) s.reiheStats[i] = defaultReiheStats()[i];
      if (s.reiheStats[i].divConsecutivePerfect === undefined) s.reiheStats[i].divConsecutivePerfect = 0;
      if (s.reiheStats[i].divCorrect            === undefined) s.reiheStats[i].divCorrect            = 0;
      if (s.reiheStats[i].divWrong              === undefined) s.reiheStats[i].divWrong              = 0;
    }
    return s;
  },
  // v4 → v5: Marathon-Modus löst Turnier ab. Alte Turnier-Highscores (Punkte) sind nicht
  // mehr vergleichbar mit neuer Metrik (Anzahl Fragen). Reset auf 0, damit Henry sofort
  // einen neuen Rekord erspielen kann.
  (s) => {
    if (!s.highScores) s.highScores = {};
    s.highScores.turnier         = 0;
    s.highScores.turnierDiv      = 0;
    s.highScores.turnierGemischt = 0;
    return s;
  },
  // v5 → v6: Multiplayer-State (Gruppe, Token, Pending Uploads, letzter Seed).
  (s) => {
    if (!s.mp) s.mp = defaultState().mp;
    return s;
  },
  // v6 → v7: globale Rechenart-Einstellung in settings (löst per-Modus-Toggles in
  // Blitz/Marathon ab, wenn nicht 'both'). Default 'both' = unverändertes Verhalten.
  (s) => {
    if (!s.settings) s.settings = defaultSettings();
    if (!s.settings.rechenart) s.settings.rechenart = 'both';
    return s;
  },
  // v7 → v8: Multi-Reihen-Training. trainingConfig kriegt reihen[] + alleReihen,
  // analog zu blitzConfig. Default leer/false = User wählt beim ersten Picker-Aufruf.
  (s) => {
    if (!s.trainingConfig) s.trainingConfig = { rechenart: 'mult' };
    if (!Array.isArray(s.trainingConfig.reihen))    s.trainingConfig.reihen     = [];
    if (typeof s.trainingConfig.alleReihen !== 'boolean') s.trainingConfig.alleReihen = false;
    return s;
  },
  // v8 → v9: reiheStats kriegt lastAccuracy (Accuracy der letzten Session).
  // Ersetzt die "rolling lifetime accuracy" als Anzeige-Metrik — Lifetime wandert
  // nach langer Zeit nicht mehr und gibt kein Feedback zur jüngsten Performance.
  (s) => {
    if (!s.reiheStats) s.reiheStats = defaultReiheStats();
    for (let i = 1; i <= 20; i++) {
      if (!s.reiheStats[i]) s.reiheStats[i] = defaultReiheStats()[i];
      if (s.reiheStats[i].lastAccuracy === undefined) s.reiheStats[i].lastAccuracy = null;
    }
    return s;
  },
  // v9 → v10: changelogSeenVersion — verhindert rückwirkende Anzeige für
  // existierende User. Auf '2.9' setzen (= Stand bei v9→v10-Bump), neue
  // Einträge ab dann werden gezeigt. Neue User (defaultState) starten mit null,
  // bekommen auf erstem Start ihre aktuelle APP_VERSION zugewiesen.
  (s) => {
    if (s.changelogSeenVersion === undefined) s.changelogSeenVersion = '2.9';
    return s;
  },
  // v10 → v11: diamonds-Currency (#18). Existierende streakFreezeTotal als
  // Loyalty-Geschenk in Diamanten umrechnen (1:1), gedeckelt auf DIAMOND_CAP.
  // Wer früher 5× geschützt hat → 3 Start-Diamanten; wer 0× → 0.
  // streakFreezeTotal bleibt als historischer Counter erhalten (BC).
  (s) => {
    if (s.diamonds === undefined) {
      s.diamonds = Math.min(s.streakFreezeTotal || 0, DIAMOND_CAP);
    }
    return s;
  },
  // v11 → v12: state.knobel (Tagescap-Spiegel + empfohlene Stufen) und
  // state.jnr (Spiegel von JNR.rewards.defaultJnr() — literal statt Laufzeit-
  // Abhängigkeit, damit logic.js dependency-frei bleibt).
  (s) => {
    if (!s.knobel) s.knobel = { tagesXp: { datum: null, xp: 0 }, stufe: { mauer: 1, kaefige: 1 } };
    if (!s.jnr) {
      // tutorialGesehen: Lumos Mitmach-Tutorial (jnr:tutorial). Nur fuer neu angelegte jnr; ein bestehendes
      // jnr ohne das Feld (v12/v13-Staende) bleibt unangetastet. Den Default false liefert dann
      // JNR.rewards.sanitizeJnr beim Lesen von jnr:init im Spiel.
      s.jnr = { v: 1, levels: {}, lastLevel: null, funkenTotal: 0, xpAwarded: {},
                options: { steuerung: 'standard', mathe: 'ziel', farbhilfe: true, musik: true },
                tutorialGesehen: false };
    }
    return s;
  },
  // v12 → v13: lastRoundDate (nur endGame() bei gezählter Runde). Fehlt es,
  // bleibt die Knobelwerkstatt bis zur nächsten Runde gesperrt; lastPlayDate
  // wird bewusst nicht übernommen (Streak-Schutz setzt es ohne Runde).
  (s) => {
    if (s.lastRoundDate === undefined) s.lastRoundDate = null;
    return s;
  },
];

function migrateState(s) {
  const fromVersion = s._version || 0;
  for (let v = fromVersion; v < STATE_VERSION; v++) {
    s = STATE_MIGRATIONS[v](s) || s;
  }
  s._version = STATE_VERSION;
  // achievements gab es schon vor STATE_MIGRATIONS[0] — ein kaputter/unvollständiger
  // Spielstand ohne dieses Feld lässt sonst updateHomeUI() crashen (state.achievements.length).
  if (!Array.isArray(s.achievements)) s.achievements = [];
  return s;
}

function getLevelInfo(xp) {
  let lvl = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) { if (xp >= LEVELS[i].xp) { lvl = i; break; } }
  const cur = LEVELS[lvl], nxt = LEVELS[lvl + 1] || null;
  const xpIn = xp - cur.xp;
  const xpNeed = nxt ? nxt.xp - cur.xp : 1;
  return { level: lvl + 1, title: cur.title, avatar: cur.avatar,
           xpIn, xpNeed, progress: nxt ? Math.min(xpIn / xpNeed, 1) : 1 };
}

function getMaxReihe(settings) { return settings.grosses1x1 ? 20 : 10; }
function getMaxFactor(settings, reihe) {
  if (!settings.grosses1x1) return 10;
  return settings.reiheMax[reihe] || 20;
}

function getQuestionWeight(questionStats, reihe, factor) {
  const qs = questionStats[reihe]?.[factor];
  if (!qs || (qs.correct === 0 && qs.wrong === 0)) return 5;
  if (qs.consecutiveCorrect >= 6) return 1;
  if (qs.consecutiveCorrect === 5) return 2;
  if (qs.consecutiveCorrect >= 3) return 3;
  if (qs.consecutiveCorrect >= 1) return 5;
  return Math.min(4 + qs.wrong * 2, 12);
}

function pickWeightedFactor(questionStats, reihe, maxF) {
  const weights = Array.from({length: maxF}, (_, i) => getQuestionWeight(questionStats, reihe, i + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = _rng() * total;
  for (let i = 0; i < maxF; i++) { r -= weights[i]; if (r <= 0) return i + 1; }
  return maxF;
}

// Generiert die Frage-Sequenz für einen Training-Run.
//
// Input:
//   reihen: Array von Reihen-Nummern (z.B. [3] für Single-Row, [3,7,8] für Mix).
//           Wird zur Sicherheit toleriert: nicht-Array wird in [x] gewrappt.
// Output:
//   Array von {a, b}-Pairs, geshufflet. totalQ ist 20 (kleines 1×1) oder 30
//   (großes 1×1, wenn mindestens eine gewählte Reihe maxF >= 20 hat).
//
// Mix-Verteilung: gleichmäßig per row (Math.floor(totalQ / reihen.length)),
// Remainder auf die ersten Reihen verteilt. Pro Reihe: required-set
// (alle Faktoren, abgeschnitten auf share) + weighted extras via Leitner.
function generateTrainingSequence(questionStats, settings, reihen) {
  if (!Array.isArray(reihen)) reihen = [reihen];
  if (reihen.length === 0) return [];

  const maxF_overall = Math.max(...reihen.map(r => getMaxFactor(settings, r)));
  const totalQ = maxF_overall >= 20 ? 30 : 20;

  const baseShare = Math.floor(totalQ / reihen.length);
  const remainder = totalQ - baseShare * reihen.length;

  const pairs = [];
  reihen.forEach((r, idx) => {
    const share = baseShare + (idx < remainder ? 1 : 0);
    const maxF = getMaxFactor(settings, r);
    const requiredCount = Math.min(maxF, share);
    const required = shuffle(Array.from({ length: maxF }, (_, i) => i + 1)).slice(0, requiredCount);
    // Kein Faktor öfter als ⌈share/2⌉-mal, sonst lässt er sich nicht ohne direkte Wiederholung anordnen
    const maxJeFaktor = Math.ceil(share / 2);
    const anzahl = {};
    required.forEach(b => { anzahl[b] = 1; });
    const extras = [];
    for (let i = 0; i < share - requiredCount; i++) {
      let b = pickWeightedFactor(questionStats, r, maxF);
      if ((anzahl[b] || 0) >= maxJeFaktor) b = required.find(f => anzahl[f] < maxJeFaktor) ?? b;
      anzahl[b] = (anzahl[b] || 0) + 1;
      extras.push(b);
    }
    [...required, ...extras].forEach(b => pairs.push({ a: r, b }));
  });

  return ordneOhneDirekteWiederholung(shuffle(pairs));
}

// Ordnet {a,b}-Paare so an, dass nie dasselbe Paar direkt hintereinander kommt (Marco, 26.10.2026).
// Jede Position wird zufällig gezogen, gewichtet nach Restanzahl (wie ein shuffle), aber nur unter
// Paaren, nach denen der Rest noch lösbar bleibt: Bei Rest m und zuletzt gesetztem Paar k darf kein
// Paar öfter als ⌈m/2⌉-mal übrig sein, k selbst höchstens ⌊m/2⌋-mal. Unlösbare Eingaben (ein Paar
// öfter als ⌈n/2⌉-mal) werden bestmöglich angeordnet. Tests: tests/unit/training-sequence.test.js
function ordneOhneDirekteWiederholung(pairs) {
  const gruppen = new Map();
  pairs.forEach(p => {
    const k = p.a + 'x' + p.b;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(p);
  });
  const loesbar = (k, rest) => {
    for (const [j, g] of gruppen) {
      const n = g.length - (j === k ? 1 : 0);
      if (n > (j === k ? Math.floor(rest / 2) : Math.ceil(rest / 2))) return false;
    }
    return true;
  };
  const out = [];
  let letzte = null;
  while (out.length < pairs.length) {
    const rest = pairs.length - out.length - 1;
    const offen = [...gruppen.entries()].filter(([, g]) => g.length > 0);
    const erlaubt = offen.filter(([k]) => k !== letzte);
    const sicher = erlaubt.filter(([k]) => loesbar(k, rest));
    let kandidaten = sicher;
    if (!kandidaten.length) {
      // Unlösbar: das häufigste erlaubte Paar zuerst abbauen, notfalls eine Wiederholung
      const pool = erlaubt.length ? erlaubt : offen;
      const max = Math.max(...pool.map(([, g]) => g.length));
      kandidaten = pool.filter(([, g]) => g.length === max);
    }
    const summe = kandidaten.reduce((t, [, g]) => t + g.length, 0);
    let r = _rng() * summe, wahl = kandidaten[kandidaten.length - 1];
    for (const e of kandidaten) { r -= e[1].length; if (r < 0) { wahl = e; break; } }
    out.push(wahl[1].pop());
    letzte = wahl[0];
  }
  return out;
}

// Zieht eine Blitz- oder Marathon-Aufgabe neu, solange sie der letzten gleicht (gleiches a und b).
// Nach maxVersuche wird das zuletzt gezogene Paar genommen (nur bei einem Pool aus einem Paar
// denkbar). Tests: tests/unit/random-helpers.test.js
function zieheOhneWiederholung(ziehen, letzte, maxVersuche = 20) {
  let q = ziehen();
  if (!letzte) return q;
  for (let i = 1; i < maxVersuche && q.a === letzte.a && q.b === letzte.b; i++) q = ziehen();
  return q;
}

function pickBlitzReihe(blitzConfig, maxReihe) {
  if (blitzConfig.alleReihen || !blitzConfig.reihen.length)
    return null; // caller uses rnd(1, maxReihe)
  const reihen = blitzConfig.reihen;
  return reihen[Math.floor(_rng() * reihen.length)];
}

function addBlitzListeEntry(liste, entry) {
  const neu = [...liste, entry];
  neu.sort((a, b) => b.score - a.score);
  return neu.slice(0, 5);
}

// Löst 'gemischt' zufällig auf; gibt immer 'mult' oder 'div' zurück.
function resolveRechenart(cfg) {
  const r = (cfg && cfg.rechenart) || 'mult';
  if (r === 'gemischt') return _rng() < 0.5 ? 'mult' : 'div';
  return r;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rnd(min, max) { return Math.floor(_rng() * (max - min + 1)) + min; }

// XP pro richtige Antwort: combo-basierte Tiers (Basis-XP) × modus-Multiplikator.
// Recalibrated 2026-05-16: training boostet Lernen, blitz dämpft Speed-Drill, turnier
// unverändert. Unbekannte Modi fallen auf 1.0 zurück.
var XP_MODE_MULTIPLIERS = { training: 1.5, blitz: 0.4, turnier: 1.3 };
function computeAnswerXP(combo, mode) {
  const baseXP = combo >= 10 ? 13 : combo >= 5 ? 9 : combo >= 3 ? 7 : 5;
  const m = XP_MODE_MULTIPLIERS[mode] != null ? XP_MODE_MULTIPLIERS[mode] : 1.0;
  return Math.round(baseXP * m);
}

// XP-Kosten für nächsten Stern; STAR_COSTS-Array wird am letzten Eintrag gecappt.
function nextStarCost(stars) {
  return STAR_COSTS[Math.min(stars, STAR_COSTS.length - 1)];
}

// XP-Kosten für nächsten Diamant. Fix (DIAMOND_PRICE) bis zum weichen Cap;
// liefert null, wenn der User schon DIAMOND_CAP-viele Diamanten hat (Kauf
// nicht möglich). Caller verwendet das null für UI-Disable.
function nextDiamondCost(currentDiamonds) {
  if ((currentDiamonds || 0) >= DIAMOND_CAP) return null;
  return DIAMOND_PRICE;
}

// Kann der User einen Diamant kaufen? Checkt Cap UND XP-Budget.
function canBuyDiamond(state) {
  const cost = nextDiamondCost(state.diamonds || 0);
  if (cost === null) return false;
  return (state.xp || 0) >= cost;
}

// Wendet einen Diamant-Kauf an. Pure: input-state nie mutiert. Liefert
// neuen State + Erfolgs-Flag. UI-Schicht macht side effects (saveState,
// updateHomeUI, showToast). Tests: tests/unit/diamond-purchase.test.js
function applyDiamondPurchase(state) {
  if (!canBuyDiamond(state)) {
    return { state, success: false };
  }
  const next = Object.assign({}, state, {
    xp: (state.xp || 0) - DIAMOND_PRICE,
    diamonds: (state.diamonds || 0) + 1,
  });
  return { state: next, success: true };
}

// Berechnet Streak-Schutz nach Datum-Lücke. Pure: input-state nie mutiert.
//
// Liefert { state, saved, broken }:
//   - state: neuer State (lastPlayDate, diamonds, streak ggf. angepasst)
//   - saved: true wenn ein Diamant eingelöst wurde
//   - broken: true wenn Streak gebrochen wurde (0 Diamanten + Lücke)
//
// Logik:
//   - lastPlayDate ist heute oder gestern → keine Aktion (Streak heil)
//   - state.streak < 1 oder lastPlayDate fehlt → keine Aktion
//   - Lücke entdeckt + diamonds >= 1 → 1 Diamant verbrauchen, lastPlayDate=today,
//     streakFreezeUsedDate + streakFreezeTotal aktualisieren
//   - Lücke entdeckt + diamonds === 0 → streak=0
//
// Tests: tests/unit/streak-protection.test.js
function computeStreakProtection(state, todayStr) {
  // Default no-op return
  const noop = { state, saved: false, broken: false };
  if (!state.lastPlayDate)  return noop;
  if ((state.streak || 0) < 1) return noop;
  if (state.lastPlayDate === todayStr) return noop;

  // Kalendertag statt "jetzt minus 24 h": an Zeitumstellungstagen (25 h) laege das sonst noch auf heute.
  const y = new Date(todayStr);
  y.setDate(y.getDate() - 1);
  const yesterdayStr = y.toDateString();
  if (state.lastPlayDate === yesterdayStr) return noop;

  // Lücke: heute ≠ gestern relativ zum lastPlayDate.
  if ((state.diamonds || 0) >= 1) {
    const next = Object.assign({}, state, {
      diamonds: state.diamonds - 1,
      streakFreezeUsedDate: new Date().toISOString(),
      streakFreezeTotal: (state.streakFreezeTotal || 0) + 1,
      lastPlayDate: todayStr,
    });
    return { state: next, saved: true, broken: false };
  }

  // 0 Diamanten — Streak bricht.
  const next = Object.assign({}, state, { streak: 0 });
  return { state: next, saved: false, broken: true };
}

// ── SPIELE-ZUGANG ──────────────────────────────────────────────────────────
// Von Marco bestätigt am 30.10.2026 (siehe Vault-Plan Spiele-Integration):
// Space Invader und Lumo kosten Stern-Zeit und brauchen 3 Tage Streak (wie
// bisher nur Invader); die Knobelwerkstatt ist ein Lernspiel ohne Sterne und
// Streak-Mindestwert, im Trainer aber erst nach einer gezählten Runde am selben
// Kalendertag spielbar (nachRundeHeute). Die Adresse /knobel/ bleibt offen.
const GAME_RULES = {
  invader: { kostetSternZeit: true,  minStreak: 3 },
  jnr:      { kostetSternZeit: true,  minStreak: 3 },
  knobel:   { kostetSternZeit: false, minStreak: 0, nachRundeHeute: true },
};

// Tests: tests/unit/spiele-zugang.test.js
// heute: new Date().toDateString(); lastRoundDate setzt nur endGame() bei einer Runde. Kalendertag-Vergleich, keine 24-h-Rechnung.
function getGameAccess(state, gameId, heute) {
  const rule = GAME_RULES[gameId];
  if (!rule) return { spielbar: false, grund: 'unbekannt' };
  if (rule.nachRundeHeute && state.lastRoundDate !== (heute || new Date().toDateString())) {
    return { spielbar: false, grund: 'keine_runde' };
  }
  if ((state.streak || 0) < rule.minStreak) return { spielbar: false, grund: 'streak' };
  if (rule.kostetSternZeit && (state.stars || 0) === 0 && (state.gameSecondsLeft || 0) <= 0) {
    return { spielbar: false, grund: 'keine_sterne' };
  }
  return { spielbar: true, grund: null };
}

// Zählt die Runde für die Knobel-Freischaltung (state.lastRoundDate)? Nur ein durchgespieltes
// Training (endGame('complete')) mit mindestens einer beantworteten Aufgabe; Blitz und Marathon
// schalten nichts frei (Marco, 26.10.2026). Die Streak-Logik in endGame() ist davon unabhängig.
// Tests: tests/unit/spiele-zugang.test.js
function rundeSchaltetKnobelFrei(game, reason) {
  if (!game || game.mode !== 'training' || reason !== 'complete') return false;
  return (game.correct || 0) + (game.wrong || 0) > 0;
}

// ── SPIELZEIT (gleiche Regel für Space Invader und Lumo, Marco 30.10.2026) ──
// Die Stern-Zeit läuft, solange das Spiel offen und sichtbar ist, auch im Menü (Lumo: Levelauswahl
// und Reihenwahl). Sie steht in der Pause, im Hintergrund und in Dialogen, die das Spiel anhalten.
// Bei 0:00 mit Sternen: „Stern einsetzen & weiterspielen“, ohne Sterne: Hinweis, zurück zum Trainer.
// Tests: tests/unit/spielzeit.test.js, tests/unit/lumo-aktiv.test.js

// Lumo meldet per jnr:aktiv, ob ein Level läuft (aktiv) und ob die Stern-Zeit laufen soll (zeit),
// Vertrag jumpnrun/core/host.js. Zustand { meldet, aktiv, zeit }: meldet = Lumo kennt die Nachricht.
// Fallbacks: Ein Lumo ohne jnr:aktiv (alter Cache) lässt den Timer wie früher durchlaufen; ein Lumo
// ohne Feld zeit meldet aktiv nur im Level, dann gilt zeit = aktiv.
function lumoAktivNeu() { return { meldet: false, aktiv: false, zeit: false }; }
function applyJnrAktiv(z, data) {
  if (!data || typeof data.aktiv !== 'boolean') return z;
  if (typeof data.zeit === 'boolean') return { meldet: true, aktiv: data.aktiv, zeit: data.zeit };
  if ('zeit' in data) return { meldet: true, aktiv: data.aktiv, zeit: false };
  return { meldet: true, aktiv: data.aktiv, zeit: data.aktiv };
}
// sichtbar: !document.hidden; sternZeit: Stern-Zeit ist für dieses Öffnen eingelöst (Spiel geladen).
function lumoTimerSollLaufen(z, { sichtbar, sternZeit }) {
  return !!sternZeit && !!sichtbar && (!z.meldet || !!z.zeit);
}

// Space Invader: die Zeit steht in der Pause (showPause), in den Einstellungen aus der Pause, solange
// der Stern-Dialog offen ist und im Hintergrund. Menü, Spiel, Game Over und Bestenliste zählen.
function invaderTimerSollLaufen({ invState, settFrom, sichtbar, sternDialog }) {
  if (!sichtbar || sternDialog) return false;
  if (invState === 'paused') return false;
  if (invState === 'settings' && settFrom === 'pause') return false;
  return true;
}

// Gemeinsamer Stern-Timer (index.html startStarTimer): verbrauchte Millisekunden werden über Pausen
// hinweg gesammelt, abgezogen wird je volle Sekunde (Review B3: viele kurze Pausen verschluckten sonst
// die angefangenen Sekunden). dtMs < 0 oder kaputt zählt nicht; mehr als 5 s je Schritt (z.B. nach
// einem eingefrorenen Tab) zählen höchstens 5 s. Tests: tests/unit/spielzeit.test.js
const SPIELZEIT_MAX_SCHRITT_MS = 5000;
function sammleSpielzeit(gesammeltMs, dtMs) {
  const g = typeof gesammeltMs === 'number' && isFinite(gesammeltMs) && gesammeltMs > 0 ? gesammeltMs : 0;
  const dt = typeof dtMs === 'number' && isFinite(dtMs) && dtMs > 0 ? Math.min(dtMs, SPIELZEIT_MAX_SCHRITT_MS) : 0;
  const summe = g + dt;
  const sekunden = Math.floor(summe / 1000);
  return { gesammeltMs: summe - sekunden * 1000, sekunden };
}

// Stern-Zeit bei 0:00, für beide Spiele gleich: mit Sternen 'stern_anbieten', sonst 'ende'.
// Der Stern selbst wird mit sternZeitEinloesen eingesetzt.
function zeitAbgelaufenAktion(state) {
  return (state.stars || 0) > 0 ? 'stern_anbieten' : 'ende';
}

// Zeitanzeige für Invader (#invader-timer) und Lumo (#game-overlay-timer): rot ab 2 Minuten.
const ZEIT_WARNUNG_AB_SEK = 120;
function zeitAnzeige(sekunden) {
  const sek = typeof sekunden === 'number' && isFinite(sekunden) && sekunden > 0 ? Math.floor(sekunden) : 0;
  const m = Math.floor(sek / 60);
  const ss = sek % 60;
  return { text: `⏱ ${m}:${String(ss).padStart(2, '0')}`, warnung: sek <= ZEIT_WARNUNG_AB_SEK };
}

// Lumo will verlassen werden (Knopf "Zurück zum Trainer" im Menü oder im Dialog "Deine Stern-Zeit
// ist vorbei", Vertrag jumpnrun/core/host.js, jnr:beenden): nur, wenn Lumo gerade im Overlay läuft.
// Nach jnr:timeup wartet der Trainer LUMO_BEENDEN_FALLBACK_MS auf jnr:zeitende (Bestätigung, siehe
// lumoZeitendeBestaetigt) oder jnr:beenden und schließt sonst selbst (altes Lumo aus dem Cache kennt
// beide Nachrichten nicht). Tests: tests/unit/lumo-beenden.test.js
const LUMO_BEENDEN_FALLBACK_MS = 5000;
function lumoBeendenGewuenscht(currentGame, data) {
  return currentGame === 'jnr' && !!data && typeof data === 'object' && data.type === 'jnr:beenden';
}

// Lumo bestätigt jnr:timeup mit jnr:zeitende: der Dialog „Deine Stern-Zeit ist vorbei“ steht, das Kind
// schließt ihn selbst. Der Trainer löscht dann den Fallback und wartet beliebig lange auf jnr:beenden.
function lumoZeitendeBestaetigt(currentGame, data) {
  return currentGame === 'jnr' && !!data && typeof data === 'object' && data.type === 'jnr:zeitende';
}

// Das ✕ der Trainer-Leiste bleibt Notausgang, löst aber im laufenden Level zuerst die Pause aus
// (Soll-Struktur im Review, B6): 'pausieren', wenn Lumo läuft und per jnr:aktiv aktiv meldet, sonst
// 'schliessen' (Pause, Menü, Dialoge, anderes Spiel, altes Lumo ohne jnr:aktiv).
function schliessKnopfAktion(currentGame, z) {
  return currentGame === 'jnr' && !!z && z.meldet && z.aktiv ? 'pausieren' : 'schliessen';
}

// Eine Sekunde geteilte Stern-Zeit verbrauchen. Pure — der setInterval-Loop
// und das Verzweigen bei Ablauf (Invader: Pause-Dialog/Toast, Lumo: jnr:timeup)
// bleiben in index.html. Tests: tests/unit/spiele-zugang.test.js
function tickStarTime(state) {
  if ((state.gameSecondsLeft || 0) <= 0) return { state, abgelaufen: false };
  const left = state.gameSecondsLeft - 1;
  return { state: Object.assign({}, state, { gameSecondsLeft: left }), abgelaufen: left === 0 };
}

// Stern-Zeit beim Spielstart: ohne laufenden Block wird ein Stern zu 10 Minuten.
// index.html ruft das erst auf, wenn das Spiel im iframe wirklich geladen ist
// (spielGeladen), damit ein offline kaputtes Spiel keinen Stern kostet.
// Tests: tests/unit/spiel-start.test.js
function sternZeitEinloesen(state, gameId) {
  const rule = GAME_RULES[gameId];
  if (!rule || !rule.kostetSternZeit) return { state, abgezogen: false };
  if ((state.gameSecondsLeft || 0) > 0 || (state.stars || 0) <= 0) return { state, abgezogen: false };
  return { state: Object.assign({}, state, { stars: state.stars - 1, gameSecondsLeft: 600 }), abgezogen: true };
}

// Hat das Spiel im (Same-Origin-)iframe seine Skripte geladen? win = frame.contentWindow
// nach dem load-Event. Eine Netz-Fehlerseite ist fremder Origin: der Zugriff wirft.
const SPIEL_MERKMAL = { jnr: (w) => !!(w.JNR && w.JNR.host), knobel: (w) => !!w.KnobelLogic };
function spielGeladen(gameId, win) {
  const merkmal = SPIEL_MERKMAL[gameId];
  if (!merkmal || !win) return false;
  try { return merkmal(win); } catch (e) { return false; }
}

// Lokales Kalenderdatum 'YYYY-MM-DD' (Knobel rechnet seinen Tages-XP-Deckel genauso,
// knobel/index.html heute()). toISOString wäre UTC und kippt in DE um 0-2 Uhr falsch.
function lokalesDatum(d) {
  const t = d || new Date();
  const p = (x) => (x < 10 ? '0' : '') + x;
  return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate());
}

// ── SPIEL-ERGEBNISSE (Knobelwerkstatt + Lumo) ───────────────────────────────
// Beide Funktionen bekommen die Rechenfunktion des jeweiligen Spiels
// injiziert (computeKnobelXP aus knobel/knobel-logic.js bzw. mergeResult
// aus jumpnrun/core/rewards.js), damit logic.js dependency-frei bleibt.
// index.html lädt die echten Module zusätzlich per <script>; Jest requirt sie
// direkt. Tests: tests/unit/spiele-ergebnisse.test.js

// msg: { type:'knobel:result', mode:'mauer'|'kaefige', stufe, tipps, xp, seed }
// heute: 'YYYY-MM-DD' (oder jedes andere Tagesformat, solange konsistent).
// computeKnobelXPFn: computeKnobelXP(opt, tagesXpBisher) -> { xp, gedeckelt, basis }
function applyKnobelResult(state, msg, heute, computeKnobelXPFn) {
  // Dieselbe Nachricht (z.B. durch doppeltes postMessage) nicht zweimal
  // gutschreiben — Signatur des zuletzt verarbeiteten Ergebnisses merken.
  const signatur = JSON.stringify([msg.mode, msg.stufe, msg.tipps, msg.xp, msg.seed]);
  const letzte = state.knobel.letzteNachricht;
  if (letzte && letzte.datum === heute && letzte.signatur === signatur) {
    return { state: Object.assign({}, state), creditedXp: 0 };
  }

  const bisher = state.knobel.tagesXp.datum === heute ? state.knobel.tagesXp.xp : 0;
  // tagesraetsel ist im Ergebnis nicht bekannt -> Obergrenze mit dem
  // großzügigsten Fall (Tagesrätsel-Bonus) berechnen und darauf kappen.
  const obergrenze = computeKnobelXPFn({ stufe: msg.stufe, tipps: msg.tipps, tagesraetsel: true }, bisher).xp;
  // Nicht-numerische/absurde xp (gefälschte Nachricht) darf den Zähler nicht
  // mit NaN zerstören — Math.min/-max geben bei nicht-numerischen Operanden NaN.
  const gemeldeteXp = typeof msg.xp === 'number' && isFinite(msg.xp) ? msg.xp : 0;
  const credit = Math.max(0, Math.min(gemeldeteXp, obergrenze));
  const stufe = Object.assign({}, state.knobel.stufe);
  if (msg.mode) stufe[msg.mode] = msg.stufe;
  return {
    state: Object.assign({}, state, {
      xp: (state.xp || 0) + credit,
      knobel: { tagesXp: { datum: heute, xp: bisher + credit }, stufe: stufe, letzteNachricht: { datum: heute, signatur: signatur } },
    }),
    creditedXp: credit,
  };
}

// msg: { type:'jnr:result', level, medaillen, funken, xp }
// mergeResultFn: rewards.mergeResult(jnr, msg) -> neues jnr (idempotent)
// Lumo gibt keine XP (Marco 30.10.2026): msg.xp wird ignoriert, auch wenn ein altes Lumo aus dem
// Cache noch XP meldet. Medaillen, Funken und Fortschritt übernimmt mergeResult.
function applyJnrResult(state, msg, mergeResultFn) {
  const jnr = mergeResultFn(state.jnr, msg);
  return {
    state: Object.assign({}, state, { jnr: jnr }),
    creditedXp: 0,
  };
}

// msg: { type:'jnr:tutorial', gesehen:true } (Vertrag jumpnrun/core/host.js): Lumos Mitmach-Tutorial
// ist durch oder uebersprungen. Setzt state.jnr.tutorialGesehen, keine XP. Gibt ohne gesehen:true
// denselben State zurueck, mutiert nichts.
function applyJnrTutorial(state, msg) {
  if (!msg || msg.gesehen !== true) return state;
  return Object.assign({}, state, { jnr: Object.assign({}, state.jnr, { tutorialGesehen: true }) });
}

// Lernstand je Reihe fuer Lumo (Feld `lernstand` in jnr:init, Vertrag jumpnrun/core/host.js).
// Wert je Reihe 2..10 = Mittel ueber die Faktoren 1..10 von min(consecutiveCorrect, 6) / 6,
// also derselbe Leitner-Massstab wie im Statistik-Screen (6 richtige in Folge = gemeistert).
// Ungesehene Faktoren zaehlen 0. Nur Reihen mit mindestens 3 verschiedenen beantworteten Aufgaben
// kommen ins Ergebnis. Gerundet auf 2 Stellen, mutiert nichts.
const LERNSTAND_MASTERY = 6;
const LERNSTAND_MIN_FAKTOREN = 3; // erst ab 3 verschiedenen beantworteten Aufgaben gilt eine Reihe als geuebt
function computeLernstand(questionStats) {
  const out = {};
  if (!questionStats || typeof questionStats !== 'object') return out;
  for (let r = 2; r <= 10; r++) {
    const row = questionStats[r];
    if (!row || typeof row !== 'object') continue;
    let sum = 0, seen = 0;
    for (let f = 1; f <= 10; f++) {
      const q = row[f];
      if (!q || typeof q !== 'object') continue;
      if ((q.correct || 0) > 0 || (q.wrong || 0) > 0) seen++;
      const cc = typeof q.consecutiveCorrect === 'number' && isFinite(q.consecutiveCorrect) ? q.consecutiveCorrect : 0;
      sum += Math.max(0, Math.min(cc, LERNSTAND_MASTERY)) / LERNSTAND_MASTERY;
    }
    if (seen >= LERNSTAND_MIN_FAKTOREN) out[r] = Math.round((sum / 10) * 100) / 100;
  }
  return out;
}

// Marathon-Modus Schwierigkeit pro Frage: sublineare sqrt-Kurve.
// qCount=0 → max=3, qCount=20 → max=13, qCount=50 → max=18, qCount=100 → max=25.
// Wird gecappt bei maxReihe (Großes 1×1 = 20).
function marathonDifficulty(qCount, maxReihe) {
  const raw = 3 + Math.floor(Math.sqrt(qCount * 5));
  return Math.min(raw, maxReihe);
}

// ── MULTIPLAYER PAYLOAD-LOGIK (testbar, kein DOM/fetch) ─────────────────────

// Baut das Score-Upload-Payload für POST /api/scores. offlinePlayed=true wenn
// kein gültiger Challenge-Bezug (kein lastChallengeId ODER seedDate ≠ heute).
function buildScorePayload(state, game, todayStr) {
  const isOffline = !state.mp.lastChallengeId || state.mp.lastSeedDate !== todayStr;
  return {
    challengeId: state.mp.lastChallengeId || '__offline__',
    score: game.score,
    correctCount: game.correct,
    offlinePlayed: isOffline,
    seedDate: state.mp.lastSeedDate,
  };
}

// Baut das Direct-Challenge-Payload für POST /api/challenges. Friert die
// aktuelle Blitz-Config (alleReihen, reihen, rechenart) ins Challenge-Record
// ein — damit der Challengee mit identischer Konfiguration spielt.
function buildChallengePayload(state, score, correctCount, targetNickname) {
  return {
    challengedNickname: targetNickname,
    seed: state.mp.lastSeed,
    seedDate: state.mp.lastSeedDate,
    score,
    correctCount,
    reihenConfig: {
      alleReihen: state.blitzConfig.alleReihen,
      reihen: state.blitzConfig.reihen,
      rechenart: state.blitzConfig.rechenart,
    },
  };
}

// Vergleicht zwei Versions-Strings ('2.9' vs '2.10') semver-stil.
// Liefert <0 wenn a < b, 0 bei Gleichheit, >0 wenn a > b.
// String-Compare reicht NICHT: '2.10' < '2.9' string-mäßig, aber 2.10 > 2.9 numerisch.
function compareVersion(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// Liefert die CHANGELOG-Einträge, die einem User mit seenVersion auf currentVersion
// angezeigt werden sollen — gefiltert auf seenVersion < e.version <= currentVersion.
// Sortiert absteigend (neueste oben). Wenn seenVersion null/undefined → [] (erste
// Installation, kein retroaktives Modal). Obergrenze currentVersion verhindert,
// dass CHANGELOG-Einträge für eine künftige Version angezeigt werden, deren
// Features im aktuellen Build noch nicht alle drin sind.
function changelogSince(changelog, seenVersion, currentVersion) {
  if (!Array.isArray(changelog)) return [];
  if (seenVersion == null) return [];
  const filtered = changelog.filter(e =>
    compareVersion(e.version, seenVersion) > 0 &&
    (currentVersion == null || compareVersion(e.version, currentVersion) <= 0)
  );
  return filtered.slice().sort((a, b) => compareVersion(b.version, a.version));
}

// Cleart aktive Challenge-Felder aus state.mp — pure, kein Side-Effect.
// Wird von quitGame gerufen, damit ein abgebrochener Challenge-Run keinen
// stale _activeChallengeId zurücklässt, der spätere endGames ungewollt
// als Challenge-Submit deuten würde.
function resetActiveChallengeState(state) {
  const mp = (state && state.mp) || {};
  return Object.assign({}, state, {
    mp: Object.assign({}, mp, {
      _activeChallengeId: null,
      _activeChallengeTheirScore: null,
    }),
  });
}

// Entscheidet, ob eine ausgehende Challenge wirklich gesendet werden soll.
// Verhindert den Tab-im-Hintergrund-Fall (Timer läuft auf 0 ohne Antworten),
// wo eine 0-Punkte-Challenge an den Gegner ginge.
function shouldSubmitOutgoingChallenge(game) {
  if (!game) return false;
  return (game.correct || 0) > 0;
}

// Bestimmt die Labels für die Challenge-Ergebnis-Tabelle (Bug 4).
// Echte Nicknames werden bevorzugt; "Du"/"Gegner" als Fallback wenn fehlend.
function formatChallengeResultLabels(myNickname, opponentNickname) {
  return {
    myLabel:    (myNickname    && String(myNickname).trim())    || 'Du',
    theirLabel: (opponentNickname && String(opponentNickname).trim()) || 'Gegner',
  };
}

// Formatiert ein "vor X Sekunden/Minuten/Stunden/Tagen"-Label für Challenge-Alter.
// Eingabe: secondsAgo (kann auch negativ sein bei Uhr-Drift). Pure.
// Tests: tests/unit/challenge-format.test.js
function formatChallengeAge(secondsAgo) {
  const s = Math.max(0, Math.floor(secondsAgo || 0));
  if (s < 60) return 'gerade eben';
  const min = Math.floor(s / 60);
  if (min < 60) return min === 1 ? 'vor 1 Minute' : `vor ${min} Minuten`;
  const hr = Math.floor(s / 3600);
  if (hr < 24) return hr === 1 ? 'vor 1 Stunde' : `vor ${hr} Stunden`;
  const days = Math.floor(s / 86400);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`;
}

// Formatiert eine ausgehende Challenge für die UI-Anzeige.
// Eingabe: challenge-Objekt vom Worker, nowSec = aktueller Unix-Timestamp in Sekunden.
// Output: { title, subtitle } — pure, kein DOM.
function formatOutgoingChallengeRow(challenge, nowSec) {
  const nick = challenge.challenged_nickname || 'Unbekannt';
  const age  = formatChallengeAge(nowSec - (challenge.created_at || nowSec));
  const score = challenge.challenger_score ?? 0;
  const correct = challenge.challenger_correct ?? 0;
  return {
    title:    `Du hast ${nick} herausgefordert`,
    subtitle: `${age} · ${score} Punkte, ${correct} richtig`,
  };
}

// Liefert neuen State mit zurückgesetztem mp-Feld — restlicher State (xp,
// streak, stars, name etc.) bleibt unangetastet. Pure: gibt neues Objekt
// zurück, mutiert nicht.
function mpStateAfterLogout(state) {
  return Object.assign({}, state, { mp: defaultState().mp });
}

if (typeof module !== 'undefined') {
  module.exports = { getMaxReihe, getMaxFactor, getQuestionWeight, pickWeightedFactor,
                     generateTrainingSequence,
                     pickBlitzReihe, addBlitzListeEntry,
                     resolveRechenart, shuffle, rnd,
                     compareVersion, changelogSince,
                     formatChallengeAge, formatOutgoingChallengeRow,
                     resetActiveChallengeState, shouldSubmitOutgoingChallenge,
                     formatChallengeResultLabels,
                     STATE_VERSION, STAR_COSTS, LEVELS,
                     defaultSettings, defaultReiheStats, defaultState, defaultQS,
                     STATE_MIGRATIONS, migrateState, getLevelInfo,
                     computeAnswerXP, nextStarCost, XP_MODE_MULTIPLIERS,
                     nextDiamondCost, canBuyDiamond, applyDiamondPurchase,
                     computeStreakProtection,
                     DIAMOND_PRICE, DIAMOND_CAP,
                     GAME_RULES, getGameAccess, tickStarTime, rundeSchaltetKnobelFrei,
                     ordneOhneDirekteWiederholung, zieheOhneWiederholung,
                     lumoAktivNeu, applyJnrAktiv, lumoTimerSollLaufen, invaderTimerSollLaufen, zeitAbgelaufenAktion, zeitAnzeige, sammleSpielzeit,
                     lumoBeendenGewuenscht, LUMO_BEENDEN_FALLBACK_MS, lumoZeitendeBestaetigt, schliessKnopfAktion,
                     sternZeitEinloesen, spielGeladen, lokalesDatum,
                     applyKnobelResult, applyJnrResult, applyJnrTutorial, computeLernstand,
                     marathonDifficulty,
                     mulberry32, initSeededRNG, resetRNG,
                     buildScorePayload, buildChallengePayload, mpStateAfterLogout };
}
