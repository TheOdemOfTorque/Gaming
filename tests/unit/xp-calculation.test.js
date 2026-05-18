const { computeAnswerXP, nextStarCost, STAR_COSTS, XP_MODE_MULTIPLIERS } =
  require('../../1x1-trainer/logic.js');

describe('computeAnswerXP', () => {
  describe('Basis-XP nach Combo-Tier (vor Multiplikator)', () => {
    // 'unknown' triggert den 1.0-Fallback, so dass wir die unveränderte Basis sehen
    test('combo 0..2 → Basis 5', () => {
      expect(computeAnswerXP(0, 'unknown')).toBe(5);
      expect(computeAnswerXP(1, 'unknown')).toBe(5);
      expect(computeAnswerXP(2, 'unknown')).toBe(5);
    });
    test('combo 3..4 → Basis 7', () => {
      expect(computeAnswerXP(3, 'unknown')).toBe(7);
      expect(computeAnswerXP(4, 'unknown')).toBe(7);
    });
    test('combo 5..9 → Basis 9', () => {
      expect(computeAnswerXP(5, 'unknown')).toBe(9);
      expect(computeAnswerXP(9, 'unknown')).toBe(9);
    });
    test('combo >= 10 → Basis 13 (Max-Tier)', () => {
      expect(computeAnswerXP(10, 'unknown')).toBe(13);
      expect(computeAnswerXP(100, 'unknown')).toBe(13);
    });
  });

  describe('Modus-Multiplikatoren (Recalibration 2026-05-16)', () => {
    test('training: ×1.5 (Lernen belohnen)', () => {
      expect(XP_MODE_MULTIPLIERS.training).toBe(1.5);
      expect(computeAnswerXP(0, 'training')).toBe(Math.round(5 * 1.5));   // 8
      expect(computeAnswerXP(3, 'training')).toBe(Math.round(7 * 1.5));   // 11
      expect(computeAnswerXP(5, 'training')).toBe(Math.round(9 * 1.5));   // 14
      expect(computeAnswerXP(10, 'training')).toBe(Math.round(13 * 1.5)); // 20
    });
    test('blitz: ×0.4 (Speed-Drill dämpfen)', () => {
      expect(XP_MODE_MULTIPLIERS.blitz).toBe(0.4);
      expect(computeAnswerXP(0, 'blitz')).toBe(Math.round(5 * 0.4));   // 2
      expect(computeAnswerXP(3, 'blitz')).toBe(Math.round(7 * 0.4));   // 3
      expect(computeAnswerXP(5, 'blitz')).toBe(Math.round(9 * 0.4));   // 4
      expect(computeAnswerXP(10, 'blitz')).toBe(Math.round(13 * 0.4)); // 5
    });
    test('turnier: ×1.3 (unverändert)', () => {
      expect(XP_MODE_MULTIPLIERS.turnier).toBe(1.3);
      expect(computeAnswerXP(0, 'turnier')).toBe(Math.round(5 * 1.3));   // 7
      expect(computeAnswerXP(3, 'turnier')).toBe(Math.round(7 * 1.3));   // 9
      expect(computeAnswerXP(5, 'turnier')).toBe(Math.round(9 * 1.3));   // 12
      expect(computeAnswerXP(10, 'turnier')).toBe(Math.round(13 * 1.3)); // 17
    });
    test('unbekannter Modus: 1.0-Fallback', () => {
      expect(computeAnswerXP(10, 'whatever')).toBe(13);
      expect(computeAnswerXP(0, '')).toBe(5);
    });
  });

  describe('Iron-Rule-Check (training-bevorzugung)', () => {
    test('training/min > blitz/min für identische Combo', () => {
      // Bei combo=10 (Max): training=20, blitz=5 → Faktor 4x
      expect(computeAnswerXP(10, 'training')).toBeGreaterThan(computeAnswerXP(10, 'blitz'));
    });
    test('turnier > blitz bei jedem Tier', () => {
      [0, 3, 5, 10].forEach(c => {
        expect(computeAnswerXP(c, 'turnier')).toBeGreaterThan(computeAnswerXP(c, 'blitz'));
      });
    });
  });
});

describe('nextStarCost', () => {
  test('Star 0 → STAR_COSTS[0] (2400)', () => {
    expect(nextStarCost(0)).toBe(STAR_COSTS[0]);
    expect(STAR_COSTS[0]).toBe(2400);
  });
  test('Star 1 → STAR_COSTS[1] (4200)', () => {
    expect(nextStarCost(1)).toBe(STAR_COSTS[1]);
    expect(STAR_COSTS[1]).toBe(4200);
  });
  test('Star 2 → STAR_COSTS[2] (6000)', () => {
    expect(nextStarCost(2)).toBe(STAR_COSTS[2]);
    expect(STAR_COSTS[2]).toBe(6000);
  });
  test('Star 3 → STAR_COSTS[3] (8400)', () => {
    expect(nextStarCost(3)).toBe(STAR_COSTS[3]);
    expect(STAR_COSTS[3]).toBe(8400);
  });
  test('Star 4+ (Cap) → letzter Eintrag', () => {
    expect(nextStarCost(4)).toBe(8400);
    expect(nextStarCost(100)).toBe(8400);
  });
  test('Cumulative für 4 Stars: 21000 XP gesamt', () => {
    const total = STAR_COSTS.reduce((s, c) => s + c, 0);
    expect(total).toBe(21000);
  });
});
