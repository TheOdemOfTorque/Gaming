#!/usr/bin/env node
// Lumo - Messwerte des Greedy-Bots (core/solver.js). Kein Pass-Kriterium: die Zahlen sagen nur, wie
// schwer eine Stufe fuer den Bot war (Aufgabe 10, Marco 29.10.). Level-Inhalte werden wegen dieser
// Zahlen nie geaendert. Dieselben Helfer nutzt tests/unit/jnr-levels.test.js fuer seine
// console.log-Zusammenfassung je Stufe.
//
// Aufruf: node scripts/jnr-messen.js [levelId] [seeds] [reihen]
//   levelId  Stufe aus jumpnrun/data/levels.js (Standard 1-2) oder d1 fuer den reinen
//            Schwierigkeit-1-Pool (Zahlen aus, Parameter der frueheren Stufe 1-1)
//   seeds    Anzahl Seeds ab 1 (Standard 200)
//   reihen   Komma-Liste der Reihen 2..10, je Reihe eine Tabellenzeile (Standard: Vorschlag der Stufe)
// Je Seed laufen zwei Bots: mit 3 Leben (Messwerte) und unsterblich (Erreichbarkeit, Softlock, Anteil
// der eingesammelten guten Kristalle).
var path = require('path');
var ROOT = path.join(__dirname, '..');
var SOLVER = require(path.join(ROOT, 'jumpnrun/core/solver.js'));

// Ein Messwert je Seed aus dem 3-Leben-Lauf (mit) und dem unsterblichen Lauf (frei).
function messwert(mit, frei) {
  var v = mit.verluste || {}, s = mit.schaden || {};
  var g = frei.game;
  return {
    geschafft: !!mit.won, frames: mit.frames,
    abgrund: v.abgrund || 0, energie: v.energie || 0,
    kristall: s.kristall || 0, stacheln: s.stacheln || 0, gegner: s.gegner || 0,
    softlock: !!frei.softlock, erreicht: !!frei.won,
    kristalle: g.totalGood ? g.richtig / g.totalGood : 1
  };
}

function mittel(liste, feld) {
  if (!liste.length) return 0;
  return liste.reduce(function (a, m) { return a + m[feld]; }, 0) / liste.length;
}

// Zusammenfassung einer Liste von Messwerten. Dauer in Sekunden bei 60 Schritten je Sekunde, nur
// ueber geschaffte Laeufe; p90 = 90. Perzentil.
function zusammenfassung(liste) {
  var fertig = liste.filter(function (m) { return m.geschafft; });
  var dauern = fertig.map(function (m) { return m.frames / 60; }).sort(function (a, b) { return a - b; });
  return {
    n: liste.length,
    nichtGeschafft: liste.length ? 1 - fertig.length / liste.length : 0,
    leben: mittel(liste, 'abgrund') + mittel(liste, 'energie'),
    abgrund: mittel(liste, 'abgrund'), energie: mittel(liste, 'energie'),
    kristall: mittel(liste, 'kristall'), stacheln: mittel(liste, 'stacheln'), gegner: mittel(liste, 'gegner'),
    dauer: dauern.length ? dauern.reduce(function (a, b) { return a + b; }, 0) / dauern.length : 0,
    dauerP90: dauern.length ? dauern[Math.floor(0.9 * (dauern.length - 1))] : 0,
    softlocks: liste.filter(function (m) { return m.softlock; }).length,
    nichtErreicht: liste.filter(function (m) { return !m.erreicht; }).length,
    kristalle: mittel(liste, 'kristalle')
  };
}

function f2(x) { return x.toFixed(2); }
function pct(x) { return (100 * x).toFixed(1) + ' %'; }

// Eine Zeile fuer console.log, z. B. in Jest.
function zeile(name, z) {
  return 'Messwert Bot 3 Leben, ' + name + ', ' + z.n + ' Seeds: nicht geschafft ' + pct(z.nichtGeschafft) +
    ' | Leben verloren Ø ' + f2(z.leben) + ' (Abgrund ' + f2(z.abgrund) + ', Energie ' + f2(z.energie) + ')' +
    ' | Schaden Ø Kristall ' + f2(z.kristall) + ', Stacheln ' + f2(z.stacheln) + ', Gegner ' + f2(z.gegner) +
    ' | Dauer Ø ' + z.dauer.toFixed(1) + ' s, p90 ' + z.dauerP90.toFixed(1) + ' s' +
    ' | unsterblich: Softlock ' + z.softlocks + ', nicht erreicht ' + z.nichtErreicht + ', gute Kristalle ' + pct(z.kristalle);
}

