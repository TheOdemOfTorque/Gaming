const { parseLevel } = require('../../jumpnrun/core/level.js');
const LG = require('../../jumpnrun/core/levelgen.js');
const SEC = require('../../jumpnrun/data/sections.js');

const BASE = { minDifficulty: 1, maxDifficulty: 1, minSections: 6, maxSections: 8 };

describe('Level-Generator (core/levelgen.js)', () => {
  test('liefert ein gueltiges Level (genau ein Start, ein Ziel)', () => {
    const g = LG.generate(BASE, 42);
    expect(() => parseLevel(g.rows)).not.toThrow();
  });

  test('deterministisch: gleicher Seed liefert exakt dieselbe Abfolge und dieselben Zeilen', () => {
    const a = LG.generate(BASE, 7);
    const b = LG.generate(BASE, 7);
    expect(a.sections).toEqual(b.sections);
    expect(a.rows).toEqual(b.rows);
  });

  test('verschiedene Seeds liefern unterschiedliche Abfolgen', () => {
    const seqs = new Set();
    for (let seed = 1; seed <= 20; seed++) seqs.add(LG.generate(BASE, seed).sections.join(','));
    expect(seqs.size).toBeGreaterThan(1);
  });

  test('nie derselbe Abschnitt zweimal direkt hintereinander', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = LG.generate(BASE, seed);
      for (let i = 1; i < g.sections.length; i++) {
        expect(g.sections[i]).not.toBe(g.sections[i - 1]);
      }
    }
  });

  test('Start- und Ziel-Abschnitt sind an jedem Lauf dieselben, Mittelteil respektiert die Schwierigkeit', () => {
    const g = LG.generate(BASE, 3);
    expect(g.sections[0]).toBe(g.sections[0]); // Start ist fix (siehe core/levelgen.js START_ID)
    const middle = g.sections.slice(1, -1);
    middle.forEach(id => {
      const sec = SEC.SECTIONS.find(s => s.id === id);
      expect(sec.schwierigkeit).toBeLessThanOrEqual(1);
    });
  });

  test('Anzahl Mittelabschnitte liegt in minSections..maxSections', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = LG.generate(BASE, seed);
      const n = g.sections.length - 2; // ohne Start/Ziel
      expect(n).toBeGreaterThanOrEqual(BASE.minSections);
      expect(n).toBeLessThanOrEqual(BASE.maxSections);
    }
  });

  test('Checkpoints: genau ein C pro Abschnitts-Uebergang', () => {
    const g = LG.generate(BASE, 11);
    const L = parseLevel(g.rows);
    expect(L.checkpoints.length).toBe(g.sections.length - 1);
  });

  test('maxDifficulty filtert hoehere Schwierigkeiten komplett heraus', () => {
    const opts = { minDifficulty: 1, maxDifficulty: 2, minSections: 8, maxSections: 10 };
    for (let seed = 1; seed <= 30; seed++) {
      const g = LG.generate(opts, seed);
      g.sections.slice(1, -1).forEach(id => {
        const sec = SEC.SECTIONS.find(s => s.id === id);
        expect(sec.schwierigkeit).toBeLessThanOrEqual(2);
      });
    }
  });
});
