// Lumo - Zielzahl-Modus: erzeugt die Zahlen auf den Kristallen. Reine Funktionen, Zufall nur über Seed.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.mathgen = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function isMultiple(v, reihe) { return v % reihe === 0; }
  function targetLabel(reihe) { return 'Sammle die ' + reihe + 'er-Reihe'; }

  // Verwechselbare falsche Zahlen: Nachbarn von Vielfachen (+-1, +-2) und Ergebnisse der Nachbarreihen.
  function wrongCandidates(reihe) {
    var set = {}, out = [];
    function add(v) {
      // <= 99: dreistellige Falsche wie 101 passen nicht lesbar auf einen Kristall
      if (v >= 1 && v <= 99 && !isMultiple(v, reihe) && !set[v]) { set[v] = true; out.push(v); }
    }
    for (var k = 1; k <= 10; k++) {
      var m = reihe * k;
      add(m - 1); add(m + 1); add(m - 2); add(m + 2);
      add((reihe - 1) * k); add((reihe + 1) * k);
    }
    // nur wirklich nahe Zahlen zulassen (Abstand zum nächsten Vielfachen <= 2)
    return out.filter(function (v) {
      var d = v % reihe; return Math.min(d, reihe - d) <= 2;
    });
  }

  // slots: [{tx, ty, landung?}]. opts: { reihe, seed, mode: 'ziel' | 'aus', ratio = 3 }
  function assignCrystals(slots, opts) {
    var mode = opts.mode || 'ziel';
    if (mode === 'aus') {
      return slots.map(function (s) { return { tx: s.tx, ty: s.ty, value: null, good: true }; });
    }
    var reihe = opts.reihe;
    if (!Number.isInteger(reihe) || reihe < 2 || reihe > 12) throw new Error('Ungültige Reihe: ' + reihe);
    var ratio = opts.ratio || 3;
    var rnd = mulberry32(opts.seed == null ? 1 : opts.seed);
    var n = slots.length;
    var nWrong = Math.round(n / (ratio + 1));

    // Welche Plätze falsch sind, entscheidet der Seed. Landestellen (slot.landung, siehe level.js)
    // bekommen nie eine falsche Zahl; reichen die übrigen Plätze nicht, gibt es weniger falsche.
    var order = shuffle(slots.map(function (_, i) { return i; }), rnd)
      .filter(function (i) { return !slots[i].landung; });
    var wrongIdx = {};
    order.slice(0, nWrong).forEach(function (i) { wrongIdx[i] = true; });

    // Gute Zahlen aus einem gemischten Beutel 1..10 (wiederholt sich erst nach 10).
    var bag = [], wbag = [], cands = wrongCandidates(reihe);
    return slots.map(function (s, i) {
      var value, good = !wrongIdx[i];
      if (good) {
        if (!bag.length) bag = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rnd);
        value = reihe * bag.pop();
      } else {
        if (!wbag.length) wbag = shuffle(cands, rnd);
        value = wbag.pop();
      }
      return { tx: s.tx, ty: s.ty, value: value, good: good };
    });
  }

  // Pixel-Schrift fuer die Kristallzahl: normal 5 px je Ziffer + 1 px Abstand, schmal 3 + 1.
  // Dreistellige Zahlen (nur die 100 der 10er-Reihe) brauchen die schmale, sonst ragen sie
  // ueber die 12 px Innenflaeche hinaus in die Nachbarkristalle.
  function anzeigeSchrift(value) {
    var n = String(value).length;
    return n >= 3 ? { schrift: 'schmal', breite: n * 4 - 1 } : { schrift: 'normal', breite: n * 6 - 1 };
  }

  // Tafel des Rechenwichts (core/gegner.js): eine Aufgabe reihe x faktor mit einem Ergebnis, das
  // 1 oder 2 neben dem richtigen liegt (wie die verwechselbaren falschen Kristallzahlen).
  // rnd: Zufallsfunktion (mulberry32), damit mehrere Wichte eines Levels nacheinander ziehen.
  function rechnung(reihe, rnd) {
    if (!Number.isInteger(reihe) || reihe < 2 || reihe > 10) throw new Error('Ungültige Reihe: ' + reihe);
    var faktor = 1 + Math.floor(rnd() * 10), richtig = faktor * reihe;
    var abw = [-2, -1, 1, 2].filter(function (d) { return richtig + d >= 1; });
    var falsch = richtig + abw[Math.floor(rnd() * abw.length)];
    return { faktor: faktor, reihe: reihe, richtig: richtig, falsch: falsch };
  }
  // Text fuer die Pixelschrift wie im Trainer (Reihe zuerst), z. B. '7×8=54' (falsch) bzw. '7×8=56' (aufgedeckt).
  function rechnungText(r, aufgedeckt) {
    return r.reihe + '×' + r.faktor + '=' + (aufgedeckt ? r.richtig : r.falsch);
  }

  return { rechnung: rechnung, rechnungText: rechnungText, anzeigeSchrift: anzeigeSchrift, assignCrystals: assignCrystals, isMultiple: isMultiple, targetLabel: targetLabel, mulberry32: mulberry32 };
});
