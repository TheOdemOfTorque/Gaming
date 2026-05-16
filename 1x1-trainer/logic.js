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

if (typeof module !== 'undefined') {
  module.exports = { pickBlitzReihe, addBlitzListeEntry,
                     resolveRechenart, shuffle, rnd,
                     STATE_VERSION, STAR_COSTS, LEVELS,
                     defaultSettings, defaultReiheStats, defaultState, defaultQS };
}
