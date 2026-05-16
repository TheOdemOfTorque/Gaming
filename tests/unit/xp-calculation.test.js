const { computeAnswerXP, nextStarCost, STAR_COSTS } = require('../../1x1-trainer/logic.js');

describe('computeAnswerXP', () => {
  describe('Combo-Tiers (mult/training/blitz — kein Multiplikator)', () => {
    test('combo=0 → 5 XP', () => {
      expect(computeAnswerXP(0, 'training')).toBe(5);
    });
    test('combo=1 → 5 XP', () => {
      expect(computeAnswerXP(1, 'training')).toBe(5);
    });
    test('combo=2 → 5 XP (Boundary unter Tier 1)', () => {
      expect(computeAnswerXP(2, 'training')).toBe(5);
    });
    test('combo=3 → 7 XP (Tier 1 startet)', () => {
      expect(computeAnswerXP(3, 'training')).toBe(7);
    });
    test('combo=4 → 7 XP', () => {
      expect(computeAnswerXP(4, 'training')).toBe(7);
    });
    test('combo=5 → 9 XP (Tier 2 startet)', () => {
      expect(computeAnswerXP(5, 'training')).toBe(9);
    });
    test('combo=9 → 9 XP', () => {
      expect(computeAnswerXP(9, 'training')).toBe(9);
    });
    test('combo=10 → 13 XP (Tier 3 startet, Max-Tier)', () => {
      expect(computeAnswerXP(10, 'training')).toBe(13);
    });
    test('combo=100 → 13 XP (Tier 3 hat keinen weiteren Sprung)', () => {
      expect(computeAnswerXP(100, 'training')).toBe(13);
    });
  });

  describe('Modus-Multiplikator', () => {
    test('blitz: identisch zu training (kein Multiplikator)', () => {
      [0, 3, 5, 10].forEach(combo => {
        expect(computeAnswerXP(combo, 'blitz')).toBe(computeAnswerXP(combo, 'training'));
      });
    });
    test('turnier: 1.3× (gerundet)', () => {
      expect(computeAnswerXP(0, 'turnier')).toBe(Math.round(5 * 1.3));   // 7
      expect(computeAnswerXP(3, 'turnier')).toBe(Math.round(7 * 1.3));   // 9
      expect(computeAnswerXP(5, 'turnier')).toBe(Math.round(9 * 1.3));   // 12
      expect(computeAnswerXP(10, 'turnier')).toBe(Math.round(13 * 1.3)); // 17
    });
    test('unbekannter Modus: kein Multiplikator (Fallback)', () => {
      expect(computeAnswerXP(10, 'whatever')).toBe(13);
    });
  });
});

describe('nextStarCost', () => {
  test('Star 0 → erster STAR_COSTS-Eintrag', () => {
    expect(nextStarCost(0)).toBe(STAR_COSTS[0]);
  });
  test('Star 1 → zweiter STAR_COSTS-Eintrag', () => {
    expect(nextStarCost(1)).toBe(STAR_COSTS[1]);
  });
  test('Star 2 → dritter Eintrag', () => {
    expect(nextStarCost(2)).toBe(STAR_COSTS[2]);
  });
  test('Star 3 → vierter Eintrag', () => {
    expect(nextStarCost(3)).toBe(STAR_COSTS[3]);
  });
  test('Star 4 (Cap erreicht) → letzter Eintrag bleibt', () => {
    expect(nextStarCost(4)).toBe(STAR_COSTS[STAR_COSTS.length - 1]);
  });
  test('Star 100 (weit über Cap) → letzter Eintrag', () => {
    expect(nextStarCost(100)).toBe(STAR_COSTS[STAR_COSTS.length - 1]);
  });
});
