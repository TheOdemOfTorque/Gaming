// Lumo - Rechenwicht: kleines Wesen mit einer Tafel, auf der eine falsche Rechnung aus der
// gewaehlten Reihe steht (z. B. 8×7=54). Es laeuft auf seiner Strecke (core/level.js strecke)
// hin und her. Springt Lumo von oben drauf, dreht sich die Tafel und zeigt die richtige Rechnung,
// danach verschwindet der Wicht. Beruehrung von der Seite kostet Energie (game.damage).
// Reine Funktionen, kein DOM, Zufall nur ueber den Seed.
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { physics: require('./physics.js'), mathgen: require('./mathgen.js'), collision: require('./collision.js') }
    : { physics: root.JNR.physics, mathgen: root.JNR.mathgen, collision: root.JNR.collision };
  var api = factory(deps.physics, deps.mathgen, deps.collision);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.gegner = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, M, C) {
  var T = C.TILE;
  var EW = 12, EH = 16;     // Trefferbox: Koerper unten, Tafel oben (zum Draufspringen)
  var KOERPER = 10;         // untere Hoehe, die bei Seitenkontakt zaehlt (die Tafel schadet nicht)
  var SPEED = 0.5;          // px je Schritt, ein Drittel von Lumos Laufgeschwindigkeit
  var STAMPF_TOL = 6;       // so tief duerfen Lumos Fuesse im Schritt davor schon unter der Oberkante sein
  var AUFGEDECKT = 70;      // Schritte, die die richtige Rechnung nach dem Stampfen sichtbar bleibt
  var SALZ = 0x5bd1e995;    // trennt den Zufall der Tafeln von dem der Kristalle

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // level.enemies kommt aus core/level.js. opts: { reihe, seed } wie game.createGame.
  function createEnemies(level, opts) {
    opts = opts || {};
    var reihe = Number.isInteger(opts.reihe) && opts.reihe >= 2 && opts.reihe <= 12 ? opts.reihe : 2;
    var rnd = M.mulberry32(((opts.seed == null ? 1 : opts.seed) ^ SALZ) >>> 0);
    return (level.enemies || []).map(function (w) {
      return {
        tx: w.tx, ty: w.ty,
        x: w.tx * T + (T - EW) / 2, y: (w.ty + 1) * T - EH,
        minX: w.von * T, maxX: (w.bis + 1) * T - EW,
        dir: -1, state: 'da', timer: 0,
        rechnung: M.rechnung(reihe, rnd)
      };
    });
  }

  // Ein Schritt: laufen und an den Enden der Strecke umdrehen; aufgedeckte Wichte zaehlen herunter.
  function step(e) {
    if (e.state === 'aufgedeckt') {
      if (--e.timer <= 0) { e.timer = 0; e.state = 'weg'; }
      return;
    }
    if (e.state !== 'da') return;
    e.x += e.dir * SPEED;
    if (e.x <= e.minX) { e.x = e.minX; e.dir = 1; }
    else if (e.x >= e.maxX) { e.x = e.maxX; e.dir = -1; }
  }

  // p: Spieler nach dem Physikschritt, prevY: seine Hoehe davor.
  // 'stampf': Lumo faellt und seine Fuesse waren eben noch ueber der Oberkante (ganze Box mit Tafel).
  // 'seite': die verzeihende 8x8-Box (wie bei den Dornen) beruehrt den Koerper. Sonst null.
  function contact(e, p, prevY) {
    if (e.state !== 'da') return null;
    if (p.vy > 0 && prevY + P.H <= e.y + STAMPF_TOL && overlap(p.x, p.y, P.W, P.H, e.x, e.y, EW, EH)) return 'stampf';
    if (overlap(p.x + 1, p.y + 2, 8, 8, e.x + 2, e.y + EH - KOERPER, EW - 4, KOERPER)) return 'seite';
    return null;
  }

  function stampf(e) { e.state = 'aufgedeckt'; e.timer = AUFGEDECKT; }

  return {
    createEnemies: createEnemies, step: step, contact: contact, stampf: stampf,
    EW: EW, EH: EH, SPEED: SPEED, AUFGEDECKT: AUFGEDECKT, STAMPF_TOL: STAMPF_TOL
  };
});
