const K = require('../../knobel/knobel-logic.js');

describe('mulberry32 / Hilfsfunktionen', () => {
  test('gleicher Seed ergibt gleiche Folge', () => {
    const a = K.mulberry32(42), b = K.mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
  test('randInt bleibt im Bereich', () => {
    const r = K.mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const v = K.randInt(r, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
  test('shuffle ist eine Permutation und deterministisch', () => {
    const x = K.shuffle(K.mulberry32(7), [1, 2, 3, 4, 5, 6]);
    expect([...x].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(K.shuffle(K.mulberry32(7), [1, 2, 3, 4, 5, 6])).toEqual(x);
  });
});

describe('buildPyramid', () => {
  test('Produktpyramide aus bekannten Basiswerten', () => {
    const rows = K.buildPyramid([2, 3, 4], ['', 'mul', 'mul']);
    expect(rows).toEqual([[2, 3, 4], [6, 12], [72]]);
  });
  test('additive Reihe', () => {
    const rows = K.buildPyramid([2, 3, 4], ['', 'mul', 'add']);
    expect(rows).toEqual([[2, 3, 4], [6, 12], [18]]);
  });
});

describe('solvePyramid (zaehlend)', () => {
  const regeln = ['', 'mul', 'mul'];
  const dom = { fmin: 1, fmax: 9 };
  function puz(gegeben) { return { n: 3, regeln, gegeben, ...dom }; }
  test('eindeutig: alle Basiswerte gegeben', () => {
    expect(K.solvePyramid(puz([[2, 3, 4], [null, null], [null]]), 2)).toBe(1);
  });
  test('mehrdeutig: nur die Spitze gegeben', () => {
    expect(K.solvePyramid(puz([[null, null, null], [null, null], [72]]), 2)).toBe(2);
  });
  test('unloesbar: widerspruechliche Hinweise', () => {
    expect(K.solvePyramid(puz([[2, 3, 4], [7, null], [null]]), 2)).toBe(0);
  });
  test('Zaehlung bricht bei max ab', () => {
    expect(K.solvePyramid(puz([[null, null, null], [null, null], [null]]), 3)).toBe(3);
  });
});

describe('logicSolvePyramid', () => {
  test('Dreiecksregel loest Quotienten', () => {
    const p = { n: 3, regeln: ['', 'mul', 'mul'], gegeben: [[2, null, null], [6, null], [72]] };
    const r = K.logicSolvePyramid(p);
    expect(r.geloest).toBe(true);
    expect(r.zeilen).toEqual([[2, 3, 4], [6, 12], [72]]);
    expect(r.schritte).toBeGreaterThan(0);
  });
  test('ohne genug Hinweise nicht loesbar', () => {
    const p = { n: 3, regeln: ['', 'mul', 'mul'], gegeben: [[null, null, null], [null, null], [72]] };
    expect(K.logicSolvePyramid(p).geloest).toBe(false);
  });
  test('nicht ganzzahliger Quotient wird nicht abgeleitet', () => {
    const p = { n: 3, regeln: ['', 'mul', 'mul'], gegeben: [[5, null, null], [7, null], [null]] };
    expect(K.logicSolvePyramid(p).geloest).toBe(false);
  });
});

describe('generatePyramid', () => {
  const ANZ = 200;
  for (let stufe = 1; stufe <= 5; stufe++) {
    test(`Stufe ${stufe}: ${ANZ} Seeds eindeutig, Parameter eingehalten`, () => {
      const P = K.STUFEN.mauer[stufe];
      for (let seed = 1; seed <= ANZ; seed++) {
        const p = K.generatePyramid(stufe, K.mulberry32(seed));
        expect(p.n).toBe(P.n);
        expect(p.loesung.length).toBe(P.n);
        expect(K.solvePyramid(p, 2)).toBe(1);
        if (stufe < 5) expect(K.logicSolvePyramid(p).geloest).toBe(true);
        const spitze = p.loesung[P.n - 1][0];
        expect(spitze).toBeLessThanOrEqual(9999);
        p.loesung[0].forEach(b => {
          expect(b).toBeGreaterThanOrEqual(P.fmin);
          expect(b).toBeLessThanOrEqual(P.fmax);
        });
        expect(p.loesung[0].filter(b => b === 1).length).toBeLessThanOrEqual(1);
        // gegebene Zellen stimmen mit der Loesung ueberein
        p.gegeben.forEach((row, r) => row.forEach((v, c) => {
          if (v !== null) expect(v).toBe(p.loesung[r][c]);
        }));
        if (!P.nurMitte) {
          const sichtbarRand = p.gegeben[0].some(v => v !== null) || p.gegeben[P.n - 1][0] !== null;
          expect(sichtbarRand).toBe(true);
        }
      }
    });
  }
  test('gleicher Seed ergibt gleiches Raetsel', () => {
    const a = K.generatePyramid(3, K.mulberry32(99));
    const b = K.generatePyramid(3, K.mulberry32(99));
    expect(a).toEqual(b);
  });
  test('Laufzeit je Raetsel unter 500 ms (Stufe 5)', () => {
    const t0 = Date.now();
    for (let s = 1; s <= 20; s++) K.generatePyramid(5, K.mulberry32(s));
    expect((Date.now() - t0) / 20).toBeLessThan(500);
  });
});
