const { parseLevel } = require('../../jumpnrun/core/level.js');
const G = require('../../jumpnrun/core/game.js');
const R = require('../../jumpnrun/core/rewards.js');
const SOLVER = require('../../jumpnrun/core/solver.js');
const D = require('../../jumpnrun/data/levels.js');

const SEEDS_PROPERTY = 200;

// Synthetische Stufe ohne Zahlen: seit Stufe 1-1 "Erste Schritte" gestrichen ist (das Mitmach-Tutorial
// uebernimmt den Einstieg), hat Welt 1 keine solche Stufe mehr. Die Logik fuer mathe:false bleibt getestet.
const OHNE_ZAHLEN = { id: '9-9', name: 'Test ohne Zahlen', welt: 9, mathe: false, reihe: null };

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

    test(`ist fuer ${SEEDS_PROPERTY} Seeds per Greedy-Bot nachweislich loesbar`, () => {
      const options = R.defaultJnr().options;
      let gegnerTreffer = 0;
      for (let seed = 1; seed <= SEEDS_PROPERTY; seed++) {
        const gen = D.generateFor(id, seed);
        const level = parseLevel(gen.rows);
        const opts = D.gameOptions(meta, options, seed);
        const r = SOLVER.solve(level, opts);
        if (!r.won) throw new Error('Stufe ' + id + ', seed ' + seed + ' nicht loesbar (' + r.game.status + ', Leben ' + r.game.leben + '): ' + gen.sections.join(' > '));
        gegnerTreffer += r.schaden.gegner || 0;
      }
      // Rechenwichten kann man immer ausweichen (drueber- oder draufspringen)
      expect(gegnerTreffer).toBe(0);
    }, 60000);
  });

  // Positiv-Gegenstueck zur Gegenprobe: der reine Schwierigkeit-1-Pool (Parameter der frueheren Stufe
  // 1-1) bleibt loesbar, die Abschnitte stecken ja weiter in Stufe 1-2.
  test(`nur Schwierigkeit-1-Abschnitte: fuer ${SEEDS_PROPERTY} Seeds loesbar`, () => {
    const LG = require('../../jumpnrun/core/levelgen.js');
    for (let seed = 1; seed <= SEEDS_PROPERTY; seed++) {
      const gen = LG.generate({ minDifficulty: 1, maxDifficulty: 1, minSections: 14, maxSections: 18 }, seed);
      const r = SOLVER.solve(parseLevel(gen.rows), { mode: 'aus' });
      if (!r.won) throw new Error('Schwierigkeit 1, seed ' + seed + ' nicht loesbar: ' + gen.sections.join(' > '));
    }
  }, 60000);

  test('Gegenprobe: ein unloesbarer Abschnitt im Pool laesst den Eigenschafts-Test anschlagen', () => {
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
    let sawFailure = false;
    for (let seed = 1; seed <= 200 && !sawFailure; seed++) {
      const gen = LG.generate({ minDifficulty: 1, maxDifficulty: 1, minSections: 14, maxSections: 18, pool: badPool }, seed);
      const level = parseLevel(gen.rows);
      const r = SOLVER.solve(level, { mode: 'aus' });
      if (!r.won) sawFailure = true;
    }
    expect(sawFailure).toBe(true);
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
});
