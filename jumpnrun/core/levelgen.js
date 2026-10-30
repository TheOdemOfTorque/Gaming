// Lumo - setzt ein Level aus der Abschnitts-Bibliothek (data/sections.js) zufaellig zusammen,
// damit sich die Reihenfolge nach ein paar Durchlaeufen nicht wiederholt (siehe ADR-0002 im Vault).
// Reine Funktion: gleicher seed -> exakt dieselbe Abfolge und Zeilen. Start- und Ziel-Abschnitt
// sind immer dieselben zwei Abschnitte aus dem Schwierigkeit-1-Pool (ruhiger Einstieg/Ausstieg,
// keine Ueberraschung direkt am Leuchtturm); der Rest wird gemischt.
//
// Rechenwichte (opts.gegner, siehe core/gegner.js): hoechstens einer je Abschnitt, Abstand nach
// opts.gegnerAbstand (Standard 2 bis 3 Abschnitte), nie im Start-, ersten Mittel- oder Ziel-Abschnitt,
// nur wo core/level.js strecke() eine Laufstrecke von mindestens MIN_STRECKE Kacheln findet (flach,
// Abstand zu Gefahren, Landestellen und Laternen). Die Platzierung zieht aus einem eigenen
// Zufallsstrom: Abschnittsfolge und Kristalle bleiben je Seed genau wie ohne Wichte.
// opts.minGegner (Level 2-1 Wichtelhuegel): reicht der erste Durchgang nicht, werden weitere Abschnitte
// mit Strecke nachverdichtet; reicht auch das nicht, wird mit abgeleitetem Seed neu gewuerfelt.
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
  var GEGNER_ABSTAND = [2, 1];    // Standard: naechster Wicht fruehestens 2, spaetestens 2 + 1 Abschnitte weiter
  var VERSUCH_PRIME = 0x9E3779B1; // abgeleiteter Seed je Wiederholung (opts.minGegner): seed + k * PRIME
  var MAX_VERSUCHE = 24;          // hoechstens so viele Wiederholungen, danach gilt der beste Versuch (wichtMangel).
                                  // 8 reichten nicht: Seed 2058 der Stufe 2-1 blieb bei 3 Wichten; mit 24 kein Mangel in 20 000 Seeds (max. Versuch 9)

  function byId(id) {
    for (var i = 0; i < SEC.SECTIONS.length; i++) if (SEC.SECTIONS[i].id === id) return SEC.SECTIONS[i];
    throw new Error('Unbekannter Abschnitt: ' + id);
  }

  function pickDifferent(pool, excludeId, rnd) {
    var cands = pool.filter(function (s) { return s.id !== excludeId; });
    if (!cands.length) cands = pool; // Pool zu klein (sollte bei >=2 Abschnitten nie passieren)
    return cands[Math.floor(rnd() * cands.length)];
  }

  // opts: { minDifficulty, maxDifficulty, minSections, maxSections, pool?, gegner?,
  //         gegnerAbstand?: [min, extra]  (Standard [2, 1]: naechster Wicht idx + min + 0..extra),
  //         minGegner?: n                 (Standard 0: mindestens so viele Wichte je Lauf) }
  // Ergebnis: { seed, sections, rows, gegner, versuch }. versuch = 0: erster Wurf (ohne minGegner immer);
  // k > 0: der k-te Wiederholungswurf mit Seed seed + k * VERSUCH_PRIME hat die Mindestzahl erreicht,
  // das Ergebnis traegt trotzdem den urspruenglichen Seed. Ohne minGegner und mit Standard-Abstand ist
  // die Ausgabe je Seed bitgleich zum Stand vor diesen Parametern (Test gegen fixtures/jnr-1-2-baseline.json).
  function generate(opts, seed) {
    var minGegner = opts.gegner ? (opts.minGegner || 0) : 0;
    var g0 = generateOnce(opts, seed, minGegner);
    g0.versuch = 0;
    if (!minGegner || g0.gegner.length >= minGegner) return g0;
    var best = g0, basis = seed == null ? 1 : seed;
    for (var k = 1; k <= MAX_VERSUCHE; k++) {
      var g = generateOnce(opts, (basis + k * VERSUCH_PRIME) >>> 0, minGegner);
      g.seed = seed; g.versuch = k;
      if (g.gegner.length >= minGegner) return g;
      if (g.gegner.length > best.gegner.length) best = g;
    }
    best.wichtMangel = true; // Mindestzahl auch nach MAX_VERSUCHE nicht erreicht: bester Versuch
    return best;
  }

  function generateOnce(opts, seed, minGegner) {
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

    var gegner = opts.gegner ? placeEnemies(grid, chosen, offsets, seed, opts.gegnerAbstand || GEGNER_ABSTAND, minGegner) : [];

    return {
      seed: seed,
      sections: chosen.map(function (s) { return s.id; }),
      rows: grid.map(function (r) { return r.join(''); }),
      gegner: gegner
    };
  }

  // Kandidaten-Spalten fuer einen Wicht im Abschnitt idx (freie Bodenkachel mit Strecke >= MIN_STRECKE)
  function wichtKandidaten(grid, level, chosen, offsets, idx) {
    var ty = 6, x0 = offsets[idx], x1 = x0 + chosen[idx].rows[0].length - 1, cands = [];
    for (var x = x0; x <= x1; x++) {
      if (grid[ty][x] !== '.') continue;
      var st = LV.strecke(level, x, ty);
      if (st && st.bis - st.von + 1 >= LV.MIN_STRECKE) cands.push(x);
    }
    return cands;
  }

  // Setzt 'w' auf freie Bodenkacheln (Zeile 6, kein Kristall). Gibt [{ tx, ty, abschnitt }] zurueck.
  // abstand: [min, extra], naechster Wicht fruehestens min, spaetestens min + extra Abschnitte weiter.
  // minGegner > 0: Nachverdichten. Reicht der erste Durchgang nicht, bekommen weitere Abschnitte mit
  // Strecke (von links nach rechts, Mindestabstand abstand[0] zu schon gesetzten Wichten) einen Wicht,
  // bis die Mindestzahl erreicht ist. Das zieht erst nach dem ersten Durchgang aus demselben
  // Zufallsstrom, der erste Durchgang bleibt also bitgleich.
  function placeEnemies(grid, chosen, offsets, seed, abstand, minGegner) {
    var level = LV.parseLevel(grid.map(function (r) { return r.join(''); }));
    var rnd = M.mulberry32(((seed == null ? 1 : seed) ^ GEGNER_SALZ) >>> 0);
    var ty = 6, out = [], next = GEGNER_AB, belegt = {};
    for (var idx = GEGNER_AB; idx < chosen.length - 1; idx++) {
      if (idx < next) continue;
      var cands = wichtKandidaten(grid, level, chosen, offsets, idx);
      if (!cands.length) continue;
      var tx = cands[Math.floor(rnd() * cands.length)];
      grid[ty][tx] = 'w';
      out.push({ tx: tx, ty: ty, abschnitt: idx });
      belegt[idx] = true;
      next = idx + abstand[0] + Math.floor(rnd() * (abstand[1] + 1));
    }
    if (minGegner > 0 && out.length < minGegner) {
      for (var j = GEGNER_AB; j < chosen.length - 1 && out.length < minGegner; j++) {
        if (belegt[j]) continue;
        var zuNah = false;
        for (var k = 0; k < out.length; k++) if (Math.abs(out[k].abschnitt - j) < abstand[0]) { zuNah = true; break; }
        if (zuNah) continue;
        var c2 = wichtKandidaten(grid, level, chosen, offsets, j);
        if (!c2.length) continue;
        var tx2 = c2[Math.floor(rnd() * c2.length)];
        grid[ty][tx2] = 'w';
        out.push({ tx: tx2, ty: ty, abschnitt: j });
        belegt[j] = true;
      }
      out.sort(function (a, b) { return a.abschnitt - b.abschnitt; });
    }
    return out;
  }

  return { generate: generate, START_ID: START_ID, GOAL_ID: GOAL_ID,
    GEGNER_ABSTAND: GEGNER_ABSTAND, MAX_VERSUCHE: MAX_VERSUCHE, VERSUCH_PRIME: VERSUCH_PRIME };
});
