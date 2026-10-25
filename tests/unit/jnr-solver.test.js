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

describe('Greedy-Bot mit Energie und Leben', () => {
  test('springt ueber einen falschen Kristall am Boden und verliert keine Energie', () => {
    const L = parseLevel(['..........', 'S....o...G', '##########']);
    const r = SOLVER.solve(L, { crystals: [{ tx: 5, ty: 1, value: 5, good: false }] });
    expect(r.won).toBe(true);
    expect(r.game.fehltreffer).toBe(0);
    expect(r.game.crystals[0].state).toBe('da');
  });

  test('sammelt gute Kristalle am Boden weiterhin ein (springt nicht unnoetig)', () => {
    const L = parseLevel(['..........', 'S....o...G', '##########']);
    const r = SOLVER.solve(L, { crystals: [{ tx: 5, ty: 1, value: 4, good: true }] });
    expect(r.won).toBe(true);
    expect(r.game.richtig).toBe(1);
  });

  test('falscher Kristall direkt vor einer Luecke: kein Sturz, kein Lebensverlust', () => {
    const L = parseLevel(['................', 'S....o.........G', '#######..#######']);
    const r = SOLVER.solve(L, { crystals: [{ tx: 5, ty: 1, value: 5, good: false }] });
    expect(r.won).toBe(true);
    expect(r.game.leben).toBe(3);
  });

  test('solve zaehlt die Schadensquellen des echten Laufs (nicht der Vorausschau)', () => {
    // Decke direkt ueber Lumo: der falsche Kristall laesst sich nicht ueberspringen
    const L = parseLevel(['##########', 'S....o...G', '##########']);
    const r = SOLVER.solve(L, { crystals: [{ tx: 5, ty: 1, value: 5, good: false }] });
    expect(r.won).toBe(true);
    expect(r.schaden).toEqual({ kristall: 1 });
    const P = parseLevel(['.................', 'S...............G', '###..........####']);
    const q = SOLVER.solve(P, { mode: 'aus' }, 5000);
    expect(q.schaden).toEqual({});
    expect(q.game.leben).toBe(0);
  });

  test('ein verlorener Lauf bricht die Suche sofort ab', () => {
    const PIT = parseLevel(['.................', 'S...............G', '###..........####']);
    const r = SOLVER.solve(PIT, { mode: 'aus' }, 5000);
    expect(r.won).toBe(false);
    expect(r.game.status).toBe('lost');
    expect(r.frames).toBeLessThan(5000);
  });
});

describe('Greedy-Bot mit Rechenwichten', () => {
  test.each([
    ['flach', ['......................', 'S..........w.........G', '######################']],
    ['zwei Wichte', ['..................................', 'S..........w...........w.........G', '##################################']],
  ])('%s: weicht dem Wicht aus oder stampft, ohne Energie an ihn zu verlieren', (name, rows) => {
    const L = parseLevel(rows);
    const r = SOLVER.solve(L, { mode: 'aus' });
    expect(r.won).toBe(true);
    // ohne falsche Zahlen und Dornen kann ein Fehltreffer nur vom Wicht kommen
    expect(r.game.fehltreffer).toBe(0);
    expect(r.game.energie).toBe(3);
  });
});
