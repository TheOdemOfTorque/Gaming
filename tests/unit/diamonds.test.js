const { nextDiamondCost, canBuyDiamond, DIAMOND_PRICE, DIAMOND_CAP,
        defaultState } = require('../../1x1-trainer/logic.js');

describe('nextDiamondCost', () => {
  test('Fix-Preis DIAMOND_PRICE solange unter Cap', () => {
    expect(nextDiamondCost(0)).toBe(DIAMOND_PRICE);
    expect(nextDiamondCost(1)).toBe(DIAMOND_PRICE);
    expect(nextDiamondCost(2)).toBe(DIAMOND_PRICE);
  });

  test('liefert null bei oder über Cap (Kauf nicht möglich)', () => {
    expect(nextDiamondCost(DIAMOND_CAP)).toBeNull();
    expect(nextDiamondCost(DIAMOND_CAP + 5)).toBeNull();
  });

  test('undefined/null wird als 0 behandelt', () => {
    expect(nextDiamondCost(undefined)).toBe(DIAMOND_PRICE);
    expect(nextDiamondCost(null)).toBe(DIAMOND_PRICE);
  });
});

describe('canBuyDiamond', () => {
  test('genug XP + unter Cap → true', () => {
    expect(canBuyDiamond({ xp: 2000, diamonds: 0 })).toBe(true);
    expect(canBuyDiamond({ xp: 5000, diamonds: 2 })).toBe(true);
  });

  test('zu wenig XP → false', () => {
    expect(canBuyDiamond({ xp: 1999, diamonds: 0 })).toBe(false);
    expect(canBuyDiamond({ xp: 0, diamonds: 0 })).toBe(false);
  });

  test('Cap erreicht → false unabhängig von XP', () => {
    expect(canBuyDiamond({ xp: 99999, diamonds: DIAMOND_CAP })).toBe(false);
    expect(canBuyDiamond({ xp: 99999, diamonds: DIAMOND_CAP + 1 })).toBe(false);
  });

  test('exakt Preis-Match → true', () => {
    expect(canBuyDiamond({ xp: DIAMOND_PRICE, diamonds: 0 })).toBe(true);
  });
});

describe('defaultState diamonds', () => {
  test('startet mit 0', () => {
    expect(defaultState().diamonds).toBe(0);
  });
});

describe('DIAMOND_PRICE / DIAMOND_CAP', () => {
  test('Konstanten haben sinnvolle Werte', () => {
    expect(DIAMOND_PRICE).toBe(2000);
    expect(DIAMOND_CAP).toBe(3);
  });
});
