const { getMaxReihe, getMaxFactor } = require('../../1x1-trainer/logic.js');

describe('getMaxReihe', () => {
  test('grosses1x1=false → 10', () => {
    expect(getMaxReihe({ grosses1x1: false })).toBe(10);
  });

  test('grosses1x1=true → 20', () => {
    expect(getMaxReihe({ grosses1x1: true })).toBe(20);
  });
});

describe('getMaxFactor', () => {
  test('grosses1x1=false → 10 unabhängig von reihe', () => {
    expect(getMaxFactor({ grosses1x1: false, reiheMax: {} }, 5)).toBe(10);
  });

  test('grosses1x1=true → reiheMax[reihe]', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: { 3: 15 } }, 3)).toBe(15);
  });

  test('grosses1x1=true, reiheMax[reihe] fehlt → 20 (Fallback)', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: {} }, 7)).toBe(20);
  });

  test('grosses1x1=true, reiheMax[reihe]=0 → 20 (|| 20-Fallback)', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: { 3: 0 } }, 3)).toBe(20);
  });
});
