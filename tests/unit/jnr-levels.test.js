const { parseLevel } = require('../../jumpnrun/core/level.js');
const G = require('../../jumpnrun/core/game.js');
const R = require('../../jumpnrun/core/rewards.js');
const SOLVER = require('../../jumpnrun/core/solver.js');
const D = require('../../jumpnrun/data/levels.js');

const SEEDS_PROPERTY = 200;

describe('Stufen-Tabelle Welt 1 (data/levels.js)', () => {
  test('es gibt 2 Stufen in Welt 1 mit eindeutigen IDs', () => {
    expect(D.ORDER).toEqual(['1-1', '1-2']);
    expect(new Set(D.ORDER).size).toBe(2);
    D.STAGES.forEach(l => expect(l.welt).toBe(1));
  });

  test('Stufe 1-1 hat keine Mathe-Pflicht, Stufe 1-2 eine gueltige Reihe', () => {
    expect(D.byId('1-1').mathe).toBe(false);
    const l2 = D.byId('1-2');
    expect(l2.mathe).toBe(true);
    expect(Number.isInteger(l2.reihe) && l2.reihe >= 2).toBe(true);
  });

  test('gameOptions: Mathe-Modus aus der Einstellung ueberschreibt die Stufe', () => {
    const l2 = D.byId('1-2');
    expect(D.gameOptions(l2, { mathe: 'ziel' }, 1).mode).toBe('ziel');
    expect(D.gameOptions(l2, { mathe: 'aus' }, 1).mode).toBe('aus');
    expect(D.gameOptions(D.byId('1-1'), { mathe: 'ziel' }, 1).mode).toBe('aus');
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
      for (let seed = 1; seed <= SEEDS_PROPERTY; seed++) {
        const gen = D.generateFor(id, seed);
        const level = parseLevel(gen.rows);
        const opts = D.gameOptions(meta, options, seed);
        const r = SOLVER.solve(level, opts);
        if (!r.won) throw new Error('Stufe ' + id + ', seed ' + seed + ' nicht loesbar: ' + gen.sections.join(' > '));
      }
    });
  });

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
