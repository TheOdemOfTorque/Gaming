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
 * SPEICHER-UEBERSICHT (drei getrennte localStorage-Schluessel)
 * ---------------------------------------------------------------------------
 * - henry_einmaleins  : nur der Trainer schreibt hier (siehe oben).
 * - henry_knobel      : Raetsel-Fortschritt, Stufen, XP (knobelMigration()).
 * - henry_knobel_ui   : rein praesentationsbezogene Einstellungen, kein
 *   Raetsel-Zustand. Aktuell { dubletteWarnung: bool, tutorialGesehen: {
 *   mauer: bool, kaefige: bool } }. Laden/Speichern lebt in index.html
 *   (try/catch wie bei henry_knobel), bewusst getrennt von henry_knobel,
 *   damit ein zurueckgesetztes Raetsel die Einstellungen nicht mitreisst.
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KnobelLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GEN_VERSION = 2;

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

  // Baut die Rechnung fuer den Rechenstreifen aus einem Kaefig oder einem
  // Mauerstein und den aktuell eingetragenen Werten (null = leer).
  // Kaefig: aufgabe = { op: '+'|'×'|'−'|'÷'|'=', ziel }, eingaben = n Zellenwerte.
  // Mauerstein: aufgabe = { op: 'mul'|'add' }, eingaben = [quelleA, quelleB, ergebnis].
  // Bei voll ausgefuelltem, falschem Kaefig zeigt "ergebnis" das tatsaechlich
  // Gerechnete (nicht die Zielzahl), damit der Satz beides gegenueberstellen kann.
  function rechnungFuer(aufgabe, eingaben) {
    var op = aufgabe.op;
    if (op === 'mul' || op === 'add') {
      var a = eingaben[0], b = eingaben[1], ergebnis = eingaben[2];
      var glieder = [a, b];
      var lueckeIndex = null, ergebnisIstLuecke = false, vollstaendig, erfuellt = null, computed = null;
      if (a === null || b === null) {
        lueckeIndex = a === null ? 0 : 1;
        vollstaendig = false;
      } else {
        computed = op === 'mul' ? a * b : a + b;
        if (ergebnis === null) { ergebnisIstLuecke = true; vollstaendig = false; }
        else { vollstaendig = true; erfuellt = computed === ergebnis; }
      }
      return { op: op === 'mul' ? '×' : '+', glieder: glieder, ziel: null, ergebnis: ergebnis, computed: computed,
        lueckeIndex: lueckeIndex, ergebnisIstLuecke: ergebnisIstLuecke, vollstaendig: vollstaendig, erfuellt: erfuellt };
    }
    var ziel = aufgabe.ziel;
    if (op === '=') {
      var wert = eingaben[0] === undefined ? null : eingaben[0];
      var voll = wert !== null;
      return { op: '=', glieder: [], ziel: ziel, ergebnis: ziel, computed: voll ? wert : null,
        lueckeIndex: null, ergebnisIstLuecke: !voll, vollstaendig: voll, erfuellt: voll ? wert === ziel : null };
    }
    var vals = eingaben.slice();
    if ((op === '−' || op === '÷') && vals[0] !== null && vals[1] !== null) {
      vals = [Math.max(vals[0], vals[1]), Math.min(vals[0], vals[1])];
    }
    var nullIdx = vals.indexOf(null);
    if (nullIdx === -1) {
      var berechnet = cageZiel(op, vals);
      return { op: op, glieder: vals, ziel: ziel, ergebnis: berechnet === ziel ? ziel : berechnet, computed: berechnet,
        lueckeIndex: null, ergebnisIstLuecke: false, vollstaendig: true, erfuellt: berechnet === ziel };
    }
    return { op: op, glieder: vals, ziel: ziel, ergebnis: ziel, computed: null,
      lueckeIndex: nullIdx, ergebnisIstLuecke: false, vollstaendig: false, erfuellt: null };
  }

  var OP_WORT = { '+': 'Zusammenzählen', '×': 'Malnehmen', '−': 'Abziehen', '÷': 'Teilen' };
  var OP_KLEIN = { '+': 'plus', '×': 'mal', '−': 'minus', '÷': 'geteilt durch' };

  // Satz unter der Rechnung im Rechenstreifen, passend zu rechnungFuer()s Ergebnis.
  // kontext.dublette: Ziffer, die in Zeile/Spalte schon vorkommt (ueberschreibt alles andere).
  function satzFuer(r, kontext) {
    kontext = kontext || {};
    if (kontext.dublette !== undefined && kontext.dublette !== null) {
      return 'Die ' + kontext.dublette + ' steht in dieser Zeile schon.';
    }
    if (r.op === '=') return 'Diese Zahl ist geschenkt.';
    var wort = OP_WORT[r.op];
    if (kontext.modus === 'mauer') {
      if (r.vollstaendig) return r.erfuellt ? 'Stein fertig.' : 'Das stimmt noch nicht.';
      if (r.ergebnisIstLuecke) return wort + ': ' + r.glieder[0] + ' ' + OP_KLEIN[r.op] + ' ' + r.glieder[1] + ' ergibt …';
      return wort + ': Welche Zahl fehlt noch?';
    }
    if (!r.vollstaendig) return wort + ': Welche Zahl fehlt noch?';
    if (r.erfuellt) return 'Käfig fertig.';
    return 'Das ergibt ' + r.computed + ', gesucht ist ' + r.ziel + '.';
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

  // Baut die Kaefige nicht blind und repariert danach, sondern waechst
  // umgekehrt aus lauter Hinweisfeldern (immer eindeutig): Zellen werden
  // nacheinander zu Nachbar-Kaefigen verschmolzen, aber nur, wenn das
  // Raetsel danach weiterhin eindeutig loesbar bleibt (gut-Pruefung). So
  // bleiben moeglichst wenige Zellen als Hinweis stehen, statt nachtraeglich
  // Hinweise einstreuen zu muessen, bis die Mehrdeutigkeit verschwindet.
  function allSingles(n, loesung) {
    var kaefige = [];
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) kaefige.push({ zellen: [[r, c]], op: '=', ziel: loesung[r][c] });
    return kaefige;
  }

  function ohneZellen(kaefige, zellen) {
    return kaefige.filter(function (k) {
      return !k.zellen.some(function (z) { return zellen.some(function (z2) { return z2[0] === z[0] && z2[1] === z[1]; }); });
    });
  }

  function growCages(p, P, rng, gut) {
    var n = p.n, frei = {}, r, c;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) frei[r + ',' + c] = true;
    shuffle(rng, range(n * n)).forEach(function (pos) {
      var r0 = Math.floor(pos / n), c0 = pos % n;
      if (!frei[r0 + ',' + c0]) return;
      var ziel = pick(rng, P.groessen), zellen = [[r0, c0]];
      for (;;) {
        if (zellen.length >= ziel) break;
        var opts = [];
        zellen.forEach(function (z) {
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            var nr = z[0] + d[0], nc = z[1] + d[1];
            if (nr >= 0 && nc >= 0 && nr < n && nc < n && frei[nr + ',' + nc] &&
                !zellen.some(function (z2) { return z2[0] === nr && z2[1] === nc; }) &&
                !opts.some(function (o) { return o[0] === nr && o[1] === nc; })) opts.push([nr, nc]);
          });
        });
        if (!opts.length) break;
        var gewachsen = false;
        var kandidaten = shuffle(rng, opts);
        for (var i = 0; i < kandidaten.length; i++) {
          var probe = zellen.concat([kandidaten[i]]);
          var vals = probe.map(function (z) { return p.loesung[z[0]][z[1]]; });
          var op = waehleOp(rng, P, null, vals);
          var neu = { zellen: probe, op: op, ziel: cageZiel(op, vals) };
          var kandidatP = { modus: p.modus, stufe: p.stufe, n: n, loesung: p.loesung, kaefige: ohneZellen(p.kaefige, probe).concat([neu]) };
          if (gut(kandidatP)) {
            p.kaefige = kandidatP.kaefige;
            zellen = probe;
            gewachsen = true;
            break;
          }
        }
        if (!gewachsen) break;
      }
      zellen.forEach(function (z) { delete frei[z[0] + ',' + z[1]]; });
    });
  }

  function generateCages(stufe, rng) {
    var P = STUFEN.kaefige[stufe], n = P.n;
    function gut(p) { return P.verzweigung ? solveCages(p, 2) === 1 : logicSolveCages(p).geloest; }
    var p;
    for (var versuch = 0; versuch < 8; versuch++) {
      var loesung = latinSquare(n, rng);
      p = { modus: 'kaefige', stufe: stufe, n: n, loesung: loesung, kaefige: allSingles(n, loesung) };
      growCages(p, P, rng, gut);
      if (gut(p)) return p;
    }
    // Notausgang, in der Praxis nie erreicht: lauter Hinweisfelder bleiben
    // immer eindeutig loesbar, growCages faellt darauf von selbst zurueck.
    return p;
  }

  // ===== Raetsel, Pruefen, Tipp, Zuege =====
  function generatePuzzle(modus, stufe, seed) {
    var rng = mulberry32(seed), p;
    if (modus === 'mauer') p = generatePyramid(stufe, rng);
    else if (modus === 'kaefige') p = generateCages(stufe, rng);
    else throw new Error('Unbekannter Modus: ' + modus);
    p.seed = seed >>> 0;
    p.genVersion = GEN_VERSION;
    return p;
  }

  function kaefigFuer(p, r, c) {
    for (var i = 0; i < p.kaefige.length; i++) {
      for (var j = 0; j < p.kaefige[i].zellen.length; j++) {
        var z = p.kaefige[i].zellen[j];
        if (z[0] === r && z[1] === c) return p.kaefige[i];
      }
    }
    return null;
  }
  // Ist die Zelle vorgegeben (nicht vom Kind zu fuellen)?
  function istFest(modus, p, r, c) {
    if (modus === 'mauer') return p.gegeben[r][c] !== null;
    var k = kaefigFuer(p, r, c);
    return !!k && k.op === '=';
  }
  function festerWert(modus, p, r, c) {
    if (modus === 'mauer') return p.gegeben[r][c];
    return kaefigFuer(p, r, c).ziel;
  }
  function wirksam(modus, p, e, r, c) {
    if (istFest(modus, p, r, c)) return festerWert(modus, p, r, c);
    var v = e[r] ? e[r][c] : null;
    return v ? v : null;
  }
  function zellenListe(modus, p) {
    var out = [], r, c;
    if (modus === 'mauer') {
      for (r = 0; r < p.n; r++) for (c = 0; c < p.n - r; c++) out.push([r, c]);
    } else {
      for (r = 0; r < p.n; r++) for (c = 0; c < p.n; c++) out.push([r, c]);
    }
    return out;
  }

  function checkSolution(modus, p, e) {
    var falsche = [], konflikte = [], voll = true;
    zellenListe(modus, p).forEach(function (z) {
      var v = wirksam(modus, p, e, z[0], z[1]);
      if (v === null) { voll = false; return; }
      if (v !== p.loesung[z[0]][z[1]]) falsche.push([z[0], z[1]]);
    });
    if (modus === 'kaefige') {
      for (var r = 0; r < p.n; r++) for (var c = 0; c < p.n; c++) {
        var v = wirksam(modus, p, e, r, c);
        if (v === null) continue;
        for (var x = 0; x < p.n; x++) {
          if ((x !== c && wirksam(modus, p, e, r, x) === v) ||
              (x !== r && wirksam(modus, p, e, x, c) === v)) { konflikte.push([r, c]); break; }
        }
      }
    }
    return { vollstaendig: voll, richtig: voll && falsche.length === 0, falsche: falsche, konflikte: konflikte };
  }

  // Tipp: korrigiert zuerst ein falsches Feld, sonst verraet er ein Feld, das
  // sich (Mauer) aus dem bereits Bekannten ableiten laesst.
  function findHint(modus, p, e) {
    var liste = zellenListe(modus, p), i, z;
    for (i = 0; i < liste.length; i++) {
      z = liste[i];
      if (istFest(modus, p, z[0], z[1])) continue;
      var v = wirksam(modus, p, e, z[0], z[1]);
      if (v !== null && v !== p.loesung[z[0]][z[1]]) return { r: z[0], c: z[1], wert: p.loesung[z[0]][z[1]] };
    }
    var offen = liste.filter(function (q) { return wirksam(modus, p, e, q[0], q[1]) === null; });
    if (!offen.length) return null;
    if (modus === 'mauer') {
      var bekannt = function (r, c) { return wirksam(modus, p, e, r, c) !== null; };
      var leitbar = function (q) {
        var r = q[0], c = q[1], dreiecke = [];
        if (r >= 1) dreiecke.push([[r - 1, c], [r - 1, c + 1], [r, c]]);        // q ist Spitze
        if (r + 1 < p.n) {
          if (c < p.n - r - 1) dreiecke.push([[r + 1, c], [r, c + 1], [r, c]]);  // q ist linke Basis
          if (c > 0) dreiecke.push([[r + 1, c - 1], [r, c - 1], [r, c]]);        // q ist rechte Basis
        }
        return dreiecke.some(function (t) { return bekannt(t[0][0], t[0][1]) && bekannt(t[1][0], t[1][1]); });
      };
      var l = offen.filter(leitbar);
      if (l.length) z = l[0]; else z = offen[0];
    } else {
      z = offen[0];
    }
    return { r: z[0], c: z[1], wert: p.loesung[z[0]][z[1]] };
  }

  function applyMove(e, m) {
    var neu = e.map(function (row) { return row.slice(); });
    neu[m.r][m.c] = m.neu;
    return neu;
  }
  function undoMove(e, m) {
    var neu = e.map(function (row) { return row.slice(); });
    neu[m.r][m.c] = m.alt;
    return neu;
  }

  // ===== XP, Stufen, Seeds =====
  // Marco 30.10.2026: hoechstens ein Drittel einer Trainingsreihe pro Tag (eine Reihe mit 20 richtigen
  // bringt 328 XP), pro Raetsel 30 bis 100 je Stufe. Tipps und Tagesraetsel wirken wie bisher.
  var BASIS_XP = { 1: 30, 2: 40, 3: 55, 4: 75, 5: 100 };
  var TAGES_CAP = 110;
  function computeKnobelXP(opt, tagesXpBisher) {
    var basis = BASIS_XP[opt.stufe] || 0;
    var f = Math.max(0.4, 1 - 0.2 * (opt.tipps || 0));
    var voll = Math.round(basis * f * (opt.tagesraetsel ? 1.5 : 1));
    var rest = Math.max(0, TAGES_CAP - (tagesXpBisher || 0));
    var gedeckelt = voll > rest;
    return { xp: Math.min(voll, rest), gedeckelt: gedeckelt, basis: basis };
  }

  // serie: positiv = saubere Loesungen in Folge, negativ = unsaubere (Tipp/Abbruch)
  function nextKnobelStufe(stufe, serie, sauber) {
    if (sauber) {
      serie = serie > 0 ? serie + 1 : 1;
      if (serie >= 2) return { stufe: Math.min(5, stufe + 1), serie: 0 };
    } else {
      serie = serie < 0 ? serie - 1 : -1;
      if (serie <= -2) return { stufe: Math.max(1, stufe - 1), serie: 0 };
    }
    return { stufe: stufe, serie: serie };
  }

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function dailySeed(datum, modus) { return hashString('knobel|' + modus + '|' + datum); }

  // ===== Standalone-Speicher henry_knobel =====
  var KNOBEL_STATE_VERSION = 1;
  function defaultKnobelState() {
    return {
      v: KNOBEL_STATE_VERSION,
      stufe: { mauer: 1, kaefige: 1 },
      serie: { mauer: 0, kaefige: 0 },
      geloest: { mauer: 0, kaefige: 0 },
      ohneTipp: { mauer: 0, kaefige: 0 },
      bestSek: { mauer: {}, kaefige: {} },
      tagesXp: { datum: null, xp: 0 },
      tagesraetsel: { datum: null, modus: null, geloest: false },
      laufend: null,
      stumm: false
    };
  }
  function istGueltigeStufe(v) { return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5; }
  function istGueltigeXp(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }
  function istPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function istGueltigeEingabe(modus, stufe, e) {
    var P = STUFEN[modus] && STUFEN[modus][stufe];
    if (!P || !Array.isArray(e) || e.length !== P.n) return false;
    for (var r = 0; r < P.n; r++) {
      var breite = modus === 'mauer' ? P.n - r : P.n;
      if (!Array.isArray(e[r]) || e[r].length !== breite) return false;
    }
    return true;
  }

  function knobelMigration(state) {
    var d = defaultKnobelState();
    if (!state || typeof state !== 'object' || Array.isArray(state)) return d;
    var out = {};
    Object.keys(d).forEach(function (k) {
      var dv = d[k], sv = state[k];
      if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
        out[k] = Object.assign({}, dv, sv && typeof sv === 'object' ? sv : {});
      } else {
        out[k] = sv === undefined ? dv : sv;
      }
    });
    ['mauer', 'kaefige'].forEach(function (m) {
      if (!istGueltigeStufe(out.stufe[m])) out.stufe[m] = d.stufe[m];
      if (!istPlainObject(out.bestSek[m])) out.bestSek[m] = {};
    });
    if (!istGueltigeXp(out.tagesXp.xp)) out.tagesXp.xp = 0;
    var lf = out.laufend;
    if (lf && (typeof lf !== 'object' || (lf.modus !== 'mauer' && lf.modus !== 'kaefige') ||
        !istGueltigeStufe(lf.stufe) || !istGueltigeEingabe(lf.modus, lf.stufe, lf.eingabe))) {
      out.laufend = null;
    }
    out.v = KNOBEL_STATE_VERSION;
    return out;
  }
  function tagesXpFuer(tagesXp, heute) {
    return tagesXp && tagesXp.datum === heute ? (tagesXp.xp || 0) : 0;
  }

  return {
    GEN_VERSION: GEN_VERSION, STUFEN: STUFEN, MAX_STEIN: MAX_STEIN,
    mulberry32: mulberry32, randInt: randInt, shuffle: shuffle, pick: pick,
    buildPyramid: buildPyramid, solvePyramid: solvePyramid,
    logicSolvePyramid: logicSolvePyramid, generatePyramid: generatePyramid,
    cageZiel: cageZiel, cageOk: cageOk, rechnungFuer: rechnungFuer, satzFuer: satzFuer,
    zellenZusammenhaengend: zellenZusammenhaengend,
    solveCages: solveCages, logicSolveCages: logicSolveCages, generateCages: generateCages,
    generatePuzzle: generatePuzzle, checkSolution: checkSolution, findHint: findHint,
    istFest: istFest, festerWert: festerWert, kaefigFuer: kaefigFuer, wirksam: wirksam,
    applyMove: applyMove, undoMove: undoMove,
    BASIS_XP: BASIS_XP, TAGES_CAP: TAGES_CAP, computeKnobelXP: computeKnobelXP,
    nextKnobelStufe: nextKnobelStufe, dailySeed: dailySeed,
    KNOBEL_STATE_VERSION: KNOBEL_STATE_VERSION, defaultKnobelState: defaultKnobelState,
    knobelMigration: knobelMigration, tagesXpFuer: tagesXpFuer
  };
});
