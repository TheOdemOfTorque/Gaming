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

if (typeof module !== 'undefined') {
  module.exports = { pickBlitzReihe, addBlitzListeEntry, migrateBlitzState };
}
