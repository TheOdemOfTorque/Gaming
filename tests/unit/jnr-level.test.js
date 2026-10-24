const { parseLevel, CHARS } = require('../../jumpnrun/core/level.js');

const VALID = [
  '..........',
  '..o..o....',
  '.S.C.^~.G.',
  '##########',
];

function err(rows) {
  try { parseLevel(rows); } catch (e) { return e.message; }
  return null;
}

describe('parseLevel: gültige Level', () => {
  const L = parseLevel(VALID);
  test('Maße und feste Kacheln', () => {
    expect(L.w).toBe(10);
    expect(L.h).toBe(4);
    expect(L.solid[3 * 10 + 4]).toBe(1);
    expect(L.solid[2 * 10 + 4]).toBe(0);
    expect(L.solid.length).toBe(40);
  });
  test('Start steht mittig auf der Kachel, Füße auf der Kachelunterkante', () => {
    expect(L.start).toEqual({ tx: 1, ty: 2, x: 16 + 3, y: 3 * 16 - 12 });
  });
  test('Ziel, Checkpoint, Dornen und Federpilz werden erkannt', () => {
    expect(L.goal).toMatchObject({ tx: 8, ty: 2 });
    expect(L.checkpoints).toHaveLength(1);
    expect(L.checkpoints[0]).toMatchObject({ tx: 3, ty: 2, x: 48 + 3, y: 3 * 16 - 12 });
    expect(L.spikes).toEqual([{ tx: 5, ty: 2 }]);
    expect(L.springs).toEqual([{ tx: 6, ty: 2 }]);
  });
  test('Kristallplätze sind nach x (dann y) sortiert', () => {
    expect(L.crystalSlots).toEqual([{ tx: 2, ty: 1 }, { tx: 5, ty: 1 }]);
  });
  test('Spezialzeichen sind selbst nicht fest', () => {
    expect(L.solid[2 * 10 + 8]).toBe(0);
  });
  test('Checkpoints werden nach x sortiert', () => {
    const L2 = parseLevel(['..........', '.S.C.C..G.', '##########'].map((r, i) => i === 1 ? r : r));
    expect(L2.checkpoints.map(c => c.tx)).toEqual([3, 5]);
  });
});

describe('parseLevel: Fehler werden sprechend gemeldet', () => {
  test('ungleiche Zeilenlänge', () => {
    expect(err(['.S..G', '#####', '###'])).toMatch(/Zeile 3.*3.*5/);
  });
  test('unbekanntes Zeichen mit Position', () => {
    expect(err(['.S.x.G', '######'])).toMatch(/Zeile 1, Spalte 4.*'x'/);
  });
  test('kein Start', () => { expect(err(['...G', '####'])).toMatch(/Start/); });
  test('zwei Starts', () => { expect(err(['S.S.G', '#####'])).toMatch(/genau einen Start/); });
  test('kein Ziel', () => { expect(err(['.S..', '####'])).toMatch(/Ziel/); });
  test('Start ohne Boden darunter', () => {
    expect(err(['.S.G', '#..#'])).toMatch(/Start.*Boden/);
  });
  test('Ziel ohne Boden darunter', () => {
    expect(err(['.S.G', '###.'])).toMatch(/Ziel.*Boden/);
  });
  test('Checkpoint ohne Boden darunter', () => {
    expect(err(['.SC.G', '##.##'])).toMatch(/Checkpoint.*Boden/);
  });
  test('Checkpoint liegt links vom Start oder rechts vom Ziel', () => {
    expect(err(['C.S.G', '#####'])).toMatch(/Checkpoint.*zwischen/);
    expect(err(['.S.GC', '#####'])).toMatch(/Checkpoint.*zwischen/);
  });
  test('leeres Level', () => { expect(err([])).toMatch(/leer/); });
});

test('CHARS dokumentiert alle Zeichen', () => {
  expect(Object.keys(CHARS).sort()).toEqual(['#', '.', '^', 'C', 'G', 'S', 'o', '~'].sort());
});
