// Pure functions — kein DOM, kein localStorage, keine Globals

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

function migrateBlitzState(s) {
  if (!s.blitzConfig) s.blitzConfig = { reihen: [], alleReihen: true };
  if (!s.highScores) s.highScores = {};
  if (!s.highScores.blitzListe) s.highScores.blitzListe = [];
  return s;
}

// Löst 'gemischt' zufällig auf; gibt immer 'mult' oder 'div' zurück.
function resolveRechenart(cfg) {
  const r = (cfg && cfg.rechenart) || 'mult';
  if (r === 'gemischt') return Math.random() < 0.5 ? 'mult' : 'div';
  return r;
}

// Migration v3→v4: Division-Felder zu einem State-Objekt hinzufügen.
// Voraussetzung: blitzConfig.reihen/alleReihen bereits vorhanden (migrateBlitzState zuerst ausführen).
function migrateDivState(s) {
  if (!s.trainingConfig) s.trainingConfig = { rechenart: 'mult' };
  if (!s.turnierConfig)  s.turnierConfig  = { rechenart: 'mult' };
  if (!s.blitzConfig) s.blitzConfig = { reihen: [], alleReihen: true, rechenart: 'mult' };
  if (!s.blitzConfig.rechenart) s.blitzConfig.rechenart = 'mult';
  if (!s.highScores) s.highScores = {};
  ['blitzDiv','blitzGemischt','turnierDiv','turnierGemischt'].forEach(k => {
    if (s.highScores[k] === undefined) s.highScores[k] = 0;
  });
  if (!s.reiheStats) s.reiheStats = {};
  for (let i = 1; i <= 20; i++) { // 20 = MAX_REIHE (sync mit index.html)
    if (!s.reiheStats[i]) s.reiheStats[i] = {};
    const r = s.reiheStats[i];
    if (r.divConsecutivePerfect === undefined) r.divConsecutivePerfect = 0;
    if (r.divCorrect            === undefined) r.divCorrect            = 0;
    if (r.divWrong              === undefined) r.divWrong              = 0;
  }
  return s;
}

if (typeof module !== 'undefined') {
  module.exports = { pickBlitzReihe, addBlitzListeEntry, migrateBlitzState,
                     resolveRechenart, migrateDivState };
}
