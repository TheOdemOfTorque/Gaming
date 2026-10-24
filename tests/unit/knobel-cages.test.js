const K = require('../../knobel/knobel-logic.js');

function single(r, c, ziel) { return { zellen: [[r, c]], op: '=', ziel }; }

describe('cageOk', () => {
  test('Plus, Mal, Minus, Geteilt, Einzel', () => {
    expect(K.cageOk({ op: '+', ziel: 7 }, [3, 4])).toBe(true);
    expect(K.cageOk({ op: '+', ziel: 8 }, [3, 4])).toBe(false);
    expect(K.cageOk({ op: '×', ziel: 12 }, [3, 4])).toBe(true);
    expect(K.cageOk({ op: '−', ziel: 1 }, [4, 3])).toBe(true);
    expect(K.cageOk({ op: '−', ziel: 1 }, [3, 4])).toBe(true);
    expect(K.cageOk({ op: '÷', ziel: 2 }, [3, 6])).toBe(true);
    expect(K.cageOk({ op: '÷', ziel: 2 }, [4, 6])).toBe(false);
    expect(K.cageOk({ op: '=', ziel: 5 }, [5])).toBe(true);
  });
});

describe('solveCages (zaehlend)', () => {
  test('eindeutig: lauter Hinweisfelder', () => {
    const p = { n: 3, kaefige: [] };
    const g = [[1, 2, 3], [2, 3, 1], [3, 1, 2]];
    g.forEach((row, r) => row.forEach((v, c) => p.kaefige.push(single(r, c, v))));
    expect(K.solveCages(p, 2)).toBe(1);
  });
  test('mehrdeutig: 2x2 mit einem Plus-Kaefig', () => {
    const p = { n: 2, kaefige: [{ zellen: [[0, 0], [0, 1], [1, 0], [1, 1]], op: '+', ziel: 6 }] };
    expect(K.solveCages(p, 2)).toBe(2);
    expect(K.solveCages(p, 1)).toBe(1);
  });
  test('unloesbar: zwei gleiche Hinweise in einer Zeile', () => {
    const p = { n: 3, kaefige: [single(0, 0, 1), single(0, 1, 1)] };
    p.kaefige.push({ zellen: [[0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]].slice(0, 1), op: '=', ziel: 3 });
    expect(K.solveCages(p, 2)).toBe(0);
  });
  test('Mal-Kaefig mit Latin-Regel liefert genau eine Loesung', () => {
    // 3x3: Zeile 0 = Kaefig x6 ueber (0,0),(0,1),(0,2) ergibt jede Permutation; Eindeutigkeit durch Hinweise
    const p = { n: 3, kaefige: [
      { zellen: [[0, 0], [0, 1], [0, 2]], op: '×', ziel: 6 },
      single(1, 0, 2), single(1, 1, 3), single(1, 2, 1),
      single(2, 0, 3), single(2, 1, 1), single(2, 2, 2)
    ] };
    expect(K.solveCages(p, 2)).toBe(1);
  });
});

describe('logicSolveCages', () => {
  test('loest ein Hinweis-Raetsel ohne Raten', () => {
    const p = { n: 3, kaefige: [
      { zellen: [[0, 0], [0, 1]], op: '×', ziel: 6 },
      single(0, 2, 1),
      { zellen: [[1, 0], [1, 1], [1, 2]], op: '+', ziel: 6 },
      single(2, 0, 3), single(2, 1, 1), single(2, 2, 2)
    ] };
    const r = K.logicSolveCages(p);
    expect(r.geloest).toBe(true);
    expect(r.grid).toEqual([[2, 3, 1], [1, 2, 3], [3, 1, 2]]);
    expect(K.solveCages(p, 2)).toBe(1);
  });
  test('mehrdeutiges Raetsel ist nicht ohne Raten loesbar', () => {
    const p = { n: 2, kaefige: [{ zellen: [[0, 0], [0, 1], [1, 0], [1, 1]], op: '+', ziel: 6 }] };
    expect(K.logicSolveCages(p).geloest).toBe(false);
  });
});

describe('generateCages', () => {
  for (let stufe = 1; stufe <= 5; stufe++) {
    const ANZ = stufe === 5 ? 60 : 100;
    test(`Stufe ${stufe}: ${ANZ} Seeds gueltig, eindeutig, Latin, Kaefige lueckenlos`, () => {
      const P = K.STUFEN.kaefige[stufe];
      for (let seed = 1; seed <= ANZ; seed++) {
        const p = K.generateCages(stufe, K.mulberry32(seed));
        const n = p.n;
        expect(n).toBe(P.n);
        // Latin-Regel in der Loesung
        for (let i = 0; i < n; i++) {
          expect(new Set(p.loesung[i]).size).toBe(n);
          expect(new Set(p.loesung.map(r => r[i])).size).toBe(n);
        }
        // Kaefige decken jede Zelle genau einmal ab und sind zusammenhaengend
        const seen = new Set();
        p.kaefige.forEach(k => {
          k.zellen.forEach(([r, c]) => { const key = r + ',' + c; expect(seen.has(key)).toBe(false); seen.add(key); });
          expect(K.zellenZusammenhaengend(k.zellen)).toBe(true);
          expect(K.cageOk(k, k.zellen.map(([r, c]) => p.loesung[r][c]))).toBe(true);
        });
        expect(seen.size).toBe(n * n);
        expect(K.solveCages(p, 2)).toBe(1);
        if (stufe < 5) expect(K.logicSolveCages(p).geloest).toBe(true);
      }
    });
  }
  test('gleicher Seed ergibt gleiches Raetsel', () => {
    expect(K.generateCages(3, K.mulberry32(5))).toEqual(K.generateCages(3, K.mulberry32(5)));
  });
  test('Stufe 3+ enthaelt Geteilt/Minus, Stufe 1 nicht', () => {
    const ops = s => { const o = new Set(); for (let i = 1; i <= 60; i++) K.generateCages(s, K.mulberry32(i)).kaefige.forEach(k => o.add(k.op)); return o; };
    expect(ops(1).has('÷')).toBe(false);
    expect(ops(1).has('−')).toBe(false);
    const o3 = ops(3);
    expect(o3.has('÷') || o3.has('−')).toBe(true);
  });
  test('Laufzeit je Raetsel (Stufe 5) unter 500 ms im Schnitt', () => {
    const t0 = Date.now();
    for (let s = 1; s <= 10; s++) K.generateCages(5, K.mulberry32(s));
    expect((Date.now() - t0) / 10).toBeLessThan(500);
  });
});
