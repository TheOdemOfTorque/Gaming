const { parseLevel } = require('../../jumpnrun/core/level.js');
const G = require('../../jumpnrun/core/game.js');
const R = require('../../jumpnrun/core/rewards.js');
const SOLVER = require('../../jumpnrun/core/solver.js');
const D = require('../../jumpnrun/data/levels.js');

const SEEDS_PROPERTY = 200;

// Synthetische Stufe ohne Zahlen: seit Stufe 1-1 "Erste Schritte" gestrichen ist (das Mitmach-Tutorial
// uebernimmt den Einstieg), hat Welt 1 keine solche Stufe mehr. Die Logik fuer mathe:false bleibt getestet.
const OHNE_ZAHLEN = { id: '9-9', name: 'Test ohne Zahlen', welt: 9, mathe: false, reihe: null };

// ---- Hilfen fuer die Spielbarkeits-Tests (siehe Kommentar im describe.each unten) ----
const { geometrie } = require('../../jumpnrun/core/level.js');
const SEC = require('../../jumpnrun/data/sections.js');
const MESSEN = require('../../scripts/jnr-messen.js');
const MASS = SOLVER.sprungmass(); // vermessen: { luecke: 3, stufe: 3 } Kacheln
const SEEDS_DETERMINISMUS = 10;
const BLOCK = 50; // Seeds je Test: unter Jest kosten 50 Seeds x 2 Bot-Laeufe ca. 27 s, Limit sind 60 s
const BLOECKE = [];
for (let a = 1; a <= SEEDS_PROPERTY; a += BLOCK) BLOECKE.push([a, Math.min(a + BLOCK - 1, SEEDS_PROPERTY)]);
const D1_POOL = { minDifficulty: 1, maxDifficulty: 1, minSections: 14, maxSections: 18 };
const messwerte = {}; // Stufe -> Messwerte des 3-Leben-Bots, Ausgabe in afterAll
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

// Beide Bot-Laeufe eines Seeds: unsterblich (Pass-Kriterium) und mit 3 Leben (nur Messwert).
function laufeBeide(level, opts, wo) {
  let frei, mit;
  try {
    frei = SOLVER.solve(level, opts, undefined, { unsterblich: true });
    mit = SOLVER.solve(level, opts);
  } catch (e) { throw new Error(wo + ': Ausnahme im Bot-Lauf: ' + e.message); }
  if (frei.fehler) throw new Error(wo + ': ' + frei.fehler);
  if (frei.softlock) throw new Error(wo + ': Softlock nach ' + frei.frames + ' Schritten (unsterblich, ' + (frei.verluste.abgrund || 0) + ' Stuerze)');
  if (!frei.won) throw new Error(wo + ': unsterblich nicht erreicht (' + frei.game.status + ' nach ' + frei.frames + ' Schritten)');
  return { frei, mit };
}

function spur(r) {
  return { won: r.won, softlock: r.softlock, frames: r.frames, schaden: r.schaden, verluste: r.verluste,
    x: r.game.player.x, y: r.game.player.y, funken: r.game.funken, t: r.game.t };
}

