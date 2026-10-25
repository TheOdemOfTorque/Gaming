// Lumo - setzt ein Level aus der Abschnitts-Bibliothek (data/sections.js) zufaellig zusammen,
// damit sich die Reihenfolge nach ein paar Durchlaeufen nicht wiederholt (siehe ADR-0002 im Vault).
// Reine Funktion: gleicher seed -> exakt dieselbe Abfolge und Zeilen. Start- und Ziel-Abschnitt
// sind immer dieselben zwei Abschnitte aus dem Schwierigkeit-1-Pool (ruhiger Einstieg/Ausstieg,
// keine Ueberraschung direkt am Leuchtturm); der Rest wird gemischt.
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { sections: require('../data/sections.js'), mathgen: require('./mathgen.js') }
    : { sections: root.JNR.sections, mathgen: root.JNR.mathgen };
  var api = factory(deps.sections, deps.mathgen);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.levelgen = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (SEC, M) {
  var START_ID = 'd1-lauf-a';
  var GOAL_ID = 'd1-lauf-c';

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

    var offset = 0;
    chosen.forEach(function (sec, idx) {
      if (idx > 0) grid[6][offset] = 'C';
      offset += sec.rows[0].length;
    });

    return {
      seed: seed,
      sections: chosen.map(function (s) { return s.id; }),
      rows: grid.map(function (r) { return r.join(''); })
    };
  }

  return { generate: generate, START_ID: START_ID, GOAL_ID: GOAL_ID };
});
