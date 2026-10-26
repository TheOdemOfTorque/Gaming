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
  test('falscher Kristall: Fehltreffer, Rückstoß, kein Game Over, Funken bleiben bei 0', () => {
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
  test('falscher Kristall kostet keinen Funken, nur Energie', () => {
    const L = parseLevel(['.....', '.SooG', '#####']);
    const g = G.createGame(L, { crystals: [{ tx: 2, ty: 1, value: 4, good: true }, { tx: 3, ty: 1, value: 5, good: false }] });
    play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(g.funken).toBe(1); // gesammelter Funke bleibt
    expect(g.richtig).toBe(1);
    expect(g.energie).toBe(2);
  });
});

describe('Gefahren, Checkpoints, Ziel', () => {
  test('Dornen kosten 1 Energie und stoßen zurück, kein Respawn, Spiel läuft weiter', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.fehltreffer === 1);
    const schaden = ev.find(e => e.type === 'schaden');
    expect(schaden).toMatchObject({ quelle: 'stacheln', energie: 2 });
    expect(g.status).toBe('play');
    expect(g.energie).toBe(2);
    expect(g.leben).toBe(3);
    // nicht zum Checkpoint zurückgesetzt, sondern nach links/oben weggestoßen
    expect(g.player.x).toBeGreaterThan(LV.checkpoints[0].x + 16);
    expect(g.player.vx).toBeLessThan(0);
    expect(g.player.vy).toBeLessThan(0);
  });
  test('Dornen kosten keinen Funken', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    g.funken = 5;
    play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(g.energie).toBe(2);
    expect(g.funken).toBe(5 + g.richtig);
  });
  test('damage kostet nur Energie, auch wenn dabei ein Leben verloren geht', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    g.funken = 4;
    expect(G.damage(g, 'stacheln', 1)).toBe(true);
    expect(g).toMatchObject({ funken: 4, energie: 2, fehltreffer: 1 });
    g.unverwundbar = 0; g.energie = 1;
    G.damage(g, 'gegner', -1);
    expect(g).toMatchObject({ funken: 4, leben: 2, energie: 3, fehltreffer: 2 });
  });
  test('Checkpoint wird einmal gemeldet', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(ev.filter(e => e.type === 'checkpoint')).toHaveLength(1);
  });
  test('Sturz in den Abgrund kostet sofort ein Leben, Respawn mit voller Energie', () => {
    const PIT = parseLevel(['..........', '.S.......G', '###...####']);
    const g = G.createGame(PIT, { mode: 'aus' });
    g.energie = 1;
    const ev = play(g, RIGHT, gm => gm.leben === 2, 400);
    expect(ev.find(e => e.type === 'leben')).toMatchObject({ grund: 'abgrund', leben: 2 });
    expect(g.energie).toBe(3);
    expect(g.fehltreffer).toBe(1);
    expect(g.player.x).toBe(PIT.start.x);
    expect(g.status).toBe('play');
  });
  test('Sturz in den Abgrund kostet keinen Funken', () => {
    const PIT = parseLevel(['..........', '.S.......G', '###...####']);
    const g = G.createGame(PIT, { mode: 'aus' });
    g.funken = 3;
    play(g, RIGHT, gm => gm.leben === 2, 400);
    expect(g.funken).toBe(3);
  });
  test('Sturz kostet ein Leben auch während der Unverwundbarkeit', () => {
    const PIT = parseLevel(['..........', '.S.......G', '###...####']);
    const g = G.createGame(PIT, { mode: 'aus' });
    play(g, RIGHT, gm => gm.player.y > PIT.h * 16, 400);
    g.unverwundbar = 50;
    play(g, RIGHT, gm => gm.leben === 2, 50);
    expect(g.leben).toBe(2);
  });
  test('leben-Ereignis trägt die Position des Unfallorts, nicht die des Respawns', () => {
    const PIT = parseLevel(['..........', '.S.......G', '###...####']);
    const g = G.createGame(PIT, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.leben === 2, 400);
    const e = ev.find(x => x.type === 'leben');
    expect(e.x).toBeGreaterThan(PIT.start.x);
    expect(g.player.x).toBe(PIT.start.x); // zu diesem Zeitpunkt schon respawnt
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

describe('Energie und Leben', () => {
  const FLAT = parseLevel(['..........', '.S.......G', '##########']);

  test('Start: 3 Leben, 3 Energie, nicht unverwundbar', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    expect(g.leben).toBe(3);
    expect(g.energie).toBe(3);
    expect(g.unverwundbar).toBe(0);
    expect(G.LEBEN).toBe(3);
    expect(G.ENERGIE).toBe(3);
    expect(G.INVULN).toBeGreaterThanOrEqual(50);
    expect(G.INVULN).toBeLessThanOrEqual(70);
  });

  test('damage: -1 Energie, Rückstoß in die angegebene Richtung, Fehltreffer, Ereignis mit Quelle', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    expect(G.damage(g, 'gegner', -1)).toBe(true);
    expect(g.energie).toBe(2);
    expect(g.fehltreffer).toBe(1);
    expect(g.player.vx).toBeLessThan(0);
    expect(g.player.vy).toBeLessThan(0);
    expect(g.unverwundbar).toBe(G.INVULN);
    expect(g.events.find(e => e.type === 'schaden')).toMatchObject({ quelle: 'gegner', energie: 2 });
    const g2 = G.createGame(FLAT, { mode: 'aus' });
    G.damage(g2, 'gegner', 1);
    expect(g2.player.vx).toBeGreaterThan(0);
  });

  test('damage während der Unverwundbarkeit wirkt nicht', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    G.damage(g, 'gegner', -1);
    expect(G.damage(g, 'gegner', -1)).toBe(false);
    expect(g.energie).toBe(2);
    expect(g.fehltreffer).toBe(1);
  });

  test('Unverwundbarkeit läuft pro Schritt ab (ca. 1 Sekunde)', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    G.damage(g, 'gegner', -1);
    for (let i = 0; i < G.INVULN; i++) G.tick(g, NONE);
    expect(g.unverwundbar).toBe(0);
    expect(G.damage(g, 'gegner', -1)).toBe(true);
    expect(g.energie).toBe(1);
  });

  test('Energie 0 kostet ein Leben: Respawn am Checkpoint mit voller Energie', () => {
    const g = G.createGame(LV, { mode: 'aus' });
    play(g, RIGHT, gm => gm.checkpointIdx === 0);
    for (let i = 0; i < 3; i++) { g.unverwundbar = 0; G.damage(g, 'gegner', -1); }
    expect(g.leben).toBe(2);
    expect(g.energie).toBe(3);
    expect(g.player.x).toBe(LV.checkpoints[0].x);
    expect(g.player.y).toBe(LV.checkpoints[0].y);
    expect(g.player.vx).toBe(0);
    expect(g.events.find(e => e.type === 'leben')).toMatchObject({ grund: 'energie', leben: 2 });
    expect(g.unverwundbar).toBe(G.INVULN);
    expect(g.status).toBe('play');
  });

  test('Dornen: kein zweiter Treffer in der Unverwundbarkeit, danach wieder', () => {
    const BED = parseLevel(['......................', '.S..^^^^^^^^^^^^^^^^.G', '######################']);
    const g = G.createGame(BED, { mode: 'aus' });
    play(g, RIGHT, gm => gm.energie === 2);
    for (let i = 0; i < G.INVULN - 1; i++) G.tick(g, RIGHT);
    expect(g.energie).toBe(2);
    play(g, RIGHT, gm => gm.energie === 1, 300);
    expect(g.energie).toBe(1);
  });

  test('alle Leben weg: status lost, Ereignis verloren, Simulation steht', () => {
    const PIT = parseLevel(['..........', '.S.......G', '###...####']);
    const g = G.createGame(PIT, { mode: 'aus' });
    const ev = play(g, RIGHT, gm => gm.status !== 'play', 2000);
    expect(g.status).toBe('lost');
    expect(g.leben).toBe(0);
    expect(ev.map(e => e.type)).toContain('verloren');
    expect(ev.filter(e => e.type === 'leben')).toHaveLength(3);
    const t = g.t;
    G.tick(g, RIGHT);
    expect(g.t).toBe(t);
    expect(G.damage(g, 'gegner', -1)).toBe(false);
    const s = G.stats(g);
    expect(s.reached).toBe(false);
    expect(s.lost).toBe(true);
    expect(s.leben).toBe(0);
  });

  test('falscher Kristall in der Unverwundbarkeit bleibt liegen und schadet nicht', () => {
    const L = parseLevel(['......', '.So..G', '######']);
    const g = G.createGame(L, { crystals: [{ tx: 2, ty: 1, value: 5, good: false }] });
    g.unverwundbar = 200;
    play(g, RIGHT, gm => gm.player.x > 3 * 16, 200);
    expect(g.crystals[0].state).toBe('da');
    expect(g.energie).toBe(3);
    expect(g.fehltreffer).toBe(0);
  });

  test('falscher Kristall kostet 1 Energie', () => {
    const g = G.createGame(LV, { crystals: [{ tx: 3, ty: 1, value: 5, good: false }] });
    const ev = play(g, RIGHT, gm => gm.fehltreffer === 1);
    expect(g.energie).toBe(2);
    expect(ev.find(e => e.type === 'schaden')).toMatchObject({ quelle: 'kristall' });
  });
});

