// Lumo - gemeinsamer Helfer fuer die Spielbarkeits-Tests je Level (jnr-spielbarkeit-<id>.test.js).
// Eine Datei je Level, damit Jest die Level parallel prueft (Review n5, H4, Marco 30.10.).
//
// Pass-Kriterien je Seed (Aufgabe 10, Marco 29.10.): (1) der unsterbliche Bot erreicht das Ziel, ohne
// Softlock, ohne Ausnahme, ohne ungueltige Position (NaN); (2) statische Geometrie in Sprungreichweite
// (core/level.js geometrie gegen solver.sprungmass, per Simulation aus core/physics.js vermessen:
// 3 Kacheln Luecke, 3 Kacheln Stufe); (3) Kristalle erreichbar, definiert als: in der Spalte des
// Kristalls liegt fester Boden und der Kristall schwebt hoechstens Sprunghoehe darueber; (4) Wichte nur
// in Mittelabschnitten ab Index 2, nie im Start-, ersten Mittel- oder Zielabschnitt, hoechstens einer je
// Abschnitt, 'w' im Raster passt zu gen.gegner; (5) Start frei (nicht in Wand, Dornen, Federpilz oder
// auf einer Wicht-Strecke).
//
// Der Bot mit 3 Leben ist nur Messwert (Leben, Energie, Schaden, Dauer, scripts/jnr-messen.js). In Jest
// laeuft er nur als Absturztest (absturztest, jnr-absturz.test.js): keine Ausnahme, keine ungueltigen
// Werte, jeder Lauf endet. Ob er gewinnt oder Leben verliert, ist nie ein Pass-Kriterium; Level-Inhalte
// werden deswegen nie geaendert.
//
// Schon erzwungen und hier nicht doppelt geprueft: parseLevel wirft bei fehlendem/mehrfachem S oder
// G, fehlendem Boden unter S/G/C/^/~, Checkpoint ausserhalb Start..Ziel, Wicht ohne flache Strecke
// mit 2 Kacheln Kopffreiheit, ohne Kristallplatz auf der Strecke und ohne Abstand zu Start, Ziel und
// Laternen (ABSTAND_LATERNE), Strecke kuerzer als MIN_STRECKE. jnr-sections.test.js prueft je
// Abschnitt 2 flache Kacheln an beiden Enden (anschlussfaehig) und dieselbe Geometrie wie hier.
// jnr-levels.test.js prueft Breite je Level, 9 Zeilen, Checkpoints = Abschnitte - 1, gleicher Seed ->
// gleiche Zeilen.
const { parseLevel, geometrie } = require('../../../jumpnrun/core/level.js');
const R = require('../../../jumpnrun/core/rewards.js');
const SOLVER = require('../../../jumpnrun/core/solver.js');
const D = require('../../../jumpnrun/data/levels.js');
const SEC = require('../../../jumpnrun/data/sections.js');

const SEEDS_PROPERTY = 200;
const SEEDS_DETERMINISMUS = 10;
const BLOCK = 50; // Seeds je Test, damit kein Einzeltest an das 60-s-Limit kommt
const BLOECKE = [];
for (let a = 1; a <= SEEDS_PROPERTY; a += BLOCK) BLOECKE.push([a, Math.min(a + BLOCK - 1, SEEDS_PROPERTY)]);
const D1_POOL = { minDifficulty: 1, maxDifficulty: 1, minSections: 14, maxSections: 18 };
const MASS = SOLVER.sprungmass(); // vermessen: { luecke: 3, stufe: 3 } Kacheln
const GEGNER_AB = 2; // erster Abschnitt (Index), der einen Wicht haben darf (core/levelgen.js)

