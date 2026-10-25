// Lumo - Spielsimulation (ein Schritt = 1/60 s). Reine Funktionen: Physik, Kristalle, Gefahren,
// Energie und Leben, Checkpoints, Ziel. Browser und Replay-Tests nutzen exakt denselben Code.
//
// Schaden: jede Quelle (falscher Kristall, Dornen, Rechenwicht von der Seite) ruft damage(g, quelle, richtung)
// auf. Das kostet 1 Energie, stoesst zurueck und macht INVULN Schritte unverwundbar. Energie 0 oder
// ein Sturz in den Abgrund kosten ein Leben (loseLife), ohne Leben ist der Lauf verloren.
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { physics: require('./physics.js'), mathgen: require('./mathgen.js'), collision: require('./collision.js'), gegner: require('./gegner.js') }
    : { physics: root.JNR.physics, mathgen: root.JNR.mathgen, collision: root.JNR.collision, gegner: root.JNR.gegner };
  var api = factory(deps.physics, deps.mathgen, deps.collision, deps.gegner);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.game = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, M, C, GG) {
  var T = C.TILE;
  var SPRING_V = 6.8;
  var STAMPF_V = 4.4; // Abprall nach dem Draufspringen auf einen Rechenwicht
  var KNOCK_X = 2.2, KNOCK_Y = 2.8;
  var LEBEN = 3, ENERGIE = 3;
  var INVULN = 60; // ca. 1 s unverwundbar nach Schaden oder Respawn

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
      enemies: GG.createEnemies(level, { reihe: opts.reihe, seed: opts.seed }),
      totalGood: crystals.filter(function (c) { return c.good; }).length,
      funken: 0, richtig: 0, fehltreffer: 0,
      leben: LEBEN, energie: ENERGIE, unverwundbar: 0,
      checkpointIdx: -1, spawn: { x: level.start.x, y: level.start.y },
      t: 0, status: 'play', events: []
    };
  }

  function respawn(g) {
    var p = g.player;
    p.x = g.spawn.x; p.y = g.spawn.y; p.vx = 0; p.vy = 0;
    p.onGround = false; p.coyote = 0; p.buffer = 0; p.canCut = false;
  }

  // Ein Leben weg (Energie leer oder Abgrund). Respawn am letzten Checkpoint mit voller Energie,
  // ohne Leben endet der Lauf mit status 'lost'. Das Ereignis traegt den Unfallort.
  function loseLife(g, grund) {
    var p = g.player;
    g.leben = Math.max(0, g.leben - 1);
    g.events.push({ type: 'leben', grund: grund, leben: g.leben, x: p.x, y: p.y });
    if (g.leben === 0) {
      g.status = 'lost'; g.energie = 0;
      g.events.push({ type: 'verloren' });
      return;
    }
    g.energie = ENERGIE;
    g.unverwundbar = INVULN;
    respawn(g);
  }

  // Gemeinsame Schadenslogik fuer alle Quellen ('kristall', 'stacheln', 'gegner', ...).
  // richtung: -1 stoesst nach links, +1 nach rechts. Gibt true zurueck, wenn der Schaden wirkte.
  function damage(g, quelle, richtung) {
    if (g.status !== 'play' || g.unverwundbar > 0) return false;
    var p = g.player;
    g.fehltreffer++;
    g.funken = Math.max(0, g.funken - 1);
    g.energie = Math.max(0, g.energie - 1);
    g.events.push({ type: 'schaden', quelle: quelle, energie: g.energie, x: p.x, y: p.y });
    if (g.energie === 0) { loseLife(g, 'energie'); return true; }
    var dir = richtung < 0 ? -1 : 1;
    p.vx = dir * KNOCK_X; p.vy = -KNOCK_Y; p.onGround = false; p.canCut = false;
    g.unverwundbar = INVULN;
    return true;
  }

  // Rueckstossrichtung weg von einer Gefahr mit Mittelpunkt cx (bei Gleichstand gegen die Blickrichtung).
  function awayFrom(p, cx) {
    var mid = p.x + P.W / 2;
    if (mid < cx) return -1;
    if (mid > cx) return 1;
    return -p.facing;
  }

  function tick(g, input) {
    if (g.status !== 'play') return g;
    g.events = [];
    g.t++;
    if (g.unverwundbar > 0) g.unverwundbar--;
    var p = g.player, L = g.level;
    var prevY = p.y;
    var r = P.step(p, input, L);
    if (r.jumped) g.events.push({ type: 'sprung' });
    if (r.landed) g.events.push({ type: 'landung' });

    // Abgrund
    if (p.y > L.h * T + 24) { g.fehltreffer++; g.funken = Math.max(0, g.funken - 1); loseLife(g, 'abgrund'); return g; }

    // Kristalle (großzügige Sammelbox 14 x 14 gegen die Terrain-Box)
    for (var i = 0; i < g.crystals.length; i++) {
      var c = g.crystals[i];
      if (c.state !== 'da') continue;
      if (!overlap(p.x, p.y, P.W, P.H, c.tx * T + 1, c.ty * T + 1, 14, 14)) continue;
      if (c.good) {
        c.state = 'weg'; g.funken++; g.richtig++;
        g.events.push({ type: 'funke', kette: g.richtig, index: i });
      } else if (g.unverwundbar === 0) {
        // In der Unverwundbarkeit bleibt der falsche Kristall liegen (kein Kettenschaden).
        c.state = 'kaputt';
        g.events.push({ type: 'falsch', index: i });
        damage(g, 'kristall', (p.x + P.W / 2) < (c.tx * T + T / 2) ? -1 : 1);
        if (g.status !== 'play') return g;
      }
    }

    // Rechenwichte: laufen, von oben gestampft decken sie die richtige Rechnung auf, von der Seite schaden sie
    for (var e = 0; e < g.enemies.length; e++) {
      var en = g.enemies[e];
      GG.step(en);
      var kontakt = GG.contact(en, p, prevY);
      if (kontakt === 'stampf') {
        GG.stampf(en);
        g.funken++;
        p.vy = -STAMPF_V; p.onGround = false; p.canCut = false;
        g.events.push({ type: 'stampf', index: e, x: en.x, y: en.y, rechnung: en.rechnung });
      } else if (kontakt === 'seite') {
        if (damage(g, 'gegner', awayFrom(p, en.x + GG.EW / 2)) && g.status !== 'play') return g;
      }
    }

    // Verzeihende Gefahrenbox: kleiner als die Figur (8 x 8)
    var hx = p.x + 1, hy = p.y + 2;
    for (var s = 0; s < L.spikes.length; s++) {
      var sp = L.spikes[s];
      if (overlap(hx, hy, 8, 8, sp.tx * T + 2, sp.ty * T + 8, 12, 8)) {
        if (damage(g, 'stacheln', awayFrom(p, sp.tx * T + T / 2)) && g.status !== 'play') return g;
        break;
      }
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

  // Tiefe Kopie des veraenderlichen Zustands (Level wird geteilt). Fuer die Vorausschau des Bots.
  // Neue veraenderliche Teile des Zustands (z. B. Gegner) muessen hier mitkopiert werden.
  function cloneGame(g) {
    var c = Object.assign({}, g);
    c.player = Object.assign({}, g.player);
    c.crystals = g.crystals.map(function (k) { return Object.assign({}, k); });
    c.enemies = g.enemies.map(function (e) { return Object.assign({}, e); }); // rechnung bleibt unveraendert und wird geteilt
    c.spawn = { x: g.spawn.x, y: g.spawn.y };
    c.events = [];
    return c;
  }

  function stats(g) {
    return {
      reached: g.status === 'won', lost: g.status === 'lost', leben: g.leben, richtig: g.richtig, totalGood: g.totalGood,
      fehltreffer: g.fehltreffer, funken: g.funken, timeMs: g.t * 1000 / 60
    };
  }

  return {
    createGame: createGame, tick: tick, stats: stats, damage: damage, cloneGame: cloneGame,
    SPRING_V: SPRING_V, LEBEN: LEBEN, ENERGIE: ENERGIE, INVULN: INVULN
  };
});
