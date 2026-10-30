const { parseLevel } = require('../../jumpnrun/core/level.js');
const G = require('../../jumpnrun/core/game.js');
const R = require('../../jumpnrun/core/rewards.js');
const SOLVER = require('../../jumpnrun/core/solver.js');
const D = require('../../jumpnrun/data/levels.js');

const SEEDS_PROPERTY = 200;

// Synthetische Stufe ohne Zahlen: seit Stufe 1-1 "Erste Schritte" gestrichen ist (das Mitmach-Tutorial
// uebernimmt den Einstieg), hat Welt 1 keine solche Stufe mehr. Die Logik fuer mathe:false bleibt getestet.
const OHNE_ZAHLEN = { id: '9-9', name: 'Test ohne Zahlen', welt: 9, mathe: false, reihe: null };

// ---- Spielbarkeit: Pass-Kriterien und Hilfen im gemeinsamen Helfer, die Pruefung je Level in
// jnr-spielbarkeit-<id>.test.js (Review n5, H4). Hier bleiben der Schwierigkeit-1-Pool und die Gegenprobe.
const { geometrie } = require('../../jumpnrun/core/level.js');
const MESSEN = require('../../scripts/jnr-messen.js');
const H = require('./helpers/jnr-spielbarkeit.js');
const { pruefeGeometrie, laufeUnsterblich, D1_POOL } = H;

// Laenge je Level in Kacheln (Spec erlaubt 200 bis 400). Gemessen ueber 400 Seeds (Vornacht 29.10.):
// 1-2 Ø 274 (249-294), 1-3 Ø 295 (266-338), 2-1 Ø 333 (294-370).
const LAENGE = { '1-2': [200, 320], '1-3': [200, 360], '2-1': [200, 400] };

