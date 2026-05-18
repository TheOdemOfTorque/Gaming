const { getLevelInfo, LEVELS, STAR_COSTS } = require('../../1x1-trainer/logic.js');

describe('LEVELS', () => {
  test('10 Level, aufsteigend nach xp sortiert', () => {
    expect(LEVELS).toHaveLength(10);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].xp).toBeGreaterThan(LEVELS[i-1].xp);
    }
  });

  test('LEVELS[0].xp === 0', () => {
    expect(LEVELS[0].xp).toBe(0);
  });
});

describe('STAR_COSTS', () => {
  test('4 Werte aufsteigend', () => {
    expect(STAR_COSTS).toHaveLength(4);
    for (let i = 1; i < STAR_COSTS.length; i++) {
      expect(STAR_COSTS[i]).toBeGreaterThan(STAR_COSTS[i-1]);
    }
  });
});

describe('getLevelInfo', () => {
  test('xp=0 → Level 1', () => {
    expect(getLevelInfo(0).level).toBe(1);
  });

  test('xp=200 → Level 2 (Boundary unten)', () => {
    expect(getLevelInfo(200).level).toBe(2);
  });

  test('xp=199 → Level 1 (Boundary oben Level 1)', () => {
    expect(getLevelInfo(199).level).toBe(1);
  });

  test('xp=6500 → Level 10 (Top), progress=1, kein next-Level-Bedarf', () => {
    const info = getLevelInfo(6500);
    expect(info.level).toBe(10);
    expect(info.progress).toBe(1);
  });

  test('xp=100 → progress reflects 100/200', () => {
    const info = getLevelInfo(100);
    expect(info.level).toBe(1);
    expect(info.xpIn).toBe(100);
    expect(info.xpNeed).toBe(200);
    expect(info.progress).toBeCloseTo(0.5);
  });

  test('returnt title und avatar aus LEVELS', () => {
    const info = getLevelInfo(0);
    expect(info.title).toBe(LEVELS[0].title);
    expect(info.avatar).toBe(LEVELS[0].avatar);
  });
});