describe('stats', () => {
  test('liefert Eingaben für calcMedals', () => {
    const L = parseLevel(['.....', '.SoG.', '#####']);
    const g = G.createGame(L, { mode: 'aus' });
    play(g, RIGHT, gm => gm.status === 'won');
    const s = G.stats(g);
    expect(s).toMatchObject({ reached: true, lost: false, leben: 3, richtig: 1, totalGood: 1, fehltreffer: 0, funken: 1 });
    expect(s.timeMs).toBeCloseTo(g.t * 1000 / 60, 5);
  });
});

describe('cloneGame', () => {
  test('Kopie läuft unabhängig vom Original weiter (für Vorausschau im Bot)', () => {
    const L = parseLevel(['......', '.So..G', '######']);
    const g = G.createGame(L, { crystals: [{ tx: 2, ty: 1, value: 4, good: true }] });
    const c = G.cloneGame(g);
    play(c, RIGHT, gm => gm.status === 'won');
    expect(c.status).toBe('won');
    expect(c.crystals[0].state).toBe('weg');
    expect(g.status).toBe('play');
    expect(g.crystals[0].state).toBe('da');
    expect(g.player.x).toBe(L.start.x);
    expect(g.t).toBe(0);
    expect(c.level).toBe(g.level); // Level ist unveränderlich und wird geteilt
  });
});

