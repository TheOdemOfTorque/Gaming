const { parseLevel } = require('../../jumpnrun/core/level.js');
const GG = require('../../jumpnrun/core/gegner.js');
const G = require('../../jumpnrun/core/game.js');
const P = require('../../jumpnrun/core/physics.js');

const T = 16;
const RIGHT = { left: false, right: true, jump: false };
const NONE = { left: false, right: false, jump: false };
const FLAT = parseLevel([
  '....................',
  'S.........w........G',
  '####################',
]);

function play(game, input, pred, max = 600) {
  const events = [];
  for (let i = 0; i < max; i++) {
    G.tick(game, typeof input === 'function' ? input(i) : input);
    events.push(...game.events);
    if (pred && pred(game)) break;
  }
  return events;
}

describe('createEnemies', () => {
  test('ein Wicht je w: steht auf dem Boden, laeuft zuerst nach links, Strecke in Pixeln', () => {
    const [e] = GG.createEnemies(FLAT, { reihe: 7, seed: 3 });
    expect(e.state).toBe('da');
    expect(e.dir).toBe(-1);
    expect(e.x).toBe(10 * T + (T - GG.EW) / 2);
    expect(e.y + GG.EH).toBe(2 * T);
    expect(e.minX).toBe(4 * T);
    expect(e.maxX).toBe(16 * T - GG.EW);
  });

  test('Tafel: falsche Rechnung aus der gewaehlten Reihe, deterministisch per Seed', () => {
    const a = GG.createEnemies(FLAT, { reihe: 7, seed: 3 })[0];
    const b = GG.createEnemies(FLAT, { reihe: 7, seed: 3 })[0];
    expect(a.rechnung).toEqual(b.rechnung);
    expect(a.rechnung.reihe).toBe(7);
    expect(a.rechnung.richtig).toBe(a.rechnung.faktor * 7);
    expect(a.rechnung.falsch).not.toBe(a.rechnung.richtig);
  });

  test('ohne gueltige Reihe (Zahlen aus) rechnet der Wicht in der 2er-Reihe', () => {
    expect(GG.createEnemies(FLAT, { seed: 1 })[0].rechnung.reihe).toBe(2);
  });

  test('mehrere Wichte bekommen nacheinander gezogene Rechnungen', () => {
    const L = parseLevel([
      '..............................',
      'S.........w.........w........G',
      '##############################',
    ]);
    const list = GG.createEnemies(L, { reihe: 5, seed: 8 });
    expect(list).toHaveLength(2);
    list.forEach(e => expect(e.rechnung.reihe).toBe(5));
  });
});

describe('Bewegung', () => {
  test('laeuft mit SPEED und dreht an den Enden der Strecke um', () => {
    const [e] = GG.createEnemies(FLAT, { reihe: 2, seed: 1 });
    const x0 = e.x;
    GG.step(e);
    expect(e.x).toBeCloseTo(x0 - GG.SPEED, 6);
    const dirs = new Set();
    for (let i = 0; i < 3000; i++) {
      GG.step(e);
      expect(e.x).toBeGreaterThanOrEqual(e.minX);
      expect(e.x).toBeLessThanOrEqual(e.maxX);
      dirs.add(e.dir);
    }
    expect(dirs).toEqual(new Set([-1, 1]));
  });

  test('ein aufgedeckter Wicht bleibt stehen und verschwindet nach AUFGEDECKT Schritten', () => {
    const [e] = GG.createEnemies(FLAT, { reihe: 2, seed: 1 });
    GG.stampf(e);
    const x = e.x;
    for (let i = 0; i < GG.AUFGEDECKT - 1; i++) GG.step(e);
    expect(e.state).toBe('aufgedeckt');
    expect(e.x).toBe(x);
    GG.step(e);
    expect(e.state).toBe('weg');
  });
});

describe('contact: Stampfen von oben vs. Seitenkontakt', () => {
  const e = { x: 100, y: 16, state: 'da' };
  test('fallend von oben (Fuesse vorher ueber der Oberkante) ist Stampfen', () => {
    const p = { x: 101, y: 16 - P.H + 3, vy: 3 };
    expect(GG.contact(e, p, p.y - 3)).toBe('stampf');
  });
  test('seitlich auf gleicher Hoehe ist Seitenkontakt', () => {
    const p = { x: 100 - P.W + 5, y: 16 + GG.EH - P.H, vy: 0 };
    expect(GG.contact(e, p, p.y)).toBe('seite');
  });
  test('steigend von unten ist nie Stampfen', () => {
    const p = { x: 101, y: 16 + 2, vy: -3 };
    expect(GG.contact(e, p, p.y + 3)).toBe('seite');
  });
  test('weit weg: kein Kontakt; aufgedeckt oder weg: kein Kontakt', () => {
    expect(GG.contact(e, { x: 10, y: 16, vy: 0 }, 16)).toBeNull();
    const p = { x: 101, y: 16 - P.H + 3, vy: 3 };
    expect(GG.contact(Object.assign({}, e, { state: 'aufgedeckt' }), p, p.y - 3)).toBeNull();
    expect(GG.contact(Object.assign({}, e, { state: 'weg' }), p, p.y - 3)).toBeNull();
  });
});