describe('Stufen-Tabelle Welt 1 (data/levels.js)', () => {
  test('Welt 1 hat nur noch die Stufe 1-2 Zahlenwiese, 1-1 Erste Schritte ist gestrichen', () => {
    expect(D.ORDER).toEqual(['1-2']);
    expect(new Set(D.ORDER).size).toBe(D.ORDER.length);
    D.STAGES.forEach(l => expect(l.welt).toBe(1));
    expect(D.byId('1-2').name).toBe('Zahlenwiese');
    expect(D.STAGES.some(l => l.name === 'Erste Schritte')).toBe(false);
  });

  test('gestrichene oder unbekannte Stufe: byId liefert null, generateFor wirft verstaendlich', () => {
    expect(D.byId('1-1')).toBeNull();
    expect(D.byId('7-7')).toBeNull();
    expect(D.byId(undefined)).toBeNull();
    expect(() => D.generateFor('1-1', 1)).toThrow(/Unbekannte Stufe/);
  });

  test('die erste Stufe ist ohne Vorleistung frei, auch mit altem 1-1-Spielstand', () => {
    const erste = D.ORDER[0];
    expect(erste).toBe('1-2');
    expect(R.isUnlocked(R.defaultJnr(), erste, D.ORDER)).toBe(true);
    const alt = R.sanitizeJnr({ levels: { '1-1': { medals: 3, bestTimeMs: 9, bestFunken: 4 } }, xpAwarded: { '1-1': true }, lastLevel: '1-1' });
    expect(R.isUnlocked(alt, erste, D.ORDER)).toBe(true);
    expect(R.isUnlocked(alt, '1-1', D.ORDER)).toBe(false); // Geisterstufe wird nie freigeschaltet
  });

  test('nach der letzten Stufe gibt es keine naechste (kein Verweis auf eine fehlende Stufe)', () => {
    D.ORDER.forEach((id, i) => {
      const next = D.ORDER[i + 1];
      if (next !== undefined) expect(D.byId(next)).not.toBeNull();
    });
    expect(D.ORDER[D.ORDER.indexOf('1-2') + 1]).toBeUndefined();
  });

  test('Stufe 1-2 hat eine gueltige Reihe als Vorschlag, jede Stufe der Welt 1 hat Zahlen', () => {
    const l2 = D.byId('1-2');
    expect(l2.mathe).toBe(true);
    expect(Number.isInteger(l2.reihe) && l2.reihe >= 2).toBe(true);
    D.STAGES.forEach(l => expect(l.mathe).toBe(true));
  });

  test('gameOptions: Mathe-Modus aus der Einstellung ueberschreibt die Stufe', () => {
    const l2 = D.byId('1-2');
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1).mode).toBe('ziel');
    expect(D.gameOptions(l2, { mathe: 'aus' }, 1).mode).toBe('aus');
    expect(D.gameOptions(OHNE_ZAHLEN, { mathe: 'ziel' }, 1).mode).toBe('aus');
  });

  test('gameOptions: gewählte Reihe (2..10) fließt in die Kristalle, sonst die Reihe der Stufe', () => {
    const l2 = D.byId('1-2');
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1, 7).reihe).toBe(7);
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1, 10).reihe).toBe(10);
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1).reihe).toBe(l2.reihe);
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1, 1).reihe).toBe(l2.reihe);
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1, 11).reihe).toBe(l2.reihe);
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1, '7').reihe).toBe(l2.reihe);
  });

  test('Rechenwichte in Stufe 1-2, ohne gegner-Flag erzeugt der Generator keine', () => {
    const LG = require('../../jumpnrun/core/levelgen.js');
    expect(D.byId('1-2').gen.gegner).toBe(true);
    const ohneGegner = Object.assign({}, D.byId('1-2').gen, { gegner: false });
    let n = 0;
    for (let seed = 1; seed <= 20; seed++) {
      expect(parseLevel(LG.generate(ohneGegner, seed).rows).enemies).toHaveLength(0);
      n += parseLevel(D.generateFor('1-2', seed).rows).enemies.length;
    }
    expect(n).toBeGreaterThan(0);
  });

  test('Stufe 1-2: die Tafel der Wichte rechnet in der gewaehlten Reihe', () => {
    const meta = D.byId('1-2');
    const level = parseLevel(D.generateFor('1-2', 5).rows);
    const g = G.createGame(level, D.gameOptions(meta, { mathe: 'ziel' }, 5, 7));
    expect(g.enemies.length).toBeGreaterThan(0);
    g.enemies.forEach(e => expect(e.rechnung.reihe).toBe(7));
  });

  test('brauchtReihenwahl: nur Mathe-Stufen im Zahlen-Modus', () => {
    expect(D.brauchtReihenwahl(D.byId('1-2'), { mathe: 'ziel' })).toBe(true);
    expect(D.brauchtReihenwahl(D.byId('1-2'), { mathe: 'aus' })).toBe(false);
    expect(D.brauchtReihenwahl(OHNE_ZAHLEN, { mathe: 'ziel' })).toBe(false);
  });

  test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])('Stufe 1-2 mit Reihe %i: Kristalle tragen nur Vielfache als gute Zahlen', (reihe) => {
    const meta = D.byId('1-2');
    const gen = D.generateFor('1-2', 3);
    const level = parseLevel(gen.rows);
    const g = G.createGame(level, D.gameOptions(meta, { mathe: 'ziel' }, 3, reihe));
    expect(g.totalGood).toBeGreaterThan(0);
    g.crystals.forEach(c => expect(c.value % reihe === 0).toBe(c.good));
  });

  describe.each(D.ORDER)('Stufe %s: generateFor', (id) => {
    const meta = D.byId(id);

    test('ist fuer jeden Seed ein gueltiges Raster mit Gesamtlaenge ca. 200-300 Kacheln', () => {
      for (let seed = 1; seed <= 30; seed++) {
        const gen = D.generateFor(id, seed);
        const L = parseLevel(gen.rows);
        expect(L.h).toBe(9);
        expect(L.w).toBeGreaterThanOrEqual(200);
        expect(L.w).toBeLessThanOrEqual(320); // "ca. 200-300", Toleranz nach oben siehe BERICHT
        expect(L.checkpoints.length).toBe(gen.sections.length - 1);
      }
    });

    test('gleicher Seed -> dieselbe Abfolge, verschiedene Seeds -> unterschiedliche Abfolgen', () => {
      const a = D.generateFor(id, 123);
      const b = D.generateFor(id, 123);
      expect(a.rows).toEqual(b.rows);
      expect(a.sections).toEqual(b.sections);
      const seqs = new Set();
      for (let seed = 1; seed <= 20; seed++) seqs.add(D.generateFor(id, seed).sections.join(','));
      expect(seqs.size).toBeGreaterThan(1);
    });

    // ---- Spielbarkeit (Aufgabe 10, Marco 29.10.) ----
    // Pass-Kriterien je Seed: (1) der unsterbliche Bot erreicht das Ziel, ohne Softlock, ohne Ausnahme,
    // ohne ungueltige Position (NaN); (2) statische Geometrie in Sprungreichweite (core/level.js
    // geometrie gegen solver.sprungmass, per Simulation aus core/physics.js vermessen: 3 Kacheln Luecke,
    // 3 Kacheln Stufe); (3) Kristalle erreichbar, definiert als: in der Spalte des Kristalls liegt fester
    // Boden und der Kristall schwebt hoechstens Sprunghoehe darueber (dazu als Messwert der Anteil, den
    // der unsterbliche Bot wirklich einsammelt); (4) Wichte nur in Mittelabschnitten ab Index 2, nie im
    // Start-, ersten Mittel- oder Zielabschnitt, hoechstens einer je Abschnitt, 'w' im Raster passt zu
    // gen.gegner; (5) Start frei (nicht in Wand, Dornen, Federpilz oder auf einer Wicht-Strecke).
    // Leben, Energie, Schaden und Dauer des 3-Leben-Bots sind nur Messwerte (eine console.log-Zeile je
    // Stufe und scripts/jnr-messen.js), kein expect. Level-Inhalte werden deswegen nie geaendert.
    //
    // Schon erzwungen und hier nicht doppelt geprueft: parseLevel wirft bei fehlendem/mehrfachem S oder
    // G, fehlendem Boden unter S/G/C/^/~, Checkpoint ausserhalb Start..Ziel, Wicht ohne flache Strecke
    // mit 2 Kacheln Kopffreiheit, ohne Kristallplatz auf der Strecke und ohne Abstand zu Start, Ziel und
    // Laternen (ABSTAND_LATERNE), Strecke kuerzer als MIN_STRECKE. jnr-sections.test.js prueft je
    // Abschnitt 2 flache Kacheln an beiden Enden (anschlussfaehig) und dieselbe Geometrie wie hier.
    // Oben in dieser Datei: Breite 200-320, 9 Zeilen, Checkpoints = Abschnitte - 1, gleicher Seed ->
    // gleiche Zeilen.
    test.each(BLOECKE)(`Seeds %i-%i: unsterblich erreichbar, Geometrie in Sprungreichweite, Wichte und Start sauber (3-Leben-Bot nur Messwert)`, (von, bis) => {
      const options = R.defaultJnr().options;
      for (let seed = von; seed <= bis; seed++) {
        const gen = D.generateFor(id, seed);
        const level = parseLevel(gen.rows);
        const wo = 'Stufe ' + id + ', seed ' + seed + ' (' + gen.sections.join(' > ') + ')';
        pruefeGeometrie(level, wo);
        pruefeWichte(gen, level, wo);
        const laeufe = laufeBeide(level, D.gameOptions(meta, options, seed), wo);
        (messwerte[id] = messwerte[id] || []).push(MESSEN.messwert(laeufe.mit, laeufe.frei));
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

    afterAll(() => {
      if (messwerte[id]) console.log(MESSEN.zeile('Stufe ' + id + ', Reihe ' + meta.reihe, MESSEN.zusammenfassung(messwerte[id])));
    });
  });

  // Positiv-Gegenstueck zur Gegenprobe: der reine Schwierigkeit-1-Pool (Parameter der frueheren Stufe
  // 1-1) bleibt erreichbar, die Abschnitte stecken ja weiter in Stufe 1-2. Gleiche Kriterien wie oben.
  test(`nur Schwierigkeit-1-Abschnitte: fuer ${SEEDS_PROPERTY} Seeds unsterblich erreichbar und geometrisch in Sprungreichweite`, () => {
    const LG = require('../../jumpnrun/core/levelgen.js');
    const liste = [];
    for (let seed = 1; seed <= SEEDS_PROPERTY; seed++) {
      const gen = LG.generate(D1_POOL, seed);
      const level = parseLevel(gen.rows);
      const wo = 'Schwierigkeit 1, seed ' + seed + ' (' + gen.sections.join(' > ') + ')';
      pruefeGeometrie(level, wo);
      const laeufe = laufeBeide(level, { mode: 'aus' }, wo);
      liste.push(MESSEN.messwert(laeufe.mit, laeufe.frei));
    }
    console.log(MESSEN.zeile('Schwierigkeit-1-Pool, Zahlen aus', MESSEN.zusammenfassung(liste)));
  }, 60000);

  // Beweis, dass die neue Pruefung greift: ein Abschnitt mit einer Grube, die auch unsterblich keiner
  // schafft, laesst den Eigenschafts-Test anschlagen, und zwar ueber Softlock (Endlosschleife Sturz/
  // Respawn, nie status lost) und ueber die Geometrie (Luecke breiter als die Sprungweite).
  test('Gegenprobe: ein unloesbarer Abschnitt im Pool faellt ueber Softlock und Geometrie durch, nicht ueber Leben', () => {
    const SEC = require('../../jumpnrun/data/sections.js');
    const LG = require('../../jumpnrun/core/levelgen.js');
    const badPool = SEC.SECTIONS.concat([{
      id: 'test-unloesbar', schwierigkeit: 1, mechanik: ['lauf'],
      rows: [
        '..................', '..................', '..................', '..................',
        '..................', '..................', '..................',
        '##..............##', '##..............##'
      ]
    }]);
    let treffer = null, geometrieSchlaegtAn = 0;
    for (let seed = 1; seed <= 200 && !treffer; seed++) {
      const gen = LG.generate(Object.assign({ pool: badPool }, D1_POOL), seed);
      if (!gen.sections.includes('test-unloesbar')) continue;
      const level = parseLevel(gen.rows);
      expect(() => pruefeGeometrie(level, 'seed ' + seed)).toThrow(/Luecke/);
      geometrieSchlaegtAn++;
      const r = SOLVER.solve(level, { mode: 'aus' }, undefined, { unsterblich: true });
      expect(r.won).toBe(false);
      expect(() => laufeBeide(level, { mode: 'aus' }, 'seed ' + seed)).toThrow(/Softlock/);
      treffer = { seed, r };
    }
    expect(geometrieSchlaegtAn).toBeGreaterThan(0);
    expect(treffer).not.toBeNull();
    expect(treffer.r.softlock).toBe(true);
    expect(treffer.r.game.status).toBe('play');
    expect(treffer.r.game.leben).toBe(G.LEBEN); // nie ueber Leben gescheitert
    // mindestens ein Sturz mit Respawn; danach bremst die Vorausschau den Bot vor der Kante (Sturz
    // kostet 100, Stehenbleiben 50), er kommt nicht mehr ueber sein x-Maximum: genau das faengt Softlock
    expect(treffer.r.verluste.abgrund).toBeGreaterThanOrEqual(1);
    expect(treffer.r.frames).toBeLessThan(60 * 180); // nicht bis maxFrames gewartet
  }, 60000);
});

describe('menuUntertitel (Levelauswahl, QA-Befund N2)', () => {
  test('Mathe-Stufe nennt keine feste Reihe mehr, die Reihe kommt aus der Reihenwahl', () => {
    const t = D.menuUntertitel(D.byId('1-2'), { mathe: 'ziel' });
    expect(t).toBe('Reihe wählst du vor dem Start');
    expect(t).not.toMatch(/er-Reihe/);
  });

  test('Stufe ohne Zahlen und Mathe-Stufe bei ausgeschaltetem Zahlen-Modus: Laufen, Springen, Sammeln', () => {
    expect(D.menuUntertitel(OHNE_ZAHLEN, { mathe: 'ziel' })).toBe('Laufen, Springen, Sammeln');
    expect(D.menuUntertitel(D.byId('1-2'), { mathe: 'aus' })).toBe('Laufen, Springen, Sammeln');
  });
});