describe('Übungsmodus (uebung: true, für das Tutorial)', () => {
  const PIT = parseLevel(['..........', '.S.......G', '###...####']);
  const FLAT = parseLevel(['..........', '.S.......G', '##########']);

  test('Sturz in die Schlucht kostet kein Leben: zurück zum Startpunkt, Ereignis zurueck', () => {
    const g = G.createGame(PIT, { mode: 'aus', uebung: true });
    const ev = play(g, RIGHT, gm => gm.events.some(e => e.type === 'zurueck'), 400);
    expect(ev.find(e => e.type === 'zurueck')).toMatchObject({ grund: 'abgrund' });
    expect(ev.some(e => e.type === 'leben')).toBe(false);
    expect(g.leben).toBe(G.LEBEN);
    expect(g.player.x).toBe(PIT.start.x);
    expect(g.status).toBe('play');
  });

  test('Energie 0 kostet kein Leben: Energie wieder voll, Rückstoß wie sonst, kein Respawn', () => {
    const g = G.createGame(FLAT, { mode: 'aus', uebung: true });
    play(g, RIGHT, gm => gm.player.x > FLAT.start.x + 30, 200);
    const x = g.player.x;
    for (let i = 0; i < 3; i++) { g.unverwundbar = 0; G.damage(g, 'gegner', -1); }
    expect(g.leben).toBe(G.LEBEN);
    expect(g.energie).toBe(G.ENERGIE);
    expect(g.player.x).toBe(x);
    expect(g.player.vx).toBeLessThan(0);
    expect(g.events.some(e => e.type === 'zurueck' && e.grund === 'energie')).toBe(true);
    expect(g.status).toBe('play');
  });

  test('ein Treffer zeigt den normalen Energieverlust (Schaden-Ereignis, 1 Lichtpunkt weniger)', () => {
    const g = G.createGame(FLAT, { mode: 'aus', uebung: true });
    G.damage(g, 'kristall', -1);
    expect(g.energie).toBe(G.ENERGIE - 1);
    expect(g.events.find(e => e.type === 'schaden')).toMatchObject({ quelle: 'kristall' });
  });

  test('ohne uebung bleibt alles wie bisher (Leben weg)', () => {
    const g = G.createGame(PIT, { mode: 'aus' });
    play(g, RIGHT, gm => gm.leben === 2, 400);
    expect(g.leben).toBe(2);
  });
});
