const { shuffle, rnd } = require('../../1x1-trainer/logic.js');

describe('shuffle', () => {
  test('Länge bleibt gleich', () => {
    expect(shuffle([1,2,3,4,5])).toHaveLength(5);
  });

  test('alle Elemente bleiben (mengentheoretisch)', () => {
    const result = shuffle([1,2,3,4,5]);
    expect(result.sort()).toEqual([1,2,3,4,5]);
  });

  test('mutiert Input (bewusst)', () => {
    const input = [1,2,3];
    const result = shuffle(input);
    expect(result).toBe(input);
  });

  test('leeres Array bleibt leer', () => {
    expect(shuffle([])).toEqual([]);
  });
});

describe('rnd', () => {
  test('Ergebnis liegt in [min, max]', () => {
    for (let i = 0; i < 100; i++) {
      const r = rnd(1, 10);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(10);
      expect(Number.isInteger(r)).toBe(true);
    }
  });

  test('min === max liefert min', () => {
    expect(rnd(5, 5)).toBe(5);
  });
});

describe('zieheOhneWiederholung', () => {
  const { zieheOhneWiederholung, initSeededRNG, resetRNG } = require('../../1x1-trainer/logic.js');
  afterEach(() => resetRNG());

  test('liefert nie dasselbe Paar wie die letzte Aufgabe (eine Reihe, 2000 Ziehungen)', () => {
    initSeededRNG(7);
    let letzte = null;
    for (let i = 0; i < 2000; i++) {
      const q = zieheOhneWiederholung(() => ({ a: 6, b: rnd(1, 10) }), letzte);
      if (letzte) expect(q.a === letzte.a && q.b === letzte.b).toBe(false);
      letzte = q;
    }
  });

  test('ohne letzte Aufgabe wird genau einmal gezogen', () => {
    const ziehen = jest.fn(() => ({ a: 2, b: 3 }));
    expect(zieheOhneWiederholung(ziehen, null)).toEqual({ a: 2, b: 3 });
    expect(ziehen).toHaveBeenCalledTimes(1);
  });

  test('Pool mit nur einem Paar: keine Endlosschleife, liefert das Paar', () => {
    const ziehen = jest.fn(() => ({ a: 2, b: 2 }));
    expect(zieheOhneWiederholung(ziehen, { a: 2, b: 2 }, 20)).toEqual({ a: 2, b: 2 });
    expect(ziehen).toHaveBeenCalledTimes(20);
  });
});
