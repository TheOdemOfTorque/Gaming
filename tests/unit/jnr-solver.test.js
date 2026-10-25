const { parseLevel } = require('../../jumpnrun/core/level.js');
const SOLVER = require('../../jumpnrun/core/solver.js');
const SEC = require('../../jumpnrun/data/sections.js');

function sectionAsLevel(section) {
  const rows = section.rows.map(r => r.split(''));
  rows[6][0] = 'S';
  rows[6][section.rows[0].length - 1] = 'G';
  return parseLevel(rows.map(r => r.join('')));
}

describe('Greedy-Bot (core/solver.js)', () => {
  test('loest ein leeres flaches Level', () => {
    const L = parseLevel(['.......', 'S.....G', '#######']);
    const r = SOLVER.solve(L, { mode: 'aus' });
    expect(r.won).toBe(true);
  });

  test('deterministisch: gleicher Lauf liefert gleiche Framezahl', () => {
    const L = parseLevel(['.......', 'S.....G', '#######']);
    const a = SOLVER.solve(L, { mode: 'aus' });
    const b = SOLVER.solve(L, { mode: 'aus' });
    expect(a.won && b.won).toBe(true);
    expect(a.frames).toBe(b.frames);
  });

  test.each(SEC.SECTIONS.map(s => [s.id, s]))('Abschnitt %s ist fuer sich allein loesbar', (id, section) => {
    const level = sectionAsLevel(section);
    const r = SOLVER.solve(level, { mode: 'aus' });
    expect(r.won).toBe(true);
  });

  test('Gegenprobe: eine zu breite Luecke (6 Kacheln) ist unloesbar', () => {
    const rows = [
      '................',
      'S..............G',
      '###......#######',
    ];
    const level = parseLevel(rows);
    const r = SOLVER.solve(level, { mode: 'aus' }, 600);
    expect(r.won).toBe(false);
  });

  test('Gegenprobe greift auch pro-Abschnitt-Test: unloesbarer Platzhalter-Abschnitt faellt durch', () => {
    const bad = {
      id: 'test-unloesbar',
      rows: [
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '..................',
        '##..............##',
        '##..............##',
      ]
    };
    const level = sectionAsLevel(bad);
    const r = SOLVER.solve(level, { mode: 'aus' });
    expect(r.won).toBe(false);
  });
});
