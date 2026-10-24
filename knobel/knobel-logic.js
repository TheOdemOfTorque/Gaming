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
      1: { n: 3, groessen: [2, 2, 2, 3],       ops: ['+', '×', '×'] },
      2: { n: 4, groessen: [2, 2, 3, 3],    ops: ['×', '×', '×', '+'] },
      3: { n: 4, groessen: [2, 2, 3, 3],    ops: ['×', '×', '÷', '−', '+'] },
      4: { n: 5, groessen: [2, 2, 3, 3],    ops: ['×', '×', '÷', '−', '+'] },
      5: { n: 6, groessen: [2, 3, 3, 4], ops: ['×', '×', '÷', '−', '+'], verzweigung: true }
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

  // ===== Rechenkaefige =====
  function cageZiel(op, vals) {
    if (op === '=') return vals[0];
    if (op === '+') return vals.reduce(function (a, b) { return a + b; }, 0);
    if (op === '×') return vals.reduce(function (a, b) { return a * b; }, 1);
    var hi = Math.max(vals[0], vals[1]), lo = Math.min(vals[0], vals[1]);
    return op === '−' ? hi - lo : hi / lo;
  }
  function cageOk(k, vals) {
    if (k.op === '÷') {
      var hi = Math.max(vals[0], vals[1]), lo = Math.min(vals[0], vals[1]);
      return hi % lo === 0 && hi / lo === k.ziel;
    }
    return cageZiel(k.op, vals) === k.ziel;
  }

  function zellenZusammenhaengend(zellen) {
    if (!zellen.length) return false;
    var key = function (z) { return z[0] + ',' + z[1]; };
    var inSet = {}; zellen.forEach(function (z) { inSet[key(z)] = true; });
    var seen = {}, stack = [zellen[0]]; seen[key(zellen[0])] = true;
    var count = 0;
    while (stack.length) {
      var z = stack.pop(); count++;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nb = [z[0] + d[0], z[1] + d[1]], k = key(nb);
        if (inSet[k] && !seen[k]) { seen[k] = true; stack.push(nb); }
      });
    }
    return count === zellen.length;
  }

  function cageIndex(p) {
    var idx = [];
    for (var r = 0; r < p.n; r++) idx.push(new Array(p.n).fill(-1));
    p.kaefige.forEach(function (k, i) { k.zellen.forEach(function (z) { idx[z[0]][z[1]] = i; }); });
    return idx;
  }

  // Zaehlender Backtracking-Loeser (Zeile fuer Zeile), bricht bei max ab.
  function solveCages(p, max) {
    var n = p.n, idx = cageIndex(p), count = 0;
    var vals = [];
    for (var r = 0; r < n; r++) vals.push(new Array(n).fill(0));
    var rowMask = new Array(n).fill(0), colMask = new Array(n).fill(0);
    function cageState(i) {
      var k = p.kaefige[i], werte = [], fehlend = 0;
      k.zellen.forEach(function (z) { var v = vals[z[0]][z[1]]; if (v) werte.push(v); else fehlend++; });
      if (fehlend === 0) return cageOk(k, werte);
      if (k.op === '+') {
        var s = werte.reduce(function (a, b) { return a + b; }, 0);
        return s + fehlend <= k.ziel;
      }
      if (k.op === '×') {
        var pr = werte.reduce(function (a, b) { return a * b; }, 1);
        return k.ziel % pr === 0;
      }
      return true;
    }
    function dfs(pos) {
      if (count >= max) return;
      if (pos === n * n) { count++; return; }
      var r = Math.floor(pos / n), c = pos % n, ci = idx[r][c];
      for (var v = 1; v <= n; v++) {
        var bit = 1 << v;
        if ((rowMask[r] & bit) || (colMask[c] & bit)) continue;
        vals[r][c] = v; rowMask[r] |= bit; colMask[c] |= bit;
        var ok = true;
        if (ci >= 0) ok = cageState(ci);
        if (ok) dfs(pos + 1);
        vals[r][c] = 0; rowMask[r] &= ~bit; colMask[c] &= ~bit;
        if (count >= max) return;
      }
    }
    dfs(0);
    return count;
  }

  // Logik-Loeser ohne Raten: Kaefig-Tupel, Zeilen-/Spaltenausschluss,
  // naked und hidden singles.
  function logicSolveCages(p) {
    var n = p.n, ALL = 0;
    for (var v0 = 1; v0 <= n; v0++) ALL |= 1 << v0;
    var cand = [];
    for (var r = 0; r < n; r++) cand.push(new Array(n).fill(ALL));
    function bits(m) { var o = []; for (var v = 1; v <= n; v++) if (m & (1 << v)) o.push(v); return o; }
    function popcount(m) { return bits(m).length; }
    var tupel = p.kaefige.map(function (k) {
      var res = [], cur = [];
      (function rec(i) {
        if (i === k.zellen.length) { if (cageOk(k, cur)) res.push(cur.slice()); return; }
        for (var v = 1; v <= n; v++) {
          var bad = false;
          for (var j = 0; j < i; j++) {
            var a = k.zellen[j], b = k.zellen[i];
            if (cur[j] === v && (a[0] === b[0] || a[1] === b[1])) bad = true;
          }
          if (bad) continue;
          cur.push(v); rec(i + 1); cur.pop();
        }
      })(0);
      return res;
    });
    var changed = true, bad = false;
    function setCand(r, c, m) {
      if (cand[r][c] !== m) { cand[r][c] = m; changed = true; }
      if (m === 0) bad = true;
    }
    while (changed && !bad) {
      changed = false;
      p.kaefige.forEach(function (k, i) {
        tupel[i] = tupel[i].filter(function (t) {
          return k.zellen.every(function (z, j) { return cand[z[0]][z[1]] & (1 << t[j]); });
        });
        k.zellen.forEach(function (z, j) {
          var m = 0; tupel[i].forEach(function (t) { m |= 1 << t[j]; });
          setCand(z[0], z[1], cand[z[0]][z[1]] & m);
        });
      });
      for (var r = 0; r < n && !bad; r++) for (var c = 0; c < n; c++) {
        if (popcount(cand[r][c]) === 1) {
          var m = cand[r][c];
          for (var x = 0; x < n; x++) {
            if (x !== c && (cand[r][x] & m)) setCand(r, x, cand[r][x] & ~m);
            if (x !== r && (cand[x][c] & m)) setCand(x, c, cand[x][c] & ~m);
          }
        }
      }
      for (var v = 1; v <= n && !bad; v++) {
        var bit = 1 << v;
        for (var a = 0; a < n; a++) {
          var rc = [], cc = [];
          for (var b = 0; b < n; b++) {
            if (cand[a][b] & bit) rc.push(b);
            if (cand[b][a] & bit) cc.push(b);
          }
          if (rc.length === 1 && cand[a][rc[0]] !== bit) setCand(a, rc[0], bit);
          if (cc.length === 1 && cand[cc[0]][a] !== bit) setCand(cc[0], a, bit);
        }
      }
    }
    var grid = [], geloest = !bad;
    for (var rr = 0; rr < n; rr++) {
      var row = [];
      for (var cc2 = 0; cc2 < n; cc2++) {
        var bs = bits(cand[rr][cc2]);
        if (bs.length !== 1) geloest = false;
        row.push(bs.length === 1 ? bs[0] : 0);
      }
      grid.push(row);
    }
    return { geloest: geloest, grid: grid };
  }

  function latinSquare(n, rng) {
    var rp = shuffle(rng, range(n)), cp = shuffle(rng, range(n)), sp = shuffle(rng, range(n));
    return rp.map(function (i) { return cp.map(function (j) { return sp[(i + j) % n] + 1; }); });
  }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  function waehleOp(rng, P, k, vals) {
    if (vals.length === 1) return '=';
    var op;
    if (vals.length === 2) op = pick(rng, P.ops);
    else op = pick(rng, P.ops.filter(function (o) { return o === '+' || o === '×'; }));
    if (op === '÷' && Math.max(vals[0], vals[1]) % Math.min(vals[0], vals[1]) !== 0) op = '×';
    return op;
  }

  function partitionCages(n, P, rng, loesung) {
    var cageOfCell = {}, kaefige = [];
    shuffle(rng, range(n * n)).forEach(function (pos) {
      var r0 = Math.floor(pos / n), c0 = pos % n;
      if (cageOfCell[r0 + ',' + c0] !== undefined) return;
      var ziel = pick(rng, P.groessen), zellen = [[r0, c0]];
      cageOfCell[r0 + ',' + c0] = kaefige.length;
      while (zellen.length < ziel) {
        var opts = [];
        zellen.forEach(function (z) {
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var r = z[0] + d[0], c = z[1] + d[1];
            if (r >= 0 && c >= 0 && r < n && c < n && cageOfCell[r + ',' + c] === undefined) opts.push([r, c]);
          });
        });
        if (!opts.length) break;
        var nz = pick(rng, opts);
        cageOfCell[nz[0] + ',' + nz[1]] = kaefige.length;
        zellen.push(nz);
      }
      var vals = zellen.map(function (z) { return loesung[z[0]][z[1]]; });
      var op = waehleOp(rng, P, null, vals);
      kaefige.push({ zellen: zellen, op: op, ziel: cageZiel(op, vals) });
    });
    return kaefige;
  }

  // Repariert ein mehrdeutiges Raetsel: eine Zelle eines Mehrzell-Kaefigs wird
  // zum Hinweisfeld, der Rest-Kaefig bekommt sein Ziel neu.
  function repairCages(p, rng) {
    var multi = p.kaefige.map(function (k, i) { return i; }).filter(function (i) { return p.kaefige[i].zellen.length > 1; });
    if (!multi.length) return false;
    var i = pick(rng, multi), k = p.kaefige[i];
    var kandidaten = shuffle(rng, k.zellen.map(function (z, j) { return j; })).filter(function (j) {
      return zellenZusammenhaengend(k.zellen.filter(function (_, x) { return x !== j; }));
    });
    var j = kandidaten[0], z = k.zellen[j];
    var rest = k.zellen.filter(function (_, x) { return x !== j; });
    var wert = function (c) { return p.loesung[c[0]][c[1]]; };
    p.kaefige.push({ zellen: [z], op: '=', ziel: wert(z) });
    var restVals = rest.map(wert);
    var op = rest.length === 1 ? '=' : (k.op === '÷' || k.op === '−' ? '+' : k.op);
    p.kaefige[i] = { zellen: rest, op: op, ziel: cageZiel(op, restVals) };
    return true;
  }

  function generateCages(stufe, rng) {
    var P = STUFEN.kaefige[stufe], n = P.n;
    function gut(p) { return P.verzweigung ? solveCages(p, 2) === 1 : logicSolveCages(p).geloest; }
    for (var versuch = 0; versuch < 8; versuch++) {
      var loesung = latinSquare(n, rng);
      var p = { modus: 'kaefige', stufe: stufe, n: n, loesung: loesung, kaefige: partitionCages(n, P, rng, loesung) };
      for (var rep = 0; rep < 60; rep++) {
        if (gut(p)) return p;
        if (!repairCages(p, rng)) break;
      }
      if (gut(p)) return p;
    }
    // Notausgang: lauter Hinweisfelder (immer eindeutig)
    p.kaefige = [];
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) p.kaefige.push({ zellen: [[r, c]], op: '=', ziel: p.loesung[r][c] });
    return p;
  }

  return {
    GEN_VERSION: GEN_VERSION, STUFEN: STUFEN, MAX_STEIN: MAX_STEIN,
    mulberry32: mulberry32, randInt: randInt, shuffle: shuffle, pick: pick,
    buildPyramid: buildPyramid, solvePyramid: solvePyramid,
    logicSolvePyramid: logicSolvePyramid, generatePyramid: generatePyramid,
    cageZiel: cageZiel, cageOk: cageOk, zellenZusammenhaengend: zellenZusammenhaengend,
    solveCages: solveCages, logicSolveCages: logicSolveCages, generateCages: generateCages
  };
});
