const { resolveRechenart } = require('../../1x1-trainer/logic.js');

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
