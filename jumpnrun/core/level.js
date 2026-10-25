// Lumo - ASCII-Level-Parser mit Validierung. Reine Funktionen.
//
// Zeichen:  .  Luft     #  Boden (fest)   S  Start     G  Ziel (Leuchtturm)
//           C  Checkpoint   o  Kristallplatz (Zahl wird beim Laden gesetzt, siehe mathgen.js)
//           ^  Dornen       ~  Federpilz
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { collision: require('./collision.js'), physics: require('./physics.js') }
    : { collision: root.JNR.collision, physics: root.JNR.physics };
  var api = factory(deps.collision, deps.physics);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.level = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C, P) {
  var T = C.TILE;
  var LANDUNG = 1; // nur die Kachel direkt hinter einer Gefahr gilt als Landestelle (sonst lernen Kinder "nach dem Sprung immer richtig")
  var CHARS = {
    '.': 'Luft', '#': 'Boden', 'S': 'Start', 'G': 'Ziel', 'C': 'Checkpoint',
    'o': 'Kristallplatz', '^': 'Dornen', '~': 'Federpilz'
  };

  function fail(msg) { var e = new Error(msg); e.name = 'LevelError'; throw e; }

  // Position der Figur, wenn sie auf der Kachel (tx, ty) steht
  function standPos(tx, ty) {
    return { tx: tx, ty: ty, x: tx * T + (T - P.W) / 2, y: (ty + 1) * T - P.H };
  }

  function parseLevel(rows) {
    if (!rows || !rows.length) fail('Level ist leer.');
    var h = rows.length, w = rows[0].length;
    var solid = new Uint8Array(w * h);
    var starts = [], goals = [], cps = [], slots = [], spikes = [], springs = [];

    rows.forEach(function (row, y) {
      if (row.length !== w) fail('Zeile ' + (y + 1) + ' hat ' + row.length + ' Zeichen, erwartet sind ' + w + '.');
      for (var x = 0; x < w; x++) {
        var c = row[x];
        if (!(c in CHARS)) fail('Zeile ' + (y + 1) + ', Spalte ' + (x + 1) + ': unbekanntes Zeichen \'' + c + '\'.');
        if (c === '#') solid[y * w + x] = 1;
        else if (c === 'S') starts.push({ tx: x, ty: y });
        else if (c === 'G') goals.push({ tx: x, ty: y });
        else if (c === 'C') cps.push({ tx: x, ty: y });
        else if (c === 'o') slots.push({ tx: x, ty: y });
        else if (c === '^') spikes.push({ tx: x, ty: y });
        else if (c === '~') springs.push({ tx: x, ty: y });
      }
    });

    if (starts.length !== 1) fail('Es muss genau einen Start (S) geben, gefunden: ' + starts.length + '.');
    if (goals.length !== 1) fail('Es muss genau ein Ziel (G) geben, gefunden: ' + goals.length + '.');

    function groundBelow(t) { return t.ty + 1 < h && solid[(t.ty + 1) * w + t.tx] === 1; }
    function needGround(t, name) {
      if (!groundBelow(t)) fail(name + ' bei Zeile ' + (t.ty + 1) + ', Spalte ' + (t.tx + 1) + ' braucht festen Boden darunter.');
    }
    needGround(starts[0], 'Start');
    needGround(goals[0], 'Ziel');
    cps.forEach(function (c) {
      needGround(c, 'Checkpoint');
      if (c.tx < starts[0].tx || c.tx > goals[0].tx)
        fail('Checkpoint bei Spalte ' + (c.tx + 1) + ' muss zwischen Start und Ziel liegen.');
    });
    spikes.forEach(function (s) { needGround(s, 'Dornen'); });
    springs.forEach(function (s) { needGround(s, 'Federpilz'); });

    function byXY(a, b) { return a.tx - b.tx || a.ty - b.ty; }
    cps.sort(byXY); slots.sort(byXY);

    // Landestelle: Kristall auf Boden, LANDUNG Kachel(n) direkt hinter Dornen, Federpilz, Luecke oder
    // Hoehenwechsel. Dort kommt Lumo nach einem Pflichtsprung auf; eine falsche Zahl waere kaum zu
    // vermeiden (mathgen.js setzt dort nur richtige Zahlen).
    function solidAt(x, y) { return x >= 0 && x < w && y >= 0 && y < h && solid[y * w + x] === 1; }
    function hazardAt(list, x, y) {
      for (var i = 0; i < list.length; i++) if (list[i].tx === x && list[i].ty === y) return true;
      return false;
    }
    slots.forEach(function (sl) {
      sl.landung = false;
      if (!groundBelow(sl)) return;
      for (var k = 1; k <= LANDUNG && sl.tx - k >= 0; k++) {
        var x = sl.tx - k;
        if (solidAt(x, sl.ty) || !solidAt(x, sl.ty + 1) ||
            hazardAt(spikes, x, sl.ty) || hazardAt(springs, x, sl.ty)) { sl.landung = true; return; }
      }
    });

    return {
      w: w, h: h, solid: solid,
      start: standPos(starts[0].tx, starts[0].ty),
      goal: { tx: goals[0].tx, ty: goals[0].ty },
      checkpoints: cps.map(function (c) { return standPos(c.tx, c.ty); }),
      crystalSlots: slots,
      spikes: spikes,
      springs: springs
    };
  }

  return { CHARS: CHARS, parseLevel: parseLevel, standPos: standPos, LANDUNG: LANDUNG };
});
