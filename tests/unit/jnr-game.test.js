const { parseLevel } = require('../../jumpnrun/core/level.js');
const G = require('../../jumpnrun/core/game.js');
const P = require('../../jumpnrun/core/physics.js');

const RIGHT = { left: false, right: true, jump: false };
const NONE = { left: false, right: false, jump: false };

function play(game, input, pred, max = 600) {
  const events = [];
  for (let i = 0; i < max; i++) {
    G.tick(game, typeof input === 'function' ? input(i) : input);
    events.push(...game.events);
    if (pred && pred(game)) break;
  }
  return events;
}

const LV = parseLevel([
  '.................',
  '.S.o..C..^.~...G.',
  '#################',
]);

describe('createGame', () => {
  test('Startzustand', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    expect(g.status).toBe('play');
    expect(g.player.x).toBe(LV.start.x);
    expect(g.player.y).toBe(LV.start.y);
    expect(g.funken).toBe(0);
    expect(g.fehltreffer).toBe(0);
    expect(g.crystals).toHaveLength(1);
  });
  test('Modus "ziel" verwendet die Zahlen aus mathgen mit Seed', () => {
    const L = parseLevel(['....', '.S.G', '####']);
    const g = G.createGame(L, { mode: 'ziel', reihe: 3, seed: 1 });
    expect(g.crystals).toHaveLength(0);
    const big = parseLevel(['ooooooooo.', '.S.......G', '##########']);
    const a = G.createGame(big, { mode: 'ziel', reihe: 3, seed: 1 });
    const b = G.createGame(big, { mode: 'ziel', reihe: 3, seed: 1 });
    expect(a.crystals.map(c => c.value)).toEqual(b.crystals.map(c => c.value));
    expect(a.totalGood).toBe(a.crystals.filter(c => c.good).length);
  });
});

describe('Kristalle', () => {
  test('guter Kristall: Funke, richtig +1, Ereignis, Kristall verschwindet', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.funken === 1);
    expect(g.funken).toBe(1);
    expect(g.richtig).toBe(1);
    expect(ev.map(e => e.type)).toContain('funke');
    expect(g.crystals[0].state).toBe('weg');
  });
  test('falscher Kristall: ein Funke weniger (nie unter 0), Fehltreffer, Rückstoß, kein Game Over', () => {
    const g = G.createGame(LV, { crystals: [{ tx: 3, ty: 1, value: 5, good: false }] });
    const ev = play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(g.fehltreffer).toBe(1);
    expect(g.funken).toBe(0);
    expect(g.richtig).toBe(0);
    expect(g.crystals[0].state).toBe('kaputt');
    expect(ev.map(e => e.type)).toContain('falsch');
    expect(g.player.vy).toBeLessThan(0);
    expect(g.status).toBe('play');
  });
  test('falscher Kristall nimmt einen vorher gesammelten Funken', () => {
    const L = parseLevel(['.....', '.SooG', '#####']);
    const g = G.createGame(L, { crystals: [{ tx: 2, ty: 1, value: 4, good: true }, { tx: 3, ty: 1, value: 5, good: false }] });
    play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(g.funken).toBe(0); // +1 -1
    expect(g.richtig).toBe(1);
  });
});

describe('Gefahren, Checkpoints, Ziel', () => {
  test('Dornen setzen zum Start zurück, zählen als Fehltreffer, Spiel läuft weiter', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    // vor die Dornen laufen (ohne Checkpoint zu berühren ist nicht möglich: C liegt davor)
    const ev = play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(ev.map(e => e.type)).toContain('treffer');
    expect(g.status).toBe('play');
    // Respawn am zuletzt berührten Checkpoint
    expect(g.player.x).toBe(LV.checkpoints[0].x);
    expect(g.player.y).toBe(LV.checkpoints[0].y);
  });
  test('Checkpoint wird einmal gemeldet', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(ev.filter(e => e.type === 'checkpoint')).toHaveLength(1);
  });
  test('Sturz in den Abgrund setzt zurück und zählt als Fehltreffer', () => {
    const PIT = parseLevel(['..........', '.S.......G', '###...####']);
    const g = G.createGame(PIT, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.fehltreffer === 1, 400);
    expect(ev.map(e => e.type)).toContain('treffer');
    expect(g.player.x).toBe(PIT.start.x);
  });
  test('Federpilz wirft hoch', () => {
    const L = parseLevel(['.....', '.S~.G', '#####']);
    const g = G.createGame(L, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.events.some(e => e.type === 'feder'));
    expect(g.player.vy).toBeLessThan(-5);
    expect(ev.map(e => e.type)).toContain('feder');
  });
  test('Ziel beendet das Level, Zeit steht danach still', () => {
    const L = parseLevel(['.....', '.S..G', '#####']);
    const g2 = G.createGame(L, { mode: 'aus' });
    const ev = play(g2, RIGHT, gm => gm.status === 'won');
    expect(g2.status).toBe('won');
    expect(ev.map(e => e.type)).toContain('ziel');
    const t = g2.t;
    G.tick(g2, RIGHT);
    expect(g2.t).toBe(t);
  });
});

describe('stats', () => {
  test('liefert Eingaben für calcMedals', () => {
    const L = parseLevel(['.....', '.SoG.', '#####']);
    const g = G.createGame(L, { mode: 'aus' });
    play(g, RIGHT, gm => gm.status === 'won');
    const s = G.stats(g);
    expect(s).toMatchObject({ reached: true, richtig: 1, totalGood: 1, fehltreffer: 0, funken: 1 });
    expect(s.timeMs).toBeCloseTo(g.t * 1000 / 60, 5);
  });
});
