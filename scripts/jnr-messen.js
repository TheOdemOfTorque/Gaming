#!/usr/bin/env node
// Lumo - Messwerte des Greedy-Bots (core/solver.js). Kein Pass-Kriterium: die Zahlen sagen nur, wie
// schwer eine Stufe fuer den Bot war (Aufgabe 10, Marco 29.10.). Level-Inhalte werden wegen dieser
// Zahlen nie geaendert. Der Bot mit 3 Leben laeuft nur hier, nicht mehr in Jest (Review n5, H4);
// die Spielbarkeits-Tests (tests/unit/jnr-spielbarkeit-<id>.test.js) lassen nur den unsterblichen Bot laufen.
//
// Aufruf: node scripts/jnr-messen.js [levelIds] [seeds] [reihen]
//   levelIds Komma-Liste von Leveln aus jumpnrun/data/levels.js (Standard 1-2) oder d1 fuer den reinen
//            Schwierigkeit-1-Pool (Zahlen aus, Parameter der frueheren Stufe 1-1)
//   seeds    Anzahl Seeds ab 1 (Standard 200)
//   reihen   Komma-Liste der Reihen 2..10, je Reihe eine Tabellenzeile (Standard: Vorschlag des Levels)
// Je Level zuerst die Struktur (reihenunabhaengig: Laenge, Wichte, Dornen, Federpilze, Luecken,
// Geometrie-Verstoesse, Neuwuerfe durch minGegner), dann je Reihe die Bot-Zeile. Je Seed laufen zwei
// Bots: mit 3 Leben (Messwerte) und unsterblich (Erreichbarkeit, Softlock, Anteil der eingesammelten
// guten Kristalle).
var path = require('path');
var ROOT = path.join(__dirname, '..');
var SOLVER = require(path.join(ROOT, 'jumpnrun/core/solver.js'));
var LV = require(path.join(ROOT, 'jumpnrun/core/level.js'));

// ---- Struktur je Seed (ohne Bot): was im Raster steht ----
// verstoesse: Luecken breiter als die Sprungweite, Stufen hoeher als die Sprunghoehe, Kristalle hoeher
// als die Sprunghoehe ueber dem Boden, Start nicht frei (core/level.js geometrie gegen solver.sprungmass).
function strukturWert(gen, level) {
  var g = LV.geometrie(level), mass = SOLVER.sprungmass(), v = 0;
  g.luecken.forEach(function (b) { if (b > mass.luecke) v++; });
  g.stufen.forEach(function (h) { if (h > mass.stufe) v++; });
  g.kristallHoehen.forEach(function (h) { if (!(h <= mass.stufe)) v++; });
  if (!g.startFrei) v++;
  return {
    laenge: level.w, wichte: gen.gegner.length, dornen: level.spikes.length, federpilze: level.springs.length,
    luecken: g.luecken.length, verstoesse: v, versuch: gen.versuch || 0
  };
}

function struktur(levelId, seeds) {
  var D = require(path.join(ROOT, 'jumpnrun/data/levels.js')), liste = [];
  for (var seed = 1; seed <= seeds; seed++) {
    var gen = D.generateFor(levelId, seed);
    liste.push(strukturWert(gen, LV.parseLevel(gen.rows)));
  }
  return liste;
}

function spanne(liste, feld) {
  var w = liste.map(function (m) { return m[feld]; });
  return { mittel: mittel(liste, feld), min: Math.min.apply(null, w), max: Math.max.apply(null, w) };
}

function strukturZusammenfassung(liste) {
  return {
    n: liste.length,
    laenge: spanne(liste, 'laenge'), wichte: spanne(liste, 'wichte'), dornen: spanne(liste, 'dornen'),
    federpilze: spanne(liste, 'federpilze'), luecken: spanne(liste, 'luecken'),
    verstoesse: liste.reduce(function (a, m) { return a + m.verstoesse; }, 0),
    neuGewuerfelt: liste.filter(function (m) { return m.versuch > 0; }).length
  };
}

function sp(s) { return s.mittel.toFixed(1) + ' (' + s.min + '-' + s.max + ')'; }
function strukturZeile(name, z) {
  return 'Struktur ' + name + ', ' + z.n + ' Seeds: Laenge Ø ' + sp(z.laenge) + ' Kacheln | Wichte Ø ' + sp(z.wichte) +
    ' | Dornen Ø ' + sp(z.dornen) + ' | Federpilze Ø ' + sp(z.federpilze) + ' | Luecken Ø ' + sp(z.luecken) +
    ' | Geometrie-Verstoesse ' + z.verstoesse + ' | neu gewuerfelt (minGegner) ' + z.neuGewuerfelt;
}

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
  var levelIds = (argv[0] || '1-2').split(',');
  var seeds = parseInt(argv[1] || '200', 10);
  var D = require(path.join(ROOT, 'jumpnrun/data/levels.js'));
  var mass = SOLVER.sprungmass();
  levelIds.forEach(function (levelId) {
    var meta = levelId === 'd1' ? null : D.byId(levelId);
    if (levelId !== 'd1' && !meta) { console.error('Unbekanntes Level: ' + levelId + ' (bekannt: ' + D.ORDER.join(', ') + ', d1)'); process.exit(1); }
    var reihen = argv[2] ? argv[2].split(',').map(function (s) { return parseInt(s, 10); }) : [meta ? meta.reihe : null];
    console.log('Lumo Bot-Messung: ' + (meta ? 'Level ' + levelId + ' ' + meta.name : 'Schwierigkeit-1-Pool (Zahlen aus)') +
      ', ' + seeds + ' Seeds, Sprungweite ' + mass.luecke + ' / Sprunghoehe ' + mass.stufe + ' Kacheln, Softlock ab ' + SOLVER.SOFTLOCK + ' Schritten');
    if (meta) console.log(strukturZeile('Level ' + levelId, strukturZusammenfassung(struktur(levelId, seeds))));
    var zeilen = [], t0 = Date.now();
    reihen.forEach(function (reihe) {
      zeilen.push({ name: reihe == null ? 'aus' : String(reihe), z: messen(levelId, seeds, reihe) });
    });
    console.log(tabelle(zeilen));
    console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s, Dauer = Spielzeit des 3-Leben-Bots bei 60 Schritten je Sekunde, nur geschaffte Laeufe)');
    console.log('');
  });
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { messwert: messwert, zusammenfassung: zusammenfassung, zeile: zeile, tabelle: tabelle, messen: messen,
  strukturWert: strukturWert, struktur: struktur, strukturZusammenfassung: strukturZusammenfassung, strukturZeile: strukturZeile };
