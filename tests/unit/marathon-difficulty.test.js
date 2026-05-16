const { marathonDifficulty } = require('../../1x1-trainer/logic.js');

describe('marathonDifficulty', () => {
  test('qCount=0 → 3 (Start)', () => {
    expect(marathonDifficulty(0, 20)).toBe(3);
  });

  test('qCount=5 → 8 (3 + floor(sqrt(25)))', () => {
    expect(marathonDifficulty(5, 20)).toBe(8);
  });

  test('qCount=20 → 13 (3 + floor(sqrt(100)))', () => {
    expect(marathonDifficulty(20, 20)).toBe(13);
  });

  test('qCount=50 → 18 (3 + floor(sqrt(250)))', () => {
    expect(marathonDifficulty(50, 20)).toBe(18);
  });

  test('qCount=100 → cap bei maxReihe=20', () => {
    expect(marathonDifficulty(100, 20)).toBe(20);
  });

  test('qCount=1000 → cap hält, auch bei extremen Werten', () => {
    expect(marathonDifficulty(1000, 20)).toBe(20);
  });

  test('Monotonie: höhere qCount ⇒ höhere oder gleiche difficulty', () => {
    let prev = marathonDifficulty(0, 20);
    for (let q = 1; q < 200; q++) {
      const cur = marathonDifficulty(q, 20);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  test('Cap an maxReihe wirkt früher bei kleinem 1×1 (maxReihe=10)', () => {
    expect(marathonDifficulty(100, 10)).toBe(10);
    expect(marathonDifficulty(50, 10)).toBe(10);  // bereits gecappt
    expect(marathonDifficulty(20, 10)).toBe(10);  // 13 wäre raw, gecappt auf 10
  });

  test('Sublinear: 4-Fache qCount führt zu ~2× difficulty (sqrt-Eigenschaft)', () => {
    const d20 = marathonDifficulty(20, 100);   // 3 + 10 = 13
    const d80 = marathonDifficulty(80, 100);   // 3 + 20 = 23
    expect(d80 - 3).toBeCloseTo(2 * (d20 - 3), 0); // (23-3) ≈ 2 * (13-3)
  });
});