function pruefeGeometrie(level, wo) {
  const g = geometrie(level);
  const luecke = Math.max(0, ...g.luecken), stufe = Math.max(0, ...g.stufen);
  if (luecke > MASS.luecke) throw new Error(wo + ': Luecke von ' + luecke + ' Kacheln, Sprungweite ist ' + MASS.luecke);
  if (stufe > MASS.stufe) throw new Error(wo + ': Stufe von ' + stufe + ' Kacheln, Sprunghoehe ist ' + MASS.stufe);
  g.kristallHoehen.forEach((h, i) => {
    if (!(h <= MASS.stufe)) throw new Error(wo + ': Kristall ' + i + ' schwebt ' + h + ' Kacheln ueber dem Boden, Sprunghoehe ist ' + MASS.stufe);
  });
  if (!g.startFrei) throw new Error(wo + ': Start in Wand, Gefahr oder auf einer Wicht-Strecke');
}

function pruefeWichte(gen, level, wo) {
  const breiten = gen.sections.map(sid => SEC.SECTIONS.find(s => s.id === sid).rows[0].length);
  const offsets = []; let o = 0;
  breiten.forEach(b => { offsets.push(o); o += b; });
  const abschnittVon = tx => { let i = 0; while (i + 1 < offsets.length && offsets[i + 1] <= tx) i++; return i; };
  const imRaster = gen.rows.join('').split('').filter(c => c === 'w').length;
  if (imRaster !== gen.gegner.length || level.enemies.length !== gen.gegner.length)
    throw new Error(wo + ': ' + imRaster + ' w im Raster, ' + gen.gegner.length + ' in gen.gegner, ' + level.enemies.length + ' im Level');
  const belegt = new Set();
  gen.gegner.forEach(w => {
    const idx = abschnittVon(w.tx);
    if (gen.rows[w.ty][w.tx] !== 'w') throw new Error(wo + ': gen.gegner nennt (' + w.tx + ',' + w.ty + '), dort steht kein w');
    if (idx !== w.abschnitt) throw new Error(wo + ': Wicht bei Spalte ' + w.tx + ' liegt in Abschnitt ' + idx + ', gen.gegner sagt ' + w.abschnitt);
    if (idx < GEGNER_AB || idx >= gen.sections.length - 1)
      throw new Error(wo + ': Wicht in Abschnitt ' + idx + ' (' + gen.sections[idx] + '), erlaubt sind ' + GEGNER_AB + '..' + (gen.sections.length - 2));
    if (belegt.has(idx)) throw new Error(wo + ': zwei Wichte in Abschnitt ' + idx);
    belegt.add(idx);
  });
}

// Der Bot-Lauf eines Seeds: nur unsterblich (Pass-Kriterium).
function laufeUnsterblich(level, opts, wo) {
  let frei;
  try {
    frei = SOLVER.solve(level, opts, undefined, { unsterblich: true });
  } catch (e) { throw new Error(wo + ': Ausnahme im Bot-Lauf: ' + e.message); }
  if (frei.fehler) throw new Error(wo + ': ' + frei.fehler);
  if (frei.softlock) throw new Error(wo + ': Softlock nach ' + frei.frames + ' Schritten (unsterblich, ' + (frei.verluste.abgrund || 0) + ' Stuerze)');
  if (!frei.won) throw new Error(wo + ': unsterblich nicht erreicht (' + frei.game.status + ' nach ' + frei.frames + ' Schritten)');
  return frei;
}

// ---- Absturztest mit dem 3-Leben-Bot (Marco 31.10.2026) ----
const SEEDS_ABSTURZ = 20;
const SCHRITTLIMIT = 60 * 180; // 3 Spielminuten, wie der Standard von solver.solve
const WERTE_SPIELER = ['x', 'y', 'vx', 'vy'];
const WERTE_SPIEL = ['leben', 'energie', 'funken'];

// Wirft, wenn ein Wert von Spieler oder Spiel keine endliche Zahl ist.
function pruefeWerte(g, wo) {
  WERTE_SPIELER.forEach((k) => {
    if (!Number.isFinite(g.player[k])) throw new Error(wo + ': ungueltiges ' + k + ' = ' + g.player[k]);
  });
  WERTE_SPIEL.forEach((k) => {
    if (!Number.isFinite(g[k])) throw new Error(wo + ': ungueltiges ' + k + ' = ' + g[k]);
  });
}

