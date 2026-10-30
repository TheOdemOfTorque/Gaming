// Lumo - Greedy-Bot: beweist Loesbarkeit durch die reine Simulation (kein Aufzeichnen von Hand).
// Laeuft immer nach rechts, springt reflexhaft vor Kante, Wand, Dornen oder einem Rechenwicht. Keine Zufallszahlen,
// also deterministisch bei gleichem Level/gleichen Optionen. Haelt den Sprung immer 22 Schritte
// (siehe HOLD): das ist in core/physics.js vermessen die Dauer, die auf eine Luecke oder Stufe von
// bis zu 3 Kacheln reicht (data/sections.js geht bis genau 3: d3-kombo-a und d3-kombo-c liegen am
// Maximum, tests/unit/jnr-sections.test.js prueft die Bibliothek gegen sprungmass).
//
// Energie und Leben: Der Bot schaut auf einer Kopie des Spiels (game.cloneGame) voraus. Kostet der
// reine Reflexweg Energie oder ein Leben (falsche Zahl, Dornen, Rechenwicht, Sturz), probiert er Alternativen
// (springen, kurz springen, bremsen, zuruecklenken) und nimmt die billigste. Ein Kind kann falschen Zahlen genauso ausweichen.
//
// Was der Bot beweist (Marco, 29.10.): nur die Erreichbarkeit des Ziels. Dafuer laeuft er unsterblich
// (botOpts.unsterblich -> game.createGame opts.unsterblich: Sturz und Treffer loesen weiter Respawn und
// Rueckstoss aus, kosten aber nichts). Kommt er SOFTLOCK Schritte lang nicht ueber sein bisheriges
// x-Maximum hinaus (z. B. Endlosschleife Sturz/Respawn vor einer zu breiten Grube), gilt der Lauf als
// steckengeblieben (softlock). Verlorene Leben, Schaden und Dauer des Laufs mit 3 Leben sind nur noch
// Messwerte dafuer, wie schwer es fuer den Bot war (scripts/jnr-messen.js).
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { game: require('./game.js'), physics: require('./physics.js'), collision: require('./collision.js'), gegner: require('./gegner.js') }
    : { game: root.JNR.game, physics: root.JNR.physics, collision: root.JNR.collision, gegner: root.JNR.gegner };
  var api = factory(deps.game, deps.physics, deps.collision, deps.gegner);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.solver = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G, P, C, GG) {
  var T = C.TILE;
  var HOLD = 22;
  var LOOKAHEAD = 150;
  var PROGRESS = 7;    // Kacheln, bis zu denen die Vorausschau Schaden zaehlt
  var HOP = 8;         // gehaltene Schritte beim kurzen Sprung
  var RECHECK = 3;     // Schritte bis zur naechsten Pruefung, wenn keine Alternative hilft
  var STEER = 8;       // Schritte beim Bremsen oder Zuruecklenken
  var WICHT_ABSTAND = 14; // px: so nah vor einem Rechenwicht springt der Reflex ab
  // Schritte ohne neues x-Maximum, ab denen der Lauf als steckengeblieben gilt (10 s). Gemessen am
  // 3-Leben-Bot in Stufe 1-2 ueber 200 Seeds: laengste Spanne ohne Fortschritt 145 Schritte; alle
  // 3 Leben in einer Grube zu verlieren dauert 261 Schritte. 600 laesst beidem mehr als das Doppelte Luft.
  var SOFTLOCK = 600;

  function hazardAt(list, tx, ty) {
    for (var i = 0; i < list.length; i++) if (list[i].tx === tx && list[i].ty === ty) return true;
    return false;
  }

  // Rechenwicht (noch nicht aufgedeckt) auf Lumos Hoehe knapp vor ihm?
  function wichtVoraus(game, p) {
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (e.state !== 'da' || Math.abs((e.y + GG.EH) - (p.y + P.H)) > 2) continue;
      var d = e.x - (p.x + P.W);
      if (d >= 0 && d <= WICHT_ABSTAND) return true;
    }
    return false;
  }

  // Reflex: Kante, Wand, Dornen oder Rechenwicht direkt voraus?
  function reflex(game, level) {
    var p = game.player;
    var leadTx = Math.floor((p.x + P.W + 1) / T);
    var footTy = Math.floor((p.y + P.H + 1) / T) - 1;
    var wall = C.solidAt(level, leadTx, footTy);
    var gap = p.onGround && !C.solidAt(level, leadTx, footTy + 1);
    var spike = hazardAt(level.spikes, leadTx, footTy) || hazardAt(level.spikes, leadTx + 1, footTy);
    return { trigger: wall || gap || spike || wichtVoraus(game, p), leadTx: leadTx, footTy: footTy };
  }

  // Ein Schritt der Bot-Steuerung. st.jumpUntil merkt sich den gehaltenen Sprung, st.steerUntil und
  // st.steer eine kurze Phase, in der der Bot rechts loslaesst (0) oder nach links drueckt (-1).
  // Aktionen: 'jump' (voller Sprung), 'hop' (kurzer Sprung), 'coast' (bremsen), 'back' (zurueck).
  function stepBot(game, level, st, f, action) {
    var p = game.player, canJump = p.onGround && st.jumpUntil <= f;
    if (action === 'jump' && canJump) st.jumpUntil = f + HOLD;
    else if (action === 'hop' && canJump) st.jumpUntil = f + HOP;
    else if (action === 'coast') { st.steerUntil = f + STEER; st.steer = 0; }
    else if (action === 'back') { st.steerUntil = f + STEER; st.steer = -1; }
    if (p.onGround && st.jumpUntil <= f && reflex(game, level).trigger) st.jumpUntil = f + HOLD;
    var steer = f < st.steerUntil ? st.steer : 1;
    G.tick(game, { left: steer < 0, right: steer > 0, jump: f < st.jumpUntil });
  }

  // Vorausschau auf einer Kopie: nach der Aktion steuert der reine Reflex, bis Lumo PROGRESS Kacheln
  // weiter rechts ist (oder das Ziel erreicht). Kosten: 1 je verlorene Energie, 100 je Leben, 50 wenn
  // der Weg in LOOKAHEAD Schritten nicht geschafft wird (sonst waere "ewig bremsen" am billigsten).
  // end: Schritt, an dem die Vorausschau endete.
  function rollout(game, level, st0, f0, action) {
    var g = G.cloneGame(game), st = { jumpUntil: st0.jumpUntil, steerUntil: st0.steerUntil, steer: st0.steer };
    var goalX = g.player.x + PROGRESS * T, cost = 0;
    for (var f = f0; f < f0 + LOOKAHEAD; f++) {
      stepBot(g, level, st, f, f === f0 ? action : null);
      for (var i = 0; i < g.events.length; i++) {
        if (g.events[i].type === 'leben') cost += 100;
        else if (g.events[i].type === 'schaden') cost += 1;
      }
      if (g.status === 'lost') return { cost: cost + 1000, end: f };
      if (g.status === 'won' || g.player.x >= goalX) return { cost: cost, end: f };
    }
    return { cost: cost + 50, end: f };
  }

  // Vergleicht weiterlaufen (Reflex) mit springen, kurz springen, bremsen und zuruecklenken.
  // Ist der Reflexweg schadlos, merkt sich der Bot das (st.safeUntil): bis dahin verlaeuft das echte
  // Spiel genau wie die Vorausschau, eine neue Pruefung waere verschwendet.
  function choose(game, level, st, f) {
    if (f < st.steerUntil || f < st.safeUntil) return null;
    var base = rollout(game, level, st, f, null);
    if (base.cost === 0) { st.safeUntil = base.end; return null; }
    var p = game.player, best = null, bestCost = base.cost;
    var opts = (p.onGround && st.jumpUntil <= f) ? ['jump', 'hop', 'coast', 'back'] : ['coast', 'back'];
    for (var i = 0; i < opts.length; i++) {
      var c = rollout(game, level, st, f, opts[i]).cost;
      if (c < bestCost) { bestCost = c; best = opts[i]; }
    }
    if (best === null) st.safeUntil = f + RECHECK; // nichts besser: erst in RECHECK Schritten neu pruefen
    return best;
  }

  // level: geparstes Level (core/level.js). gameOpts: wie Game.createGame. maxFrames: Abbruch (nicht loesbar).
  // botOpts: { unsterblich } (nur fuer Tests, siehe Kopf).
  // Ergebnis: { won, softlock, frames, game, schaden, verluste, fehler? } mit den Schadensquellen
  // (z. B. { kristall: 2 }) und den Lebensverlusten je Grund ({ abgrund: 1, energie: 0 }) des echten
  // Laufs; unsterblich zaehlt verluste.abgrund die Stuerze, die nichts gekostet haben, verluste.energie
  // bleibt dort 0, weil die Energie nicht sinkt (game.js damage).
  // fehler: Text, wenn die Spielerposition ungueltig wurde (NaN/unendlich), dann won = false.
  function solve(level, gameOpts, maxFrames, botOpts) {
    maxFrames = maxFrames || 60 * 180;
    botOpts = botOpts || {};
    if (botOpts.unsterblich) gameOpts = Object.assign({}, gameOpts, { unsterblich: true });
    var game = G.createGame(level, gameOpts);
    var st = { jumpUntil: -1, steerUntil: -1, steer: 1, safeUntil: -1 };
    var schaden = {}, verluste = {};
    var maxX = game.player.x, fortschritt = 0; // letzter Schritt mit neuem x-Maximum
    function ergebnis(won, f, extra) {
      var r = { won: won, softlock: false, frames: f, game: game, schaden: schaden, verluste: verluste };
      return extra ? Object.assign(r, extra) : r;
    }
    for (var f = 0; f < maxFrames; f++) {
      stepBot(game, level, st, f, choose(game, level, st, f));
      for (var i = 0; i < game.events.length; i++) {
        var ev = game.events[i];
        if (ev.type === 'schaden') schaden[ev.quelle] = (schaden[ev.quelle] || 0) + 1;
        else if (ev.type === 'leben') verluste[ev.grund] = (verluste[ev.grund] || 0) + 1;
      }
      var p = game.player;
      if (!isFinite(p.x) || !isFinite(p.y)) return ergebnis(false, f + 1, { fehler: 'ungueltige Spielerposition in Schritt ' + (f + 1) + ': x=' + p.x + ', y=' + p.y });
      if (game.status === 'won') return ergebnis(true, f + 1);
      if (game.status === 'lost') return ergebnis(false, f + 1);
      if (p.x > maxX) { maxX = p.x; fortschritt = f; }
      else if (f - fortschritt >= SOFTLOCK) return ergebnis(false, f + 1, { softlock: true });
    }
    return ergebnis(false, maxFrames);
  }

  // Vermessene Reichweite des Bot-Sprungs (HOLD Schritte gehalten, Absprung per Reflex an der Kante
  // bzw. vor der Wand) in ganzen Kacheln: die breiteste Luecke und die hoechste Stufe, die er auf einem
  // sonst flachen Level schafft. Kommt aus der Physik (core/physics.js) per Simulation, nicht geraten;
  // der Wert wird einmal gemessen und dann gecacht. Die Geometrie-Tests pruefen Level dagegen.
  var mass = null;
  function sprungmass() {
    if (mass) return mass;
    function level(rows) {
      var h = rows.length, w = rows[0].length, solid = new Uint8Array(w * h), start = null, goal = null;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var c = rows[y][x];
        if (c === '#') solid[y * w + x] = 1;
        else if (c === 'S') start = { tx: x, ty: y, x: x * T + (T - P.W) / 2, y: (y + 1) * T - P.H };
        else if (c === 'G') goal = { tx: x, ty: y };
      }
      return { w: w, h: h, solid: solid, start: start, goal: goal, checkpoints: [], crystalSlots: [], spikes: [], springs: [], enemies: [] };
    }
    function rep(c, n) { return new Array(n + 1).join(c); }
    function luecke(n) { // Boden, n Kacheln Abgrund, Boden
      var rows = [rep('.', 20 + n), 'S' + rep('.', 18 + n) + 'G', rep('#', 6) + rep('.', n) + rep('#', 14)];
      return solve(level(rows), { mode: 'aus' }, 900).won;
    }
    function stufe(h) { // Boden, ab Spalte 10 eine h Kacheln hohe Stufe mit dem Ziel oben
      var rows = [], w = 24;
      for (var y = 0; y < h + 3; y++) rows.push(y >= 2 && y < h + 2 ? rep('.', 10) + rep('#', 14) : rep('.', w));
      rows[h + 2] = rep('#', w);
      rows[h + 1] = 'S' + rows[h + 1].slice(1);
      rows[1] = rows[1].slice(0, w - 1) + 'G';
      return solve(level(rows), { mode: 'aus' }, 900).won;
    }
    var l = 0, s = 0;
    while (l < 12 && luecke(l + 1)) l++;
    while (s < 12 && stufe(s + 1)) s++;
    mass = { luecke: l, stufe: s };
    return mass;
  }

  return { solve: solve, sprungmass: sprungmass, HOLD: HOLD, SOFTLOCK: SOFTLOCK };
});
