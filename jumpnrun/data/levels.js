// Lumo - Level-Tabelle (Welt 1 "Daemmerwiese", Welt 2 "Sternenhuegel"): Metadaten je Level, die ASCII-Zeilen kommen
// jetzt bei jedem Spielstart frisch aus core/levelgen.js (Abschnitts-Bibliothek, siehe
// data/sections.js und ADR-0002 im Vault). Das ersetzt die frueher fest verdrahteten Level,
// die sich nach 3-5 Durchlaeufen immer gleich angefuehlt haben.
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { levelgen: require('../core/levelgen.js') }
    : { levelgen: root.JNR.levelgen };
  var api = factory(deps.levelgen);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.JNR = root.JNR || {}; root.JNR.levels = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (LG) {
  // Die fruehere Stufe '1-1' "Erste Schritte" (nur Laufen/Springen/Sammeln) ist gestrichen, den Einstieg
  // uebernimmt das Mitmach-Tutorial (core/tutorial.js). Die IDs bleiben, wie sie sind: '1-2' steht in
  // Spielstaenden, XP-Schluesseln und Debug-Parametern. Alte '1-1'-Eintraege im Spielstand bleiben
  // erhalten, werden aber nirgends angezeigt (Menue und Freischaltung laufen ueber STAGES/ORDER).
  // Plan "Lumo zwei neue Stufen" (Vault, Marco 28.10.): 1-3 bringt die Kombi-Abschnitte (Schwierigkeit 3)
  // und die Wicht-Abschnitte in den Pool, 2-1 eroeffnet Welt 2 ohne leichte Mittelabschnitte, mit Wichten
  // alle 1 bis 2 Abschnitte und mindestens 4 je Lauf (core/levelgen.js gegnerAbstand, minGegner).
  // Freischaltung: Level n+1 nach einer Medaille in Level n (core/rewards.js isUnlocked ueber ORDER).
  var STAGES = [
    {
      id: '1-2', name: 'Zahlenwiese', welt: 1, weltName: 'Dämmerwiese',
      mathe: true, reihe: 2, // Federpilz, Dornen, Rechenwichte; reihe = Vorschlag, das Kind waehlt vor dem Start
      gen: { minDifficulty: 1, maxDifficulty: 2, minSections: 16, maxSections: 18, gegner: true }
    },
    {
      id: '1-3', name: 'Glühwürmchenpfad', welt: 1, weltName: 'Dämmerwiese',
      mathe: true, reihe: 2, // dazu Kombi-Abschnitte (Luecke + Dornen + Federpilz), Wichte wie in 1-2
      gen: { minDifficulty: 1, maxDifficulty: 3, minSections: 16, maxSections: 18, gegner: true }
    },
    {
      id: '2-1', name: 'Wichtelhügel', welt: 2, weltName: 'Sternenhügel',
      mathe: true, reihe: 2, // keine leichten Mittelabschnitte, Wichte dichter und mindestens 4 je Lauf
      gen: { minDifficulty: 2, maxDifficulty: 3, minSections: 17, maxSections: 19, gegner: true, gegnerAbstand: [1, 1], minGegner: 4 }
    }
  ];

  var ORDER = STAGES.map(function (l) { return l.id; });
  function byId(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return STAGES[i];
    return null;
  }

  // Welten fuer die Levelauswahl: [{ welt, name, levels: [id, ...] }] in Reihenfolge von ORDER.
  function welten() {
    var out = [];
    STAGES.forEach(function (l) {
      var w = out[out.length - 1];
      if (!w || w.welt !== l.welt) { w = { welt: l.welt, name: l.weltName, levels: [] }; out.push(w); }
      w.levels.push(l.id);
    });
    return out;
  }

  // Erzeugt die ASCII-Zeilen fuer einen Lauf dieser Stufe. Gleicher seed -> exakt dasselbe Level.
  function generateFor(id, seed) {
    var meta = byId(id);
    if (!meta) throw new Error('Unbekannte Stufe: ' + id);
    return LG.generate(meta.gen, seed);
  }

  function istWaehlbareReihe(n) { return typeof n === 'number' && Number.isInteger(n) && n >= 2 && n <= 10; }

  // Optionen des Spiels (rewards.defaultJnr().options) und Stufen-Metadaten -> Optionen für game.createGame.
  // reihe (optional): auf dem Auswahlbildschirm gewaehlte Reihe 2..10, sonst gilt meta.reihe.
  function gameOptions(meta, options, seed, reihe) {
    var aus = !meta.mathe || (options && options.mathe === 'aus');
    return { mode: aus ? 'aus' : 'ziel', reihe: istWaehlbareReihe(reihe) ? reihe : meta.reihe, seed: seed };
  }

  // Vor einer Stufe kommt der Reihen-Auswahlbildschirm nur, wenn sie Zahlen-Kristalle hat.
  function brauchtReihenwahl(meta, options) {
    return !!meta.mathe && !(options && options.mathe === 'aus');
  }

  // Untertitel eines Level-Knopfs in der Levelauswahl. Die Reihe waehlt das Kind erst auf dem
  // Auswahlbildschirm, meta.reihe ist nur noch der Vorschlag, deshalb nennt der Knopf keine.
  function menuUntertitel(meta, options) {
    return brauchtReihenwahl(meta, options) ? 'Reihe wählst du vor dem Start' : 'Laufen, Springen, Sammeln';
  }

  return { STAGES: STAGES, ORDER: ORDER, byId: byId, welten: welten, generateFor: generateFor, gameOptions: gameOptions,
    brauchtReihenwahl: brauchtReihenwahl, menuUntertitel: menuUntertitel };
});
