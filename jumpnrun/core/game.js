// Lumo - Spielsimulation (ein Schritt = 1/60 s). Reine Funktionen: Physik, Kristalle, Gefahren,
// Checkpoints, Ziel. Browser und Replay-Tests nutzen exakt denselben Code.
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { physics: require('./physics.js'), mathgen: require('./mathgen.js'), collision: require('./collision.js') }
    : { physics: root.JNR.physics, mathgen: root.JNR.mathgen, collision: root.JNR.collision };
  var api = factory(deps.physics, deps.mathgen, deps.collision);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.game = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, M, C) {
  var T = C.TILE;
  var SPRING_V = 6.8;
  var KNOCK_X = 2.2, KNOCK_Y = 2.8;

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // opts: { mode: 'ziel' | 'aus', reihe, seed, crystals (überschreibt die Erzeugung, für Tests) }
  function createGame(level, opts) {
    opts = opts || {};
    var list = opts.crystals || M.assignCrystals(level.crystalSlots, {
      reihe: opts.reihe, seed: opts.seed, mode: opts.mode || 'ziel'
    });
    var crystals = list.map(function (c) {
      return { tx: c.tx, ty: c.ty, value: c.value, good: c.good, state: 'da' };
    });
    var p = P.createPlayer(level.start.x, level.start.y);
    return {
      level: level, player: p, crystals: crystals,
      totalGood: crystals.filter(function (c) { return c.good; }).length,
      funken: 0, richtig: 0, fehltreffer: 0,
      checkpointIdx: -1, spawn: { x: level.start.x, y: level.start.y },
      t: 0, status: 'play', events: []
    };
  }

  function respawn(g) {
    var p = g.player;
    p.x = g.spawn.x; p.y = g.spawn.y; p.vx = 0; p.vy = 0;
    p.onGround = false; p.coyote = 0; p.buffer = 0; p.canCut = false;
  }

  function hurt(g) {
    g.fehltreffer++;
    g.funken = Math.max(0, g.funken - 1);
    g.events.push({ type: 'treffer' });
    respawn(g);
  }

  function tick(g, input) {
    if (g.status !== 'play') return g;
    g.events = [];
    g.t++;
    var p = g.player, L = g.level;
    var r = P.step(p, input, L);
    if (r.jumped) g.events.push({ type: 'sprung' });
    if (r.landed) g.events.push({ type: 'landung' });

    // Abgrund
    if (p.y > L.h * T + 24) { hurt(g); return g; }

    // Kristalle (großzügige Sammelbox 14 x 14 gegen die Terrain-Box)
    for (var i = 0; i < g.crystals.length; i++) {
      var c = g.crystals[i];
      if (c.state !== 'da') continue;
      if (!overlap(p.x, p.y, P.W, P.H, c.tx * T + 1, c.ty * T + 1, 14, 14)) continue;
      if (c.good) {
        c.state = 'weg'; g.funken++; g.richtig++;
        g.events.push({ type: 'funke', kette: g.richtig, index: i });
      } else {
        c.state = 'kaputt'; g.fehltreffer++; g.funken = Math.max(0, g.funken - 1);
        var dir = (p.x + P.W / 2) < (c.tx * T + T / 2) ? -1 : 1;
        p.vx = dir * KNOCK_X; p.vy = -KNOCK_Y; p.onGround = false; p.canCut = false;
        g.events.push({ type: 'falsch', index: i });
      }
    }

    // Verzeihende Gefahrenbox: kleiner als die Figur (8 x 8)
    var hx = p.x + 1, hy = p.y + 2;
    for (var s = 0; s < L.spikes.length; s++) {
      var sp = L.spikes[s];
      if (overlap(hx, hy, 8, 8, sp.tx * T + 2, sp.ty * T + 8, 12, 8)) { hurt(g); return g; }
    }

    for (var f = 0; f < L.springs.length; f++) {
      var sf = L.springs[f];
      if (p.vy >= 0 && overlap(p.x, p.y, P.W, P.H, sf.tx * T, sf.ty * T + 8, T, 8)) {
        p.vy = -SPRING_V; p.onGround = false; p.canCut = false;
        g.events.push({ type: 'feder' });
      }
    }

    for (var k = g.checkpointIdx + 1; k < L.checkpoints.length; k++) {
      var cp = L.checkpoints[k];
      if (overlap(p.x, p.y, P.W, P.H, cp.tx * T, cp.ty * T, T, T)) {
        g.checkpointIdx = k; g.spawn = { x: cp.x, y: cp.y };
        g.events.push({ type: 'checkpoint', index: k });
      }
    }

    var gl = L.goal;
    if (overlap(p.x, p.y, P.W, P.H, gl.tx * T + 2, (gl.ty - 1) * T, 12, 2 * T)) {
      g.status = 'won';
      g.events.push({ type: 'ziel' });
    }
    return g;
  }

  function stats(g) {
    return {
      reached: g.status === 'won', richtig: g.richtig, totalGood: g.totalGood,
      fehltreffer: g.fehltreffer, funken: g.funken, timeMs: g.t * 1000 / 60
    };
  }

  return { createGame: createGame, tick: tick, stats: stats, SPRING_V: SPRING_V };
});
