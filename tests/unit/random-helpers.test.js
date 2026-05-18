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
