// Lumo - setzt ein Level aus der Abschnitts-Bibliothek (data/sections.js) zufaellig zusammen,
// damit sich die Reihenfolge nach ein paar Durchlaeufen nicht wiederholt (siehe ADR-0002 im Vault).
// Reine Funktion: gleicher seed -> exakt dieselbe Abfolge und Zeilen. Start- und Ziel-Abschnitt
// sind immer dieselben zwei Abschnitte aus dem Schwierigkeit-1-Pool (ruhiger Einstieg/Ausstieg,
// keine Ueberraschung direkt am Leuchtturm); der Rest wird gemischt.
//
// Rechenwichte (opts.gegner, siehe core/gegner.js): hoechstens einer je 2 bis 3 Abschnitte, nie im
// Start-, ersten Mittel- oder Ziel-Abschnitt, nur wo core/level.js strecke() eine Laufstrecke von
// mindestens MIN_STRECKE Kacheln findet (flach, Abstand zu Gefahren, Landestellen und Laternen).
// Die Platzierung zieht aus einem eigenen Zufallsstrom: Abschnittsfolge und Kristalle bleiben je
// Seed genau wie ohne Wichte.
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { sections: require('../data/sections.js'), mathgen: require('./mathgen.js'), level: require('./level.js') }
    : { sections: root.JNR.sections, mathgen: root.JNR.mathgen, level: root.JNR.level };
  var api = factory(deps.sections, deps.mathgen, deps.level);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.levelgen = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (SEC, M, LV) {
  var START_ID = 'd1-lauf-a';
  var GOAL_ID = 'd1-lauf-c';
  var GEGNER_AB = 2;        // erster Abschnitt (Index), der einen Wicht haben darf
  var GEGNER_SALZ = 0x2F6B1D3A;

  function byId(id) {
    for (var i = 0; i < SEC.SECTIONS.length; i++) if (SEC.SECTIONS[i].id === id) return SEC.SECTIONS[i];
    throw new Error('Unbekannter Abschnitt: ' + id);
  }

  function pickDifferent(pool, excludeId, rnd) {
    var cands = pool.filter(function (s) { return s.id !== excludeId; });
    if (!cands.length) cands = pool; // Pool zu klein (sollte bei >=2 Abschnitten nie passieren)
    return cands[Math.floor(rnd() * cands.length)];
  }

  // opts: { minDifficulty, maxDifficulty, minSections, maxSections, pool? }
  function generate(opts, seed) {
    var pool = (opts.pool || SEC.SECTIONS).filter(function (s) {
      return s.schwierigkeit >= opts.minDifficulty && s.schwierigkeit <= opts.maxDifficulty;
    });
    if (pool.length < 2) throw new Error('Abschnitts-Pool zu klein fuer Schwierigkeit ' + opts.minDifficulty + '-' + opts.maxDifficulty);

    var rnd = M.mulberry32(seed == null ? 1 : seed);
    var span = opts.maxSections - opts.minSections;
    var n = opts.minSections + (span > 0 ? Math.floor(rnd() * (span + 1)) : 0);

    var start = byId(START_ID), goal = byId(GOAL_ID);
    var chosen = [start];
    var prevId = start.id;
    for (var i = 0; i < n; i++) {
      var candidatesPool = pool;
      if (i === n - 1) candidatesPool = pool.filter(function (s) { return s.id !== goal.id; });
      var pick = pickDifferent(candidatesPool, prevId, rnd);
      chosen.push(pick);
      prevId = pick.id;
    }
    chosen.push(goal);

    var rows = new Array(9).fill('');
    chosen.forEach(function (sec) {
      for (var y = 0; y < 9; y++) rows[y] += sec.rows[y];
    });
    var grid = rows.map(function (r) { return r.split(''); });
    var w = grid[0].length;
    grid[6][0] = 'S';
    grid[6][w - 1] = 'G';

    var offset = 0, offsets = [];
    chosen.forEach(function (sec, idx) {
      offsets.push(offset);
      if (idx > 0) grid[6][offset] = 'C';
      offset += sec.rows[0].length;
    });

    var gegner = opts.gegner ? placeEnemies(grid, chosen, offsets, seed) : [];

    return {
      seed: seed,
      sections: chosen.map(function (s) { return s.id; }),
      rows: grid.map(function (r) { return r.join(''); }),
      gegner: gegner
    };
  }

  // Setzt 'w' auf freie Bodenkacheln (Zeile 6, kein Kristall). Gibt [{ tx, ty, abschnitt }] zurueck.
  function placeEnemies(grid, chosen, offsets, seed) {
    var level = LV.parseLevel(grid.map(function (r) { return r.join(''); }));
    var rnd = M.mulberry32(((seed == null ? 1 : seed) ^ GEGNER_SALZ) >>> 0);
    var ty = 6, out = [], next = GEGNER_AB;
    for (var idx = GEGNER_AB; idx < chosen.length - 1; idx++) {
      if (idx < next) continue;
      var x0 = offsets[idx], x1 = x0 + chosen[idx].rows[0].length - 1, cands = [];
      for (var x = x0; x <= x1; x++) {
        if (grid[ty][x] !== '.') continue;
        var st = LV.strecke(level, x, ty);
        if (st && st.bis - st.von + 1 >= LV.MIN_STRECKE) cands.push(x);
      }
      if (!cands.length) continue;
      var tx = cands[Math.floor(rnd() * cands.length)];
      grid[ty][tx] = 'w';
      out.push({ tx: tx, ty: ty, abschnitt: idx });
      next = idx + 2 + Math.floor(rnd() * 2);
    }
    return out;
  }

  return { generate: generate, START_ID: START_ID, GOAL_ID: GOAL_ID };
});
