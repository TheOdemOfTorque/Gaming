// Pure functions — kein DOM, kein localStorage, keine Globals

var STATE_VERSION = 4;
var STAR_COSTS = [800, 1400, 2000, 2800];
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
  return { grosses1x1: false, reiheMax, inputMode: 'both' };
}

function defaultReiheStats() {
  const s = {};
  for (let i = 1; i <= 20; i++) s[i] = {
    sessions: 0, totalCorrect: 0, totalQuestions: 0, consecutivePerfect: 0,
    divConsecutivePerfect: 0, divCorrect: 0, divWrong: 0
  };
  return s;
}

function defaultQS() { return { correct: 0, wrong: 0, consecutiveCorrect: 0 }; }

function defaultState() {
  return { _version: STATE_VERSION, name: '', xp: 0, achievements: [], totalCorrect: 0, totalGames: 0,
           streak: 0, lastPlayDate: null,
           highScores: { blitz: 0, turnier: 0, blitzListe: [],
                         blitzDiv: 0, blitzGemischt: 0,
                         turnierDiv: 0, turnierGemischt: 0 },
           blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' },
           trainingConfig: { rechenart: 'mult' },
           turnierConfig: { rechenart: 'mult' },
           trainedReihen: [], settings: defaultSettings(), reiheStats: defaultReiheStats(),
           streakFreezeUsedDate: null, streakFreezeTotal: 0,
           questionStats: {},
           stars: 0, gameSecondsLeft: 0 };
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
];

function migrateState(s) {
  const fromVersion = s._version || 0;
  for (let v = fromVersion; v < STATE_VERSION; v++) {
    s = STATE_MIGRATIONS[v](s) || s;
  }
  s._version = STATE_VERSION;
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
  let r = Math.random() * total;
  for (let i = 0; i < maxF; i++) { r -= weights[i]; if (r <= 0) return i + 1; }
  return maxF;
}

function pickBlitzReihe(blitzConfig, maxReihe) {
  if (blitzConfig.alleReihen || !blitzConfig.reihen.length)
    return null; // caller uses rnd(1, maxReihe)
  const reihen = blitzConfig.reihen;
  return reihen[Math.floor(Math.random() * reihen.length)];
}

function addBlitzListeEntry(liste, entry) {
  const neu = [...liste, entry];
  neu.sort((a, b) => b.score - a.score);
  return neu.slice(0, 5);
}

// Löst 'gemischt' zufällig auf; gibt immer 'mult' oder 'div' zurück.
function resolveRechenart(cfg) {
  const r = (cfg && cfg.rechenart) || 'mult';
  if (r === 'gemischt') return Math.random() < 0.5 ? 'mult' : 'div';
  return r;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// XP pro richtige Antwort: combo-basierte Tiers + modus-Multiplikator.
function computeAnswerXP(combo, mode) {
  let xp = combo >= 10 ? 13 : combo >= 5 ? 9 : combo >= 3 ? 7 : 5;
  if (mode === 'turnier') xp = Math.round(xp * 1.3);
  return xp;
}

// XP-Kosten für nächsten Stern; STAR_COSTS-Array wird am letzten Eintrag gecappt.
function nextStarCost(stars) {
  return STAR_COSTS[Math.min(stars, STAR_COSTS.length - 1)];
}

if (typeof module !== 'undefined') {
  module.exports = { getMaxReihe, getMaxFactor, getQuestionWeight, pickWeightedFactor,
                     pickBlitzReihe, addBlitzListeEntry,
                     resolveRechenart, shuffle, rnd,
                     STATE_VERSION, STAR_COSTS, LEVELS,
                     defaultSettings, defaultReiheStats, defaultState, defaultQS,
                     STATE_MIGRATIONS, migrateState, getLevelInfo,
                     computeAnswerXP, nextStarCost };
}
