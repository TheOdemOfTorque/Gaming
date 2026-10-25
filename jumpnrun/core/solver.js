// Lumo - Greedy-Bot: beweist Loesbarkeit durch die reine Simulation (kein Aufzeichnen von Hand).
// Laeuft immer nach rechts, springt reflexhaft vor Kante, Wand oder Dornen. Keine Zufallszahlen,
// also deterministisch bei gleichem Level/gleichen Optionen. Haelt den Sprung immer 22 Schritte
// (siehe HOLD): das ist in core/physics.js vermessen die Dauer, die auf eine Luecke oder Stufe von
// bis zu 3 Kacheln reicht (core/levelgen.js und data/sections.js bleiben mit 1-2 Kacheln darunter).
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { game: require('./game.js'), physics: require('./physics.js'), collision: require('./collision.js') }
    : { game: root.JNR.game, physics: root.JNR.physics, collision: root.JNR.collision };
  var api = factory(deps.game, deps.physics, deps.collision);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.solver = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G, P, C) {
  var T = C.TILE;
  var HOLD = 22;

  function hazardAt(list, tx, ty) {
    for (var i = 0; i < list.length; i++) if (list[i].tx === tx && list[i].ty === ty) return true;
    return false;
  }

  // level: geparstes Level (core/level.js). gameOpts: wie Game.createGame. maxFrames: Abbruch (nicht loesbar).
  function solve(level, gameOpts, maxFrames) {
    maxFrames = maxFrames || 60 * 180;
    var game = G.createGame(level, gameOpts);
    var jumpUntil = -1;
    for (var f = 0; f < maxFrames; f++) {
      var p = game.player;
      var leadTx = Math.floor((p.x + P.W + 1) / T);
      var footTy = Math.floor((p.y + P.H + 1) / T) - 1;
      var wall = C.solidAt(level, leadTx, footTy);
      var gap = p.onGround && !C.solidAt(level, leadTx, footTy + 1);
      var spike = hazardAt(level.spikes, leadTx, footTy) || hazardAt(level.spikes, leadTx + 1, footTy);
      if (p.onGround && jumpUntil <= f && (wall || gap || spike)) jumpUntil = f + HOLD;
      G.tick(game, { left: false, right: true, jump: f < jumpUntil });
      if (game.status === 'won') return { won: true, frames: f + 1, game: game };
    }
    return { won: false, frames: maxFrames, game: game };
  }

  return { solve: solve, HOLD: HOLD };
});
