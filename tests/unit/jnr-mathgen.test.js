const M = require('../../jumpnrun/core/mathgen.js');

const slots = n => Array.from({ length: n }, (_, i) => ({ tx: i * 3, ty: 4 }));

describe('assignCrystals', () => {
  test('Modus "aus": alle gut, keine Zahlen', () => {
    const cr = M.assignCrystals(slots(8), { reihe: 7, seed: 1, mode: 'aus' });
    expect(cr).toHaveLength(8);
    cr.forEach(c => { expect(c.good).toBe(true); expect(c.value).toBeNull(); });
  });

  test('übernimmt die Plätze unverändert', () => {
    const s = slots(5);
    const cr = M.assignCrystals(s, { reihe: 3, seed: 1, mode: 'ziel' });
    cr.forEach((c, i) => { expect(c.tx).toBe(s[i].tx); expect(c.ty).toBe(s[i].ty); });
  });

  test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])('Reihe %i: gute Zahlen sind Vielfache, falsche nie', (r) => {
    const cr = M.assignCrystals(slots(24), { reihe: r, seed: 5, mode: 'ziel' });
    cr.forEach(c => {
      expect(c.value).toBeGreaterThan(0);
      expect(c.value).toBeLessThan(1000);
      expect(c.value % r === 0).toBe(c.good);
    });
  });

  test('Verhältnis gut : falsch ist 3 : 1', () => {
    const cr = M.assignCrystals(slots(12), { reihe: 7, seed: 2, mode: 'ziel' });
    expect(cr.filter(c => !c.good)).toHaveLength(3);
    expect(cr.filter(c => c.good)).toHaveLength(9);
  });

  test('falsche Zahlen liegen nah an der Reihe (verwechselbar)', () => {
    const r = 7;
    const cr = M.assignCrystals(slots(40), { reihe: r, seed: 9, mode: 'ziel' });
    cr.filter(c => !c.good).forEach(c => {
      const dist = Math.min(c.value % r, r - (c.value % r));
      expect(dist).toBeLessThanOrEqual(2);
    });
  });

  test('höchstens 3 Stellen, auch bei der 10er-Reihe', () => {
    const cr = M.assignCrystals(slots(60), { reihe: 10, seed: 3, mode: 'ziel' });
    cr.forEach(c => expect(String(c.value).length).toBeLessThanOrEqual(3));
  });

  test.each([2, 3, 4, 5, 6, 7, 8, 9, 10])('Reihe %i: falsche Zahlen sind höchstens zweistellig (<= 99)', (r) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const cr = M.assignCrystals(slots(80), { reihe: r, seed, mode: 'ziel' });
      cr.filter(c => !c.good).forEach(c => expect(c.value).toBeLessThanOrEqual(99));
    }
  });

  test('anzeigeSchrift: dreistellige Zahlen bekommen die schmale Schrift, die in den Kristall passt', () => {
    expect(M.anzeigeSchrift(7)).toEqual({ schrift: 'normal', breite: 5 });
    expect(M.anzeigeSchrift(98)).toEqual({ schrift: 'normal', breite: 11 });
    const s = M.anzeigeSchrift(100);
    expect(s.schrift).toBe('schmal');
    expect(s.breite).toBeLessThanOrEqual(12); // Kristall-Innenfläche ist 12 px breit
  });

  test('bis 10 Kristalle kommen gute Zahlen nicht doppelt vor', () => {
    const cr = M.assignCrystals(slots(10), { reihe: 4, seed: 11, mode: 'ziel' }).filter(c => c.good);
    const vals = cr.map(c => c.value);
    expect(new Set(vals).size).toBe(vals.length);
  });

  test('gleicher Seed ergibt gleiches Ergebnis, anderer Seed andere Zahlen', () => {
    const a = M.assignCrystals(slots(12), { reihe: 6, seed: 4, mode: 'ziel' });
    const b = M.assignCrystals(slots(12), { reihe: 6, seed: 4, mode: 'ziel' });
    const c = M.assignCrystals(slots(12), { reihe: 6, seed: 5, mode: 'ziel' });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  test('ungültige Reihe wirft', () => {
    expect(() => M.assignCrystals(slots(3), { reihe: 1, seed: 1, mode: 'ziel' })).toThrow(/Reihe/);
    expect(() => M.assignCrystals(slots(3), { reihe: 2.5, seed: 1, mode: 'ziel' })).toThrow(/Reihe/);
  });
});

describe('Zielzahl-Text', () => {
  test('targetLabel', () => {
    expect(M.targetLabel(7)).toBe('Sammle die 7er-Reihe');
  });
  test('isMultiple', () => {
    expect(M.isMultiple(56, 7)).toBe(true);
    expect(M.isMultiple(54, 7)).toBe(false);
  });
});

describe('Landestellen bekommen nie eine falsche Zahl', () => {
  const slots = Array.from({ length: 24 }, (_, i) => ({ tx: i, ty: 1, landung: i % 3 === 0 }));
  test('ueber 200 Seeds ist jede Landestelle eine richtige Zahl', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = M.assignCrystals(slots, { reihe: 7, seed, mode: 'ziel' });
      r.forEach((c, i) => { if (slots[i].landung) expect(c.good).toBe(true); });
    }
  });
  test('genug andere Plaetze: Verhaeltnis gut : falsch bleibt 3 : 1', () => {
    const r = M.assignCrystals(slots, { reihe: 7, seed: 5, mode: 'ziel' });
    expect(r.filter(c => !c.good)).toHaveLength(6);
  });
  test('nur Landestellen: keine falsche Zahl', () => {
    const only = slots.map(s => ({ ...s, landung: true }));
    expect(M.assignCrystals(only, { reihe: 7, seed: 5, mode: 'ziel' }).every(c => c.good)).toBe(true);
  });
});
