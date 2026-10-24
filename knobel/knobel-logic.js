/*
 * Knobelwerkstatt - reine Logik (Phase 1: Zahlenmauer, Rechenkaefige)
 *
 * Kein DOM, kein localStorage, keine Globals. Im Browser per <script> als
 * window.KnobelLogic, in Jest per require().
 *
 * ---------------------------------------------------------------------------
 * INTEGRATIONS-VERTRAG (Trainer <-> Knobelwerkstatt)
 * ---------------------------------------------------------------------------
 * Der Trainer (1x1-trainer/) bettet die Knobelwerkstatt spaeter als
 * Same-Origin-iframe ein und bleibt der EINZIGE Schreiber von
 * localStorage['henry_einmaleins']. Die Knobelwerkstatt schreibt ausschliesslich
 * in localStorage['henry_knobel'].
 *
 * Eingebettet = (window.parent !== window). Dann gilt:
 *
 * 1. Knobelwerkstatt -> Trainer, nach JEDEM geloesten Raetsel:
 *      parent.postMessage({
 *        type:  'knobel:result',
 *        mode:  'mauer' | 'kaefige',
 *        stufe: 1..5,
 *        tipps: <Anzahl benutzter Tipps>,
 *        xp:    <vom Spiel berechnete XP, nach Tagescap>,
 *        seed:  <Seed des Raetsels>
 *      }, location.origin)
 *    Der Trainer darf die XP mit computeKnobelXP() nachrechnen und selbst
 *    verbuchen; die Knobelwerkstatt schreibt nie nach henry_einmaleins.
 *
 * 2. Trainer -> Knobelwerkstatt (optional, beliebig oft):
 *      iframe.contentWindow.postMessage({
 *        type: 'knobel:init',
 *        tagesXp: { datum: 'YYYY-MM-DD', xp: <heute bereits geholte Knobel-XP> },
 *        stufe:   { mauer: 1..5, kaefige: 1..5 },   // empfohlene Stufen
 *        stumm:   true | false                      // Ton aus
 *      }, location.origin)
 *    Alle Felder sind optional. Die Knobelwerkstatt uebernimmt sie fuer den
 *    Tagescap, die Stufen-Empfehlung und den Stummschalter.
 *
 * 3. Beide Seiten pruefen event.origin === location.origin und akzeptieren
 *    nur die Typen 'knobel:init' bzw. 'knobel:result'. Alles andere wird
 *    ignoriert.
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KnobelLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GEN_VERSION = 1;

  // ===== RNG =====
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  // ===== Stufen =====
  // Mauer: regeln[r] = Rechenart der Reihe r (Reihe 0 = unterste Reihe).
  // Abweichung von der Spec: reine Produktpyramiden sprengen ab 4 Steinen jede
  // sinnvolle Obergrenze (5 Steine, alles 2 ergibt 2^16). Hoehere Reihen
  // addieren deshalb teilweise.
  var STUFEN = {
    mauer: {
      1: { n: 3, fmin: 1, fmax: 5,  regeln: ['', 'mul', 'add'],                hinweise: 4 },
      2: { n: 4, fmin: 2, fmax: 6,  regeln: ['', 'mul', 'mul', 'add'],         hinweise: 6 },
      3: { n: 4, fmin: 2, fmax: 9,  regeln: ['', 'mul', 'mul', 'add'],         hinweise: 5 },
      4: { n: 5, fmin: 2, fmax: 9,  regeln: ['', 'mul', 'mul', 'add', 'add'],  hinweise: 7 },
      5: { n: 5, fmin: 2, fmax: 12, regeln: ['', 'mul', 'mul', 'add', 'add'],  hinweise: 5, nurMitte: true }
    },
    kaefige: {
      1: { n: 3, groessen: [1, 2, 2, 2],       ops: ['+', '×', '×'] },
      2: { n: 4, groessen: [1, 2, 2, 3, 3],    ops: ['×', '×', '×', '+'] },
      3: { n: 4, groessen: [1, 2, 2, 3, 3],    ops: ['×', '×', '÷', '−', '+'] },
      4: { n: 5, groessen: [1, 2, 2, 3, 3],    ops: ['×', '×', '÷', '−', '+'] },
      5: { n: 6, groessen: [1, 2, 2, 3, 3, 4], ops: ['×', '×', '÷', '−', '+'], verzweigung: true }
    }
  };
  var MAX_STEIN = 9999;

  // ===== Zahlenmauer =====
  function stein(op, a, b) { return op === 'add' ? a + b : a * b; }

  function buildPyramid(basis, regeln) {
    var rows = [basis.slice()];
    for (var r = 1; r < basis.length; r++) {
      var prev = rows[r - 1], row = [];
      for (var c = 0; c < prev.length - 1; c++) row.push(stein(regeln[r], prev[c], prev[c + 1]));
      rows.push(row);
    }
    return rows;
  }

  // Zaehlt Basisbelegungen (Domaene fmin..fmax), die alle gegebenen Steine
  // erfuellen; bricht bei max ab. Stein (r,c) haengt von den Basen c..c+r ab
  // und wird geprueft, sobald Basis c+r gesetzt ist.
  function solvePyramid(p, max) {
    var n = p.n, count = 0;
    var rows = [];
    for (var r = 0; r < n; r++) rows.push(new Array(n - r).fill(0));
    function dfs(k) {
      if (count >= max) return;
      if (k === n) { count++; return; }
      for (var v = p.fmin; v <= p.fmax; v++) {
        rows[0][k] = v;
        var ok = true;
        if (p.gegeben[0][k] !== null && p.gegeben[0][k] !== v) ok = false;
        for (var r = 1; ok && r <= k; r++) {
          var c = k - r;
          var val = stein(p.regeln[r], rows[r - 1][c], rows[r - 1][c + 1]);
          rows[r][c] = val;
          if (p.gegeben[r][c] !== null && p.gegeben[r][c] !== val) ok = false;
        }
        if (ok) dfs(k + 1);
        if (count >= max) return;
      }
    }
    dfs(0);
    return count;
  }

  // Schlussregeln ohne Raten: aus zwei Steinen eines Dreiecks folgt der dritte.
  function logicSolvePyramid(p) {
    var n = p.n;
    var z = p.gegeben.map(function (row) { return row.slice(); });
    var schritte = 0, changed = true;
    while (changed) {
      changed = false;
      for (var r = 1; r < n; r++) {
        for (var c = 0; c < n - r; c++) {
          var a = z[r - 1][c], b = z[r - 1][c + 1], s = z[r][c], add = p.regeln[r] === 'add';
          var v;
          if (a !== null && b !== null && s === null) {
            z[r][c] = stein(p.regeln[r], a, b); changed = true; schritte++;
          } else if (s !== null && a !== null && b === null) {
            v = add ? s - a : (s % a === 0 ? s / a : 0);
            if (v >= 1) { z[r - 1][c + 1] = v; changed = true; schritte++; }
          } else if (s !== null && b !== null && a === null) {
            v = add ? s - b : (s % b === 0 ? s / b : 0);
            if (v >= 1) { z[r - 1][c] = v; changed = true; schritte++; }
          }
        }
      }
    }
    var geloest = z.every(function (row) { return row.every(function (v) { return v !== null; }); });
    return { geloest: geloest, schritte: schritte, zeilen: z };
  }

  function generatePyramid(stufe, rng) {
    var P = STUFEN.mauer[stufe], n = P.n, loesung, tries = 0;
    for (;;) {
      var basis = [], ones = 0;
      for (var i = 0; i < n; i++) {
        var v = randInt(rng, P.fmin, P.fmax);
        if (v === 1) { if (ones >= 1) { v = randInt(rng, 2, P.fmax); } else ones++; }
        basis.push(v);
      }
      loesung = buildPyramid(basis, P.regeln);
      var maxV = Math.max.apply(null, loesung.map(function (row) { return Math.max.apply(null, row); }));
      if (maxV <= MAX_STEIN || ++tries > 500) break;
    }
    var gegeben = loesung.map(function (row) { return row.slice(); });
    var zellen = [];
    loesung.forEach(function (row, r) { row.forEach(function (_, c) { zellen.push([r, c]); }); });
    var reihenfolge;
    if (P.nurMitte) {
      var rand = zellen.filter(function (z) { return z[0] === 0 || z[0] === n - 1; });
      var mitte = zellen.filter(function (z) { return z[0] !== 0 && z[0] !== n - 1; });
      reihenfolge = shuffle(rng, rand).concat(shuffle(rng, mitte));
    } else {
      reihenfolge = shuffle(rng, zellen);
    }
    var sichtbar = zellen.length;
    var puzzle = {
      modus: 'mauer', stufe: stufe, n: n, regeln: P.regeln, fmin: P.fmin, fmax: P.fmax,
      gegeben: gegeben, loesung: loesung
    };
    for (var k = 0; k < reihenfolge.length && sichtbar > P.hinweise; k++) {
      var r0 = reihenfolge[k][0], c0 = reihenfolge[k][1];
      if (!P.nurMitte) {
        var randSichtbar = 0;
        gegeben[0].forEach(function (x) { if (x !== null) randSichtbar++; });
        if (gegeben[n - 1][0] !== null) randSichtbar++;
        var istRand = r0 === 0 || (r0 === n - 1 && c0 === 0);
        if (istRand && randSichtbar <= 1) continue;
      }
      gegeben[r0][c0] = null;
      var ok = logicSolvePyramid(puzzle).geloest ||
               (!!P.nurMitte && solvePyramid(puzzle, 2) === 1);
      if (ok) sichtbar--; else gegeben[r0][c0] = loesung[r0][c0];
    }
    return puzzle;
  }

  return {
    GEN_VERSION: GEN_VERSION, STUFEN: STUFEN, MAX_STEIN: MAX_STEIN,
    mulberry32: mulberry32, randInt: randInt, shuffle: shuffle, pick: pick,
    buildPyramid: buildPyramid, solvePyramid: solvePyramid,
    logicSolvePyramid: logicSolvePyramid, generatePyramid: generatePyramid
  };
});
