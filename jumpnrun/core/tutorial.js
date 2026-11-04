// Lumo - Mitmach-Tutorial: ein kleines, handgebautes Uebungslevel (kein Zufall) und ein
// Zustandsautomat, der Schritt fuer Schritt fuehrt und erst weitergeht, wenn das Kind die Aktion
// gemacht hat: laufen, ueber eine Luecke springen, die richtige Zahl sammeln und eine falsche
// meiden, auf einen Rechenwicht springen, zum Leuchtturm laufen.
//
// Das Tutorial laeuft mit game.createGame(level, gameOptions(reihe)) im Uebungsmodus (uebung: true):
// keine Leben weg, die Schlucht setzt zurueck. index.html ruft nach jedem game.tick tick(tut, game)
// auf. Eine unsichtbare Grenze (grenzeX) haelt Lumo im Bereich des aktuellen Schritts. Am Ende
// gibt es kein jnr:result und keine XP; index.html meldet nur jnr:tutorial (Vertrag core/host.js).
// Reine Funktionen bis auf tick, das wie game.tick den Spielzustand anfasst.
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { physics: require('./physics.js'), mathgen: require('./mathgen.js'), game: require('./game.js') }
    : { physics: root.JNR.physics, mathgen: root.JNR.mathgen, game: root.JNR.game };
  var api = factory(deps.physics, deps.mathgen, deps.game);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.tutorial = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P, M, GM) {
  var T = 16;
  var SEED = 7; // fester Seed: der Wicht traegt immer dieselbe Rechnung (je Reihe)

  // Spalten:  S=1  Luecke 17-18  richtige Zahl 25  falsche Zahl 28  Laterne 32  Wicht 42 (Strecke 36-49)  Ziel 53
  // Das Ziel steht in der letzten Spalte: Lumo kann nicht darueber hinausspringen.
  // Der lange Anlauf vor der Luecke laesst bei der Einfach-Steuerung (Lumo laeuft von selbst) Zeit zum Lesen.
  var LEVEL = [
    '......................................................',
    '......................................................',
    '......................................................',
    '......................................................',
    '......................................................',
    '......................................................',
    '.S.......................o..o...C.........w..........G',
    '#################..###################################',
    '#################..###################################'
  ];
  var LUECKE = { von: 17, bis: 18 };
  var RICHTIG_TX = 25, FALSCH_TX = 28, KRISTALL_TY = 6;
  // Lumo kommt nicht weiter, bis der Schritt geschafft ist. Die Wicht-Grenze liegt genau am Ende seiner
  // Strecke (49 + 1), damit er Lumo dort immer erreichen kann.
  var GRENZE_TX = { zahlen: 34, wicht: 50 };
  // Wo Lumo landet, wenn er das Ziel des Schritts an der Grenze schon hinter sich hat (Einfach-Steuerung
  // kann nicht zurueck): vor der richtigen Zahl bzw. vor der Strecke des Wichts.
  var NOCHMAL_TX = { zahlen: LUECKE.bis + 2, wicht: 33 };
  var LAUFEN_MIN_EINFACH = 90; // Schritte (1,5 s), die "laufen" bei Einfach-Steuerung mindestens dauert
  var SCHRITTE = ['laufen', 'springen', 'zahlen', 'wicht', 'ziel'];

  function reiheOk(r) { return Number.isInteger(r) && r >= 2 && r <= 10 ? r : 2; }

  // Zuerst die richtige Zahl (3 mal die Reihe), danach eine falsche (eins mehr), beide auf dem Boden.
  function kristalle(reihe) {
    var r = reiheOk(reihe);
    return [
      { tx: RICHTIG_TX, ty: KRISTALL_TY, value: 3 * r, good: true },
      { tx: FALSCH_TX, ty: KRISTALL_TY, value: 3 * r + 1, good: false }
    ];
  }

  function gameOptions(reihe) {
    var r = reiheOk(reihe);
    return { mode: 'ziel', reihe: r, seed: SEED, crystals: kristalle(r), uebung: true };
  }

  // opts: { einfach } (Lumo laeuft von selbst)
  function create(opts) {
    return { index: 0, hinweis: null, lob: false, rechnung: null, fertig: false, einfach: !!(opts && opts.einfach), t: 0 };
  }
  function schritt(tut) { return SCHRITTE[Math.min(tut.index, SCHRITTE.length - 1)]; }
  function fortschritt(tut) { return 'Schritt ' + (Math.min(tut.index, SCHRITTE.length - 1) + 1) + ' von ' + SCHRITTE.length; }

  // Rechter Rand (px), den Lumos Hitbox im aktuellen Schritt nicht ueberschreiten darf.
  function grenzeX(tut) {
    var id = schritt(tut);
    if (id === 'ziel') return Infinity;
    return (id === 'wicht' ? GRENZE_TX.wicht : GRENZE_TX.zahlen) * T;
  }

  function geschafft(id, g, tut) {
    var p = g.player;
    if (id === 'laufen') return p.x >= g.level.start.x + 3 * T && (!tut.einfach || tut.t >= LAUFEN_MIN_EINFACH);
    if (id === 'springen') return p.onGround && p.x >= (LUECKE.bis + 1) * T;
    if (id === 'zahlen') return g.richtig >= 1 && p.x >= (FALSCH_TX + 1) * T;
    if (id === 'wicht') return tut.rechnung !== null;
    if (id === 'ziel') return g.status === 'won';
    return false;
  }

  // Liegt das, was in diesem Schritt zu tun ist, schon links von Lumo (drueber gesprungen)?
  function zielHinterLumo(id, g) {
    var p = g.player;
    if (id === 'zahlen') { var c = g.crystals[0]; return !!c && c.state === 'da' && p.x > c.tx * T + T; }
    if (id === 'wicht') { var e = g.enemies[0]; return !!e && e.state === 'da' && p.x > e.x + 12; }
    return false;
  }

  // Nach game.tick aufrufen. Wertet die Ereignisse aus, schaltet weiter, haelt Lumo an der Grenze.
  // Gibt true zurueck, wenn sich Schritt, Hinweis oder fertig geaendert haben (Text neu anzeigen).
  function tick(tut, g) {
    if (tut.fertig) return false;
    tut.t = (tut.t || 0) + 1;
    var vorher = tut.index + '|' + tut.hinweis + '|' + tut.lob;
    var id = schritt(tut);
    for (var i = 0; i < g.events.length; i++) {
      var e = g.events[i];
      if (e.type === 'zurueck' && e.grund === 'abgrund') tut.hinweis = 'schlucht';
      else if (e.type === 'schaden' && e.quelle === 'kristall') tut.hinweis = 'autsch';
      else if (e.type === 'schaden' && e.quelle === 'gegner') tut.hinweis = 'seite';
      else if (e.type === 'stampf' && id === 'wicht') tut.rechnung = M.rechnungText(e.rechnung, true);
    }
    if (geschafft(id, g, tut)) {
      if (id === 'ziel') { tut.fertig = true; return true; }
      tut.index++; tut.hinweis = null; tut.lob = true; tut.t = 0;
      g.energie = GM.ENERGIE; // jeder Schritt beginnt mit voller Energie
      return true;
    }
    var gx = grenzeX(tut), p = g.player;
    if (p.x + P.W > gx) {
      if (zielHinterLumo(id, g)) {
        p.x = NOCHMAL_TX[id] * T + (T - P.W) / 2; p.vx = 0; p.vy = 0;
        g.unverwundbar = GM.INVULN;
        tut.hinweis = 'nochmal';
      } else {
        p.x = gx - P.W; if (p.vx > 0) p.vx = 0;
        tut.hinweis = 'grenze';
      }
    }
    return vorher !== tut.index + '|' + tut.hinweis + '|' + tut.lob;
  }

  // Wohin ein kleiner Pfeil ueber der Welt zeigt (Weltkoordinaten in px, Spitze unten), oder null.
  function zeiger(tut, g) {
    var id = schritt(tut);
    if (tut.fertig || id === 'laufen') return null;
    if (id === 'springen') return { x: ((LUECKE.von + LUECKE.bis + 1) / 2) * T, y: KRISTALL_TY * T };
    if (id === 'zahlen') {
      var c = g.crystals[0];
      return c && c.state === 'da' ? { x: c.tx * T + 8, y: c.ty * T - 2 } : null;
    }
    if (id === 'wicht') {
      var e = g.enemies[0];
      return e && e.state === 'da' ? { x: e.x + 6, y: e.y - 12 } : null;
    }
    return { x: g.level.goal.tx * T + 8, y: (g.level.goal.ty - 1) * T - 2 };
  }

  // ctx: { geraet: 'touch' | 'tasten', einfach: bool (Lumo laeuft von selbst), reihe }
  function schrittText(id, ctx, r) {
    var touch = ctx.geraet === 'touch', k = kristalle(r);
    if (id === 'laufen') {
      if (ctx.einfach) return 'Lumo läuft von selbst nach rechts. ' + (touch ? 'Halte unten links „Halt“ gedrückt' : 'Halte die Pfeiltaste ←') + ', dann bleibt er stehen.';
      return 'Lauf los! ' + (touch ? 'Halte unten links den Knopf ▶ gedrückt' : 'Halte die Pfeiltaste → (oder D) gedrückt') + ', dann läuft Lumo nach rechts.';
    }
    if (id === 'springen') {
      return 'Da ist eine Lücke! ' + (touch ? 'Tipp unten rechts auf ▲' : 'Drück die Leertaste (oder ↑)') + ', dann springt Lumo drüber. Lange drücken springt höher.';
    }
    if (id === 'zahlen') {
      return 'Sammle die ' + r + 'er-Reihe: Die ' + k[0].value + ' gehört dazu, hol sie dir! Die ' + k[1].value + ' gehört nicht dazu. Spring drüber.';
    }
    if (id === 'wicht') return 'Ein Rechenwicht! Auf seiner Tafel steht eine falsche Rechnung. Spring von oben auf ihn drauf.';
    return 'Die Laterne leuchtet: Dort startest du neu, wenn etwas schiefgeht. Lauf jetzt zum Leuchtturm!';
  }

  function hinweisText(tut, r) {
    var h = tut.hinweis, id = schritt(tut);
    if (h === 'schlucht') return 'Hoppla, in die Schlucht! Im Spiel kostet das ein Leben ♥, hier im Training nicht.';
    if (h === 'autsch') return 'Autsch! Eine falsche Zahl kostet einen Lichtpunkt ● und schubst Lumo zurück. Hier im Training verlierst du kein Leben.';
    if (h === 'nochmal') return id === 'zahlen' ? 'Nochmal! Die ' + kristalle(r)[0].value + ' liegt noch da.' : 'Nochmal! Der Wicht wartet noch auf dich.';
    if (h === 'seite') return 'Autsch! Von der Seite kostet der Wicht einen Lichtpunkt ●.';
    if (h === 'grenze') return id === 'zahlen' ? 'Hol dir zuerst die ' + kristalle(r)[0].value + '!' : 'Lauf zurück zum Wicht!';
    return '';
  }

  function text(tut, ctx) {
    ctx = ctx || {};
    var r = reiheOk(ctx.reihe);
    if (tut.fertig) return 'Geschafft! Der Leuchtturm leuchtet. Jetzt kennst du alles, was du zum Spielen brauchst.';
    var id = schritt(tut), teile = [];
    var h = hinweisText(tut, r);
    if (h) teile.push(h);
    else if (tut.lob) teile.push(id === 'ziel' && tut.rechnung ? 'Super! Die Tafel zeigt jetzt die richtige Rechnung: ' + tut.rechnung + '.' : 'Super!');
    teile.push(schrittText(id, ctx, r));
    return teile.join(' ');
  }

  // jnr: Fortschritt (rewards.sanitizeJnr), sitzung: in dieser Browser-Sitzung schon gesehen (Fallback)
  function sollAutomatischStarten(jnr, sitzung) {
    return !(jnr && jnr.tutorialGesehen === true) && !sitzung;
  }

  return {
    LEVEL: LEVEL, LUECKE: LUECKE, SEED: SEED, SCHRITTE: SCHRITTE,
    kristalle: kristalle, gameOptions: gameOptions, create: create, schritt: schritt, fortschritt: fortschritt,
    grenzeX: grenzeX, tick: tick, zeiger: zeiger, text: text, sollAutomatischStarten: sollAutomatischStarten
  };
});