var SPALTEN = [
  ['Reihe', function (r) { return r.name; }],
  ['Seeds', function (r) { return String(r.z.n); }],
  ['nicht geschafft', function (r) { return pct(r.z.nichtGeschafft); }],
  ['Leben Ø', function (r) { return f2(r.z.leben); }],
  ['Abgrund Ø', function (r) { return f2(r.z.abgrund); }],
  ['Energie Ø', function (r) { return f2(r.z.energie); }],
  ['Kristall Ø', function (r) { return f2(r.z.kristall); }],
  ['Stacheln Ø', function (r) { return f2(r.z.stacheln); }],
  ['Gegner Ø', function (r) { return f2(r.z.gegner); }],
  ['Dauer Ø s', function (r) { return r.z.dauer.toFixed(1); }],
  ['p90 s', function (r) { return r.z.dauerP90.toFixed(1); }],
  ['Softlock', function (r) { return String(r.z.softlocks); }],
  ['nicht erreicht', function (r) { return String(r.z.nichtErreicht); }],
  ['gute Kristalle', function (r) { return pct(r.z.kristalle); }]
];

// Tabelle aus Zeilen { name, z }: Kopf, Trennlinie, eine Zeile je Eintrag, Spalten buendig.
function tabelle(zeilen) {
  var werte = zeilen.map(function (r) { return SPALTEN.map(function (sp) { return sp[1](r); }); });
  var breiten = SPALTEN.map(function (sp, i) {
    return Math.max(sp[0].length, Math.max.apply(null, werte.map(function (w) { return w[i].length; }).concat([0])));
  });
  function pad(s, i) { return i === 0 ? s + ' '.repeat(breiten[i] - s.length) : ' '.repeat(breiten[i] - s.length) + s; }
  var out = [SPALTEN.map(function (sp, i) { return pad(sp[0], i); }).join(' | ')];
  out.push(breiten.map(function (b) { return '-'.repeat(b); }).join('-+-'));
  werte.forEach(function (w) { out.push(w.map(pad).join(' | ')); });
  return out.join('\n');
}

// Misst eine Stufe (oder den d1-Pool) ueber seeds Seeds in einer Reihe. Gibt die Zusammenfassung zurueck.
function messen(levelId, seeds, reihe) {
  var LV = require(path.join(ROOT, 'jumpnrun/core/level.js'));
  var D = require(path.join(ROOT, 'jumpnrun/data/levels.js'));
  var LG = require(path.join(ROOT, 'jumpnrun/core/levelgen.js'));
  var R = require(path.join(ROOT, 'jumpnrun/core/rewards.js'));
  var options = R.defaultJnr().options, liste = [];
  for (var seed = 1; seed <= seeds; seed++) {
    var gen, opts;
    if (levelId === 'd1') {
      gen = LG.generate({ minDifficulty: 1, maxDifficulty: 1, minSections: 14, maxSections: 18 }, seed);
      opts = { mode: 'aus' };
    } else {
      gen = D.generateFor(levelId, seed);
      opts = D.gameOptions(D.byId(levelId), options, seed, reihe);
    }
    var level = LV.parseLevel(gen.rows);
    liste.push(messwert(SOLVER.solve(level, opts), SOLVER.solve(level, opts, undefined, { unsterblich: true })));
  }
  return zusammenfassung(liste);
}

function main(argv) {
  var levelId = argv[0] || '1-2';
  var seeds = parseInt(argv[1] || '200', 10);
  var D = require(path.join(ROOT, 'jumpnrun/data/levels.js'));
  var meta = levelId === 'd1' ? null : D.byId(levelId);
  if (levelId !== 'd1' && !meta) { console.error('Unbekannte Stufe: ' + levelId + ' (bekannt: ' + D.ORDER.join(', ') + ', d1)'); process.exit(1); }
  var reihen = argv[2] ? argv[2].split(',').map(function (s) { return parseInt(s, 10); }) : [meta ? meta.reihe : null];
  var mass = SOLVER.sprungmass();
  console.log('Lumo Bot-Messung: ' + (meta ? 'Stufe ' + levelId + ' ' + meta.name : 'Schwierigkeit-1-Pool (Zahlen aus)') +
    ', ' + seeds + ' Seeds, Sprungweite ' + mass.luecke + ' / Sprunghoehe ' + mass.stufe + ' Kacheln, Softlock ab ' + SOLVER.SOFTLOCK + ' Schritten');
  var zeilen = [], t0 = Date.now();
  reihen.forEach(function (reihe) {
    zeilen.push({ name: reihe == null ? 'aus' : String(reihe), z: messen(levelId, seeds, reihe) });
  });
  console.log(tabelle(zeilen));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s, Dauer = Spielzeit des 3-Leben-Bots bei 60 Schritten je Sekunde, nur geschaffte Laeufe)');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { messwert: messwert, zusammenfassung: zusammenfassung, zeile: zeile, tabelle: tabelle, messen: messen };
