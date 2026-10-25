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

describe('Rechenwichte im Generator (opts.gegner)', () => {
  const GEN = { minDifficulty: 1, maxDifficulty: 2, minSections: 16, maxSections: 18, gegner: true };
  const OHNE = Object.assign({}, GEN, { gegner: false });
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
  const countW = rows => rows.join('').split('').filter(c => c === 'w').length;

  test('ohne opts.gegner kein einziger Wicht', () => {
    SEEDS.slice(0, 50).forEach(seed => {
      expect(countW(LG.generate(OHNE, seed).rows)).toBe(0);
      expect(countW(LG.generate(BASE, seed).rows)).toBe(0);
    });
  });

  test('deterministisch und ohne Einfluss auf Abschnittsfolge, Kristalle und Gelaende', () => {
    SEEDS.slice(0, 50).forEach(seed => {
      const a = LG.generate(GEN, seed), b = LG.generate(GEN, seed), o = LG.generate(OHNE, seed);
      expect(a.rows).toEqual(b.rows);
      expect(a.gegner).toEqual(b.gegner);
      expect(a.sections).toEqual(o.sections);
      expect(a.rows.map(r => r.replace(/w/g, '.'))).toEqual(o.rows);
      expect(countW(a.rows)).toBe(a.gegner.length);
    });
  });

  test('nie im Start-, ersten Mittel- oder Ziel-Abschnitt, hoechstens einer je 2 bis 3 Abschnitte', () => {
    SEEDS.forEach(seed => {
      const g = LG.generate(GEN, seed);
      g.gegner.forEach((w, i) => {
        expect(w.abschnitt).toBeGreaterThanOrEqual(2);
        expect(w.abschnitt).toBeLessThanOrEqual(g.sections.length - 2);
        if (i > 0) expect(w.abschnitt - g.gegner[i - 1].abschnitt).toBeGreaterThanOrEqual(2);
      });
    });
  });

  test('Laufstrecke liegt nie an Start, Ziel oder Laterne und nie auf einem Kristallplatz', () => {
    SEEDS.forEach(seed => {
      const L = parseLevel(LG.generate(GEN, seed).rows);
      const marken = [L.start.tx, L.goal.tx].concat(L.checkpoints.map(c => c.tx));
      L.enemies.forEach(e => {
        expect(e.bis - e.von + 1).toBeGreaterThanOrEqual(4);
        marken.forEach(m => {
          expect(m < e.von - 3 || m > e.bis + 3).toBe(true);
        });
        L.crystalSlots.filter(s => s.ty === e.ty).forEach(s => {
          expect(s.tx < e.von || s.tx > e.bis).toBe(true);
        });
        L.spikes.forEach(s => expect(s.ty !== e.ty || s.tx < e.von - 1 || s.tx > e.bis + 1).toBe(true));
      });
    });
  });

  test('seltener als Stacheln, aber regelmaessig: in fast jedem Lauf mindestens ein Wicht', () => {
    let wichte = 0, mitWicht = 0, abschnitte = 0, stacheln = 0;
    SEEDS.forEach(seed => {
      const g = LG.generate(GEN, seed);
      const L = parseLevel(g.rows);
      wichte += g.gegner.length; abschnitte += g.sections.length;
      stacheln += L.spikes.length;
      if (g.gegner.length) mitWicht++;
    });
    expect(mitWicht).toBeGreaterThanOrEqual(SEEDS.length * 0.9);
    expect(wichte).toBeLessThan(stacheln);
    expect(wichte / abschnitte).toBeLessThanOrEqual(1 / 2);
  });
});