describe('Rechenwicht im Spiel (core/game.js)', () => {
  test('createGame legt die Wichte mit der Reihe der Optionen an', () => {
    const g = G.createGame(FLAT, { mode: 'ziel', reihe: 7, seed: 2 });
    expect(g.enemies).toHaveLength(1);
    expect(g.enemies[0].rechnung.reihe).toBe(7);
  });

  test('tick bewegt die Wichte', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    const x0 = g.enemies[0].x;
    play(g, NONE, null, 10);
    expect(g.enemies[0].x).toBeCloseTo(x0 - 10 * GG.SPEED, 6);
  });

  test('Seitenkontakt: 1 Energie ueber damage mit Quelle gegner, Rueckstoss weg vom Wicht', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    let hit = null;
    for (let i = 0; i < 600 && !hit; i++) {
      G.tick(g, RIGHT);
      hit = g.events.find(ev => ev.type === 'schaden');
    }
    expect(hit).toMatchObject({ type: 'schaden', quelle: 'gegner', energie: 2 });
    expect(g.player.vx).toBeLessThan(0);
    expect(g.enemies[0].state).toBe('da');
    expect(g.funken).toBe(0);
  });

  function dropOnto(g) {
    const e = g.enemies[0], p = g.player;
    p.x = e.x + 1; p.y = e.y - 30; p.vx = 0; p.vy = 0; p.onGround = false;
  }

  test('Stampfen: Tafel deckt auf, Funke, Lumo prallt hoch, kein Schaden', () => {
    const g = G.createGame(FLAT, { mode: 'ziel', reihe: 7, seed: 2 });
    dropOnto(g);
    const ev = play(g, NONE, gm => gm.enemies[0].state !== 'da', 60);
    const st = ev.find(x => x.type === 'stampf');
    expect(st).toMatchObject({ type: 'stampf', index: 0 });
    expect(st.rechnung).toEqual(g.enemies[0].rechnung);
    expect(g.enemies[0].state).toBe('aufgedeckt');
    expect(g.funken).toBe(1);
    expect(g.player.vy).toBeLessThan(-3);
    expect(g.energie).toBe(3);
    expect(g.fehltreffer).toBe(0);
    expect(ev.some(x => x.type === 'schaden')).toBe(false);
  });

  test('Stampfen klappt auch waehrend der Unverwundbarkeit', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    g.unverwundbar = 50;
    dropOnto(g);
    play(g, NONE, gm => gm.enemies[0].state !== 'da', 60);
    expect(g.enemies[0].state).toBe('aufgedeckt');
    expect(g.funken).toBe(1);
  });

  test('ein aufgedeckter oder verschwundener Wicht schadet nicht mehr', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    dropOnto(g);
    play(g, NONE, gm => gm.enemies[0].state !== 'da', 60);
    const ev = play(g, RIGHT, gm => gm.status !== 'play', 900);
    expect(ev.some(x => x.type === 'schaden')).toBe(false);
    expect(g.enemies[0].state).toBe('weg');
    expect(g.status).toBe('won');
  });

  test('cloneGame kopiert die Wichte tief (Bot-Vorausschau veraendert das Original nicht)', () => {
    const g = G.createGame(FLAT, { mode: 'aus' });
    const c = G.cloneGame(g);
    expect(c.enemies).not.toBe(g.enemies);
    expect(c.enemies[0]).not.toBe(g.enemies[0]);
    dropOnto(c);
    play(c, NONE, gm => gm.enemies[0].state !== 'da', 60);
    expect(c.enemies[0].state).toBe('aufgedeckt');
    expect(g.enemies[0].state).toBe('da');
    expect(g.enemies[0].x).toBe(10 * T + (T - GG.EW) / 2);
    expect(c.enemies[0].rechnung).toEqual(g.enemies[0].rechnung);
  });
});
