const { resolveRechenart, migrateDivState } = require('../../.worktrees/feature-division/1x1-trainer/logic.js');

describe('resolveRechenart', () => {
  test('gibt mult zurück wenn rechenart mult', () => {
    expect(resolveRechenart({ rechenart: 'mult' })).toBe('mult');
  });

  test('gibt div zurück wenn rechenart div', () => {
    expect(resolveRechenart({ rechenart: 'div' })).toBe('div');
  });

  test('gibt mult oder div zurück bei gemischt', () => {
    const results = new Set();
    for (let i = 0; i < 200; i++) results.add(resolveRechenart({ rechenart: 'gemischt' }));
    expect(results.has('mult')).toBe(true);
    expect(results.has('div')).toBe(true);
    expect(results.has('gemischt')).toBe(false);
  });

  test('default ist mult wenn cfg undefined', () => {
    expect(resolveRechenart({})).toBe('mult');
    expect(resolveRechenart(null)).toBe('mult');
  });
});

describe('migrateDivState', () => {
  test('fügt trainingConfig und turnierConfig hinzu', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true, rechenart: 'mult' }, highScores: {}, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.trainingConfig).toEqual({ rechenart: 'mult' });
    expect(result.turnierConfig).toEqual({ rechenart: 'mult' });
  });

  test('fügt blitzConfig.rechenart hinzu wenn fehlend', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true }, highScores: {}, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.blitzConfig.rechenart).toBe('mult');
  });

  test('überschreibt vorhandene blitzConfig.rechenart nicht', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true, rechenart: 'div' }, highScores: {}, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.blitzConfig.rechenart).toBe('div');
  });

  test('fügt Highscore-Felder hinzu', () => {
    const s = { blitzConfig: { reihen: [], alleReihen: true }, highScores: { blitz: 5 }, reiheStats: {} };
    const result = migrateDivState(s);
    expect(result.highScores.blitzDiv).toBe(0);
    expect(result.highScores.blitzGemischt).toBe(0);
    expect(result.highScores.turnierDiv).toBe(0);
    expect(result.highScores.turnierGemischt).toBe(0);
  });

  test('fügt reiheStats-Div-Felder hinzu', () => {
    const s = { blitzConfig: {}, highScores: {}, reiheStats: { 3: { sessions: 2, consecutivePerfect: 4 } } };
    const result = migrateDivState(s);
    expect(result.reiheStats[3].divConsecutivePerfect).toBe(0);
    expect(result.reiheStats[3].divCorrect).toBe(0);
    expect(result.reiheStats[3].divWrong).toBe(0);
    expect(result.reiheStats[3].consecutivePerfect).toBe(4); // bestehend bleibt
  });

  test('überschreibt vorhandene divFelder nicht', () => {
    const s = { blitzConfig: {}, highScores: {}, reiheStats: { 5: { divConsecutivePerfect: 3 } } };
    const result = migrateDivState(s);
    expect(result.reiheStats[5].divConsecutivePerfect).toBe(3);
  });
});