// Ein Lauf mit 3 Leben. Gewonnen, verloren oder Softlock sind alle in Ordnung, das Ergebnis des Bots
// zaehlt nicht. Fehler sind nur Ausnahmen, ungueltige Werte und ein Lauf, der am Limit noch nicht endete.
function laufeMitLeben(level, opts, wo) {
  const r = SOLVER.solve(level, opts, SCHRITTLIMIT, {
    jeSchritt: (g, f) => pruefeWerte(g, wo + ', Schritt ' + (f + 1))
  });
  if (r.fehler) throw new Error(wo + ': ' + r.fehler);
  if (!r.won && r.game.status !== 'lost' && !r.softlock) throw new Error(wo + ': kein Ende nach ' + SCHRITTLIMIT + ' Schritten');
  return r;
}

function absturztest(id) {
  const meta = D.byId(id);
  if (!meta) throw new Error('Unbekanntes Level: ' + id);
  test('Level ' + id + ' ' + meta.name + ': 3-Leben-Bot ueber ' + SEEDS_ABSTURZ + ' Seeds ohne Absturz', () => {
    const options = R.defaultJnr().options;
    for (let seed = 1; seed <= SEEDS_ABSTURZ; seed++) {
      const gen = D.generateFor(id, seed);
      const reihe = 2 + seed % 9; // alle Reihen kommen einmal dran
      laufeMitLeben(parseLevel(gen.rows), D.gameOptions(meta, options, seed, reihe), 'Level ' + id + ', seed ' + seed);
    }
  }, 60000);
}

function spur(r) {
  return { won: r.won, softlock: r.softlock, frames: r.frames, schaden: r.schaden, verluste: r.verluste,
    x: r.game.player.x, y: r.game.player.y, funken: r.game.funken, t: r.game.t };
}

// Legt die Spielbarkeits-Tests eines Levels an (aufgerufen aus jnr-spielbarkeit-<id>.test.js).
function spielbarkeit(id) {
  const meta = D.byId(id);
  if (!meta) throw new Error('Unbekanntes Level: ' + id);

  describe('Level ' + id + ' ' + meta.name + ': Spielbarkeit', () => {
    test.each(BLOECKE)('Seeds %i-%i: unsterblich erreichbar, Geometrie in Sprungreichweite, Wichte und Start sauber', (von, bis) => {
      const options = R.defaultJnr().options;
      for (let seed = von; seed <= bis; seed++) {
        const gen = D.generateFor(id, seed);
        const level = parseLevel(gen.rows);
        const wo = 'Level ' + id + ', seed ' + seed + ' (' + gen.sections.join(' > ') + ')';
        pruefeGeometrie(level, wo);
        pruefeWichte(gen, level, wo);
        laufeUnsterblich(level, D.gameOptions(meta, options, seed), wo);
      }
    }, 60000);

    test('deterministisch je Seed: zweimal erzeugen und loesen ergibt dieselben Zeilen, Schritte und Ergebnisse', () => {
      const options = R.defaultJnr().options;
      for (let seed = 1; seed <= SEEDS_DETERMINISMUS; seed++) {
        const a = D.generateFor(id, seed), b = D.generateFor(id, seed);
        expect(b.rows).toEqual(a.rows);
        expect(b.sections).toEqual(a.sections);
        expect(b.gegner).toEqual(a.gegner);
        const ra = SOLVER.solve(parseLevel(a.rows), D.gameOptions(meta, options, seed), undefined, { unsterblich: true });
        const rb = SOLVER.solve(parseLevel(b.rows), D.gameOptions(meta, options, seed), undefined, { unsterblich: true });
        expect(spur(rb)).toEqual(spur(ra));
      }
    }, 60000);
  });
}

module.exports = { SEEDS_PROPERTY, SEEDS_DETERMINISMUS, BLOECKE, D1_POOL, MASS, pruefeGeometrie, pruefeWichte,
  laufeUnsterblich, spur, spielbarkeit, SEEDS_ABSTURZ, pruefeWerte, laufeMitLeben, absturztest };