describe('Level-Tabelle (data/levels.js): Welt 1 Daemmerwiese und Welt 2 Sternenhuegel', () => {
  test('drei Level in der Reihenfolge 1-2, 1-3, 2-1; 1-1 Erste Schritte bleibt gestrichen', () => {
    expect(D.ORDER).toEqual(['1-2', '1-3', '2-1']);
    expect(new Set(D.ORDER).size).toBe(D.ORDER.length);
    expect(D.STAGES.map(l => l.id)).toEqual(D.ORDER);
    expect(D.byId('1-2').name).toBe('Zahlenwiese');
    expect(D.byId('1-3').name).toBe('Glühwürmchenpfad');
    expect(D.byId('2-1').name).toBe('Wichtelhügel');
    expect(D.STAGES.some(l => l.name === 'Erste Schritte')).toBe(false);
    expect(Object.keys(LAENGE)).toEqual(D.ORDER);
  });

  test('Welt 1 heisst Daemmerwiese (1-2, 1-3), Welt 2 Sternenhuegel (2-1); welt passt zur ID', () => {
    expect(D.byId('1-2')).toMatchObject({ welt: 1, weltName: 'Dämmerwiese' });
    expect(D.byId('1-3')).toMatchObject({ welt: 1, weltName: 'Dämmerwiese' });
    expect(D.byId('2-1')).toMatchObject({ welt: 2, weltName: 'Sternenhügel' });
    D.STAGES.forEach(l => expect(l.welt).toBe(R.parseLevelId(l.id).welt));
  });

  test('Welten fuer das Menue: Reihenfolge der Welten, Level darunter in ORDER-Reihenfolge', () => {
    expect(D.welten()).toEqual([
      { welt: 1, name: 'Dämmerwiese', levels: ['1-2', '1-3'] },
      { welt: 2, name: 'Sternenhügel', levels: ['2-1'] }
    ]);
  });

  test('gen-Parameter nach dem Plan: 1-3 nur Pool und Laenge, 2-1 dichter mit Mindestzahl Wichte', () => {
    expect(D.byId('1-2').gen).toEqual({ minDifficulty: 1, maxDifficulty: 2, minSections: 16, maxSections: 18, gegner: true });
    expect(D.byId('1-3').gen).toEqual({ minDifficulty: 1, maxDifficulty: 3, minSections: 16, maxSections: 18, gegner: true });
    expect(D.byId('2-1').gen).toEqual({ minDifficulty: 2, maxDifficulty: 3, minSections: 17, maxSections: 19, gegner: true, gegnerAbstand: [1, 1], minGegner: 4 });
  });

  // Review 30.10. (K4): rewards.xpFor rechnet mit WELT_VERSATZ = 60 = drei Level-Plaetze je Welt. Ein
  // viertes Level in einer Welt (z. B. 2-4) bekaeme so viele XP wie das erste der naechsten (3-1).
  test('hoechstens drei Level je Welt, sonst passt der Welt-Versatz der XP nicht mehr', () => {
    expect(R.WELT_VERSATZ).toBe(60);
    const jeWelt = {};
    D.ORDER.forEach(id => { const w = R.parseLevelId(id); jeWelt[w.welt] = (jeWelt[w.welt] || 0) + 1; expect(w.nr).toBeLessThanOrEqual(3); });
    Object.values(jeWelt).forEach(n => expect(n).toBeLessThanOrEqual(3));
  });

  test('Freischaltkette: 1-3 nach einer Medaille in 1-2, 2-1 nach einer Medaille in 1-3', () => {
    const j0 = R.defaultJnr();
    expect(D.ORDER.map(id => R.isUnlocked(j0, id, D.ORDER))).toEqual([true, false, false]);
    const j1 = R.mergeResult(j0, { level: '1-2', medaillen: 1, funken: 1, xp: 50, timeMs: 1 });
    expect(D.ORDER.map(id => R.isUnlocked(j1, id, D.ORDER))).toEqual([true, true, false]);
    const j2 = R.mergeResult(j1, { level: '1-3', medaillen: 1, funken: 1, xp: 70, timeMs: 1 });
    expect(D.ORDER.map(id => R.isUnlocked(j2, id, D.ORDER))).toEqual([true, true, true]);
    // drei Medaillen in 1-2 allein oeffnen 2-1 nicht
    const j3 = R.mergeResult(j0, { level: '1-2', medaillen: 3, funken: 1, xp: 70, timeMs: 1 });
    expect(R.isUnlocked(j3, '2-1', D.ORDER)).toBe(false);
  });

  test('2-1 Wichtelhuegel: fuer 200 Seeds mindestens 4 Rechenwichte je Lauf', () => {
    let summe = 0;
    for (let seed = 1; seed <= SEEDS_PROPERTY; seed++) {
      const gen = D.generateFor('2-1', seed);
      expect(gen.gegner.length).toBeGreaterThanOrEqual(4);
      expect(parseLevel(gen.rows).enemies.length).toBe(gen.gegner.length);
      summe += gen.gegner.length;
    }
    expect(summe / SEEDS_PROPERTY).toBeGreaterThan(4);
  });

  test('monotone Kurve: Gefahren (Dornen, Federpilze, Luecken) im Schnitt 1-2 < 1-3 < 2-1 ueber 50 Seeds', () => {
    const gefahren = id => {
      let g = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const L = parseLevel(D.generateFor(id, seed).rows);
        g += L.spikes.length + L.springs.length + geometrie(L).luecken.length;
      }
      return g / 50;
    };
    const k = D.ORDER.map(gefahren);
    expect(k[0]).toBeLessThan(k[1]);
    expect(k[1]).toBeLessThan(k[2]);
    console.log('Gefahren Ø je Lauf (50 Seeds): ' + D.ORDER.map((id, i) => id + ' ' + k[i].toFixed(1)).join(', '));
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

  test('naechstes Level: 1-2 -> 1-3 -> 2-1, nach dem letzten Level gibt es keines (kein Verweis ins Leere)', () => {
    D.ORDER.forEach((id, i) => {
      const next = D.ORDER[i + 1];
      if (next !== undefined) expect(D.byId(next)).not.toBeNull();
    });
    expect(D.ORDER[D.ORDER.indexOf('1-2') + 1]).toBe('1-3');
    expect(D.ORDER[D.ORDER.indexOf('1-3') + 1]).toBe('2-1');
    expect(D.ORDER[D.ORDER.indexOf('2-1') + 1]).toBeUndefined();
  });

  test('jedes Level hat Zahlen und eine gueltige Reihe als Vorschlag (wie 1-2)', () => {
    D.STAGES.forEach(l => {
      expect(l.mathe).toBe(true);
      expect(l.reihe).toBe(D.byId('1-2').reihe);
      expect(Number.isInteger(l.reihe) && l.reihe >= 2 && l.reihe <= 10).toBe(true);
    });
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

  // Neue Level (Aufgabe 9): Kristalle und Wicht-Tafeln rechnen in der gewaehlten Reihe, hier fuer zwei Reihen.
  describe.each(['1-3', '2-1'])('Level %s: Zahlen in der gewaehlten Reihe', (id) => {
    test.each([2, 7])('Reihe %i: Kristalle nur Vielfache als gute Zahlen, Wicht-Tafeln in der Reihe, Zahlen aus ohne Wichte', (reihe) => {
      const meta = D.byId(id);
      for (let seed = 1; seed <= 5; seed++) {
        const gen = D.generateFor(id, seed);
        const level = parseLevel(gen.rows);
        const g = G.createGame(level, D.gameOptions(meta, { mathe: 'ziel' }, seed, reihe));
        expect(g.totalGood).toBeGreaterThan(0);
        g.crystals.forEach(c => expect(c.value % reihe === 0).toBe(c.good));
        expect(g.enemies.length).toBe(gen.gegner.length);
        g.enemies.forEach(e => expect(e.rechnung.reihe).toBe(reihe));
        expect(D.gameOptions(meta, { mathe: 'aus' }, seed, reihe).mode).toBe('aus');
      }
      expect(D.brauchtReihenwahl(meta, { mathe: 'ziel' })).toBe(true);
      expect(D.menuUntertitel(meta, { mathe: 'ziel' })).toBe('Reihe wählst du vor dem Start');
    });
  });

  describe.each(D.ORDER)('Stufe %s: generateFor', (id) => {
    test(`ist fuer jeden Seed ein gueltiges Raster mit Gesamtlaenge ${LAENGE[id][0]}-${LAENGE[id][1]} Kacheln`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const gen = D.generateFor(id, seed);
        const L = parseLevel(gen.rows);
        expect(L.h).toBe(9);
        expect(L.w).toBeGreaterThanOrEqual(LAENGE[id][0]);
        expect(L.w).toBeLessThanOrEqual(LAENGE[id][1]);
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
    // Spielbarkeit und Determinismus je Level: jnr-spielbarkeit-<id>.test.js (helpers/jnr-spielbarkeit.js)
  });

  // Positiv-Gegenstueck zur Gegenprobe: der reine Schwierigkeit-1-Pool (Parameter der frueheren Stufe
  // 1-1) bleibt erreichbar, die Abschnitte stecken ja weiter in Stufe 1-2. Kriterien wie in helpers/jnr-spielbarkeit.js.
  test(`nur Schwierigkeit-1-Abschnitte: fuer ${SEEDS_PROPERTY} Seeds unsterblich erreichbar und geometrisch in Sprungreichweite`, () => {
    const LG = require('../../jumpnrun/core/levelgen.js');
    for (let seed = 1; seed <= SEEDS_PROPERTY; seed++) {
      const gen = LG.generate(D1_POOL, seed);
      const level = parseLevel(gen.rows);
      const wo = 'Schwierigkeit 1, seed ' + seed + ' (' + gen.sections.join(' > ') + ')';
      pruefeGeometrie(level, wo);
      laufeUnsterblich(level, { mode: 'aus' }, wo);
    }
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
      expect(() => laufeUnsterblich(level, { mode: 'aus' }, 'seed ' + seed)).toThrow(/Softlock/);
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

// Review n5 (H4, Marco 30.10.): Die Spielbarkeit je Level steht in einer eigenen Datei
// (jnr-spielbarkeit-<id>.test.js), damit Jest die Level parallel prueft. Der gemeinsame Helfer laesst
// nur den unsterblichen Bot laufen; der Bot mit 3 Leben ist reiner Messwert und laeuft nur in
// scripts/jnr-messen.js.
describe('Spielbarkeits-Helfer (tests/unit/helpers/jnr-spielbarkeit.js)', () => {
  const fs = require('fs');
  const path = require('path');
  const H = require('./helpers/jnr-spielbarkeit.js');

  test('je Level in ORDER eine eigene Spielbarkeits-Datei, die den Helfer mit ihrer ID aufruft', () => {
    D.ORDER.forEach(id => {
      const datei = path.join(__dirname, 'jnr-spielbarkeit-' + id + '.test.js');
      expect(fs.existsSync(datei)).toBe(true);
      expect(fs.readFileSync(datei, 'utf8')).toContain("spielbarkeit('" + id + "')");
    });
  });

  test('gleiche Seed-Zahlen wie vorher: 200 Seeds in Bloecken zu 50, 10 Seeds Determinismus', () => {
    expect(H.SEEDS_PROPERTY).toBe(200);
    expect(H.SEEDS_DETERMINISMUS).toBe(10);
    expect(H.BLOECKE).toEqual([[1, 50], [51, 100], [101, 150], [151, 200]]);
  });

  test('laufeUnsterblich ruft den Solver genau einmal auf, unsterblich, und nie den 3-Leben-Bot', () => {
    const spy = jest.spyOn(SOLVER, 'solve');
    try {
      const gen = D.generateFor('1-2', 1);
      const r = H.laufeUnsterblich(parseLevel(gen.rows), D.gameOptions(D.byId('1-2'), R.defaultJnr().options, 1), 'seed 1');
      expect(r.won).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][3]).toEqual({ unsterblich: true });
    } finally { spy.mockRestore(); }
  });
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

  // Review n5 (H2, Marco 30.10.): gesperrte Level sagen, welches Level davor zu schaffen ist.
  test('gesperrtes Level nennt den Vorgaenger aus ORDER, unabhaengig vom Zahlen-Modus', () => {
    expect(D.menuUntertitel(D.byId('1-3'), { mathe: 'ziel' }, true)).toBe('Erst Zahlenwiese schaffen');
    expect(D.menuUntertitel(D.byId('2-1'), { mathe: 'ziel' }, true)).toBe('Erst Glühwürmchenpfad schaffen');
    expect(D.menuUntertitel(D.byId('2-1'), { mathe: 'aus' }, true)).toBe('Erst Glühwürmchenpfad schaffen');
    D.ORDER.slice(1).forEach((id, i) => {
      expect(D.menuUntertitel(D.byId(id), { mathe: 'ziel' }, true)).toBe('Erst ' + D.byId(D.ORDER[i]).name + ' schaffen');
    });
    // offen oder ohne Vorgaenger: der normale Untertitel
    expect(D.menuUntertitel(D.byId('1-3'), { mathe: 'ziel' }, false)).toBe('Reihe wählst du vor dem Start');
    expect(D.menuUntertitel(D.byId('1-2'), { mathe: 'ziel' }, true)).toBe('Reihe wählst du vor dem Start');
  });
});

// scripts/jnr-messen.js struktur: Laenge, Wichte, Dornen, Federpilze, Luecken und Geometrie-Verstoesse je Seed
// (reihenunabhaengig), fuer die Messtabelle der Level (Aufgabe 9). Hier nur der Vertrag an wenigen Seeds.
describe('Struktur-Messung (scripts/jnr-messen.js struktur)', () => {
  test('zaehlt je Seed, was im Raster steht, und fasst Ø/min/max zusammen', () => {
    const liste = MESSEN.struktur('2-1', 5);
    expect(liste).toHaveLength(5);
    liste.forEach((m, i) => {
      const gen = D.generateFor('2-1', i + 1), L = parseLevel(gen.rows), g = geometrie(L);
      expect(m).toEqual({
        laenge: L.w, wichte: gen.gegner.length, dornen: L.spikes.length, federpilze: L.springs.length,
        luecken: g.luecken.length, verstoesse: 0, versuch: gen.versuch
      });
      expect(m.wichte).toBeGreaterThanOrEqual(4);
    });
    const z = MESSEN.strukturZusammenfassung(liste);
    expect(z.n).toBe(5);
    expect(z.laenge.min).toBeLessThanOrEqual(z.laenge.mittel);
    expect(z.laenge.mittel).toBeLessThanOrEqual(z.laenge.max);
    expect(z.wichte.min).toBeGreaterThanOrEqual(4);
    expect(z.verstoesse).toBe(0);
    expect(z.neuGewuerfelt).toBe(liste.filter(m => m.versuch > 0).length);
    expect(typeof MESSEN.strukturZeile('2-1', z)).toBe('string');
    expect(MESSEN.strukturZeile('2-1', z)).toMatch(/Laenge/);
  });

  test('Geometrie-Verstoesse werden gezaehlt (handgebautes Level mit zu breiter Luecke)', () => {
    const L = parseLevel(['S..............G', '###.........####']);
    expect(MESSEN.strukturWert({ gegner: [], versuch: 0 }, L).verstoesse).toBeGreaterThan(0);
  });
});
