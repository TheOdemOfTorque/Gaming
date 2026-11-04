const P = require('../../jumpnrun/core/physics.js');

function lv(rows) {
  const h = rows.length, w = rows[0].length;
  const solid = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') solid[y * w + x] = 1; }));
  return { w, h, solid };
}
const NONE = { left: false, right: false, jump: false };
const RIGHT = { left: false, right: true, jump: false };
const LEFT = { left: true, right: false, jump: false };
const JUMP = { left: false, right: false, jump: true };

// Boden bei y = 96 (Zeile 6), 20 Kacheln breit.
const FLAT = lv([
  '....................', '....................', '....................',
  '....................', '....................', '....................',
  '####################', '####################',
]);
const FLOOR = 96;

function standing(x) { const p = P.createPlayer(x, FLOOR - P.H); settle(p, FLAT); return p; }
function settle(p, L) { for (let i = 0; i < 5; i++) P.step(p, NONE, L); }
function run(p, L, input, n) { for (let i = 0; i < n; i++) P.step(p, input, L); }

describe('Schwerkraft', () => {
  test('Fall beschleunigt und wird begrenzt', () => {
    const TALL = lv(Array(60).fill('..........'));
    const p = P.createPlayer(40, 0);
    P.step(p, NONE, TALL);
    expect(p.vy).toBeGreaterThan(0);
    run(p, TALL, NONE, 30);
    expect(p.vy).toBe(P.MAX_FALL);
  });
  test('Landen: bündig auf dem Boden, onGround, landed-Ereignis genau einmal', () => {
    const p = P.createPlayer(40, 60);
    let landed = 0;
    for (let i = 0; i < 60; i++) if (P.step(p, NONE, FLAT).landed) landed++;
    expect(p.y).toBe(FLOOR - P.H);
    expect(p.onGround).toBe(true);
    expect(landed).toBe(1);
  });
});

describe('Laufen', () => {
  test('beschleunigt sanft bis zur Höchstgeschwindigkeit', () => {
    const p = standing(40);
    P.step(p, RIGHT, FLAT);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vx).toBeLessThan(P.MAX_RUN);
    run(p, FLAT, RIGHT, 30);
    expect(p.vx).toBe(P.MAX_RUN);
    expect(p.facing).toBe(1);
  });
  test('Reibung bremst bis zum Stillstand', () => {
    const p = standing(40);
    run(p, FLAT, RIGHT, 30);
    run(p, FLAT, NONE, 30);
    expect(p.vx).toBe(0);
  });
  test('Richtungswechsel bremst schneller als Auslaufen', () => {
    const a = standing(100), b = standing(100);
    run(a, FLAT, RIGHT, 30); run(b, FLAT, RIGHT, 30);
    P.step(a, LEFT, FLAT); P.step(b, NONE, FLAT);
    expect(a.vx).toBeLessThan(b.vx);
    expect(a.facing).toBe(-1);
  });
  test('Wand stoppt die Figur', () => {
    const W = lv(['......#', '......#', '#######']);
    const p = P.createPlayer(60, 32 - P.H); // Boden bei y=32
    run(p, W, RIGHT, 60);
    expect(p.x).toBe(96 - P.W);
    expect(p.vx).toBe(0);
  });
});

function apexHeight(inputFor) {
  const p = standing(40);
  const y0 = p.y;
  let minY = p.y;
  for (let i = 0; i < 80; i++) { P.step(p, inputFor(i), FLAT); minY = Math.min(minY, p.y); }
  return y0 - minY;
}

describe('Sprung', () => {
  test('voller Sprung (Knopf gehalten) erreicht etwa 3 Kacheln', () => {
    const h = apexHeight(() => JUMP);
    expect(h).toBeGreaterThan(44);
    expect(h).toBeLessThan(64);
  });
  test('variable Höhe: kurzes Tippen ergibt einen deutlich kleineren Hüpfer', () => {
    const full = apexHeight(() => JUMP);
    const tap = apexHeight(i => (i < 3 ? JUMP : NONE));
    expect(tap).toBeGreaterThan(4);
    expect(tap).toBeLessThan(full * 0.6);
  });
  test('Sprung meldet jumped genau im Auslöse-Schritt', () => {
    const p = standing(40);
    const r = P.step(p, JUMP, FLAT);
    expect(r.jumped).toBe(true);
    expect(p.vy).toBeLessThan(0);
    expect(p.onGround).toBe(false);
    expect(P.step(p, JUMP, FLAT).jumped).toBe(false);
  });
  test('kein Doppelsprung in der Luft', () => {
    const p = standing(40);
    P.step(p, JUMP, FLAT);
    run(p, FLAT, NONE, 6);
    const vyBefore = p.vy;
    const r = P.step(p, JUMP, FLAT);
    expect(r.jumped).toBe(false);
    expect(p.vy).toBeGreaterThan(vyBefore); // Schwerkraft wirkt weiter
  });
  test('gehaltener Knopf springt nach der Landung nicht von selbst erneut', () => {
    const p = standing(40);
    run(p, FLAT, JUMP, 120);
    expect(p.onGround).toBe(true);
    expect(p.vy).toBeGreaterThanOrEqual(0);
  });
});

// Plattform von x=0..64, danach Abgrund
const EDGE = lv([
  '......................', '......................', '......................',
  '......................', '......................', '......................',
  '####..................', '####..................',
]);

function offEdge() {
  const p = P.createPlayer(52, FLOOR - P.H); // steht auf der Kante (Platte endet bei x = 64)
  settle(p, EDGE);
  expect(p.onGround).toBe(true);
  let n = 0;
  while (p.onGround && n++ < 60) P.step(p, RIGHT, EDGE);
  return p;
}

describe('Coyote Time', () => {
  test.each([[0], [P.COYOTE - 1]])('Sprung %i Schritte nach dem Verlassen der Kante geht noch', (wait) => {
    const p = offEdge();
    run(p, EDGE, NONE, wait);
    const r = P.step(p, JUMP, EDGE);
    expect(r.jumped).toBe(true);
  });
  test('8 Schritte nach der Kante geht der Sprung nicht mehr', () => {
    const p = offEdge();
    run(p, EDGE, NONE, 8);
    expect(P.step(p, JUMP, EDGE).jumped).toBe(false);
  });
  test('Coyote-Fenster entspricht etwa 100 ms (6 Schritte)', () => {
    expect(P.COYOTE).toBe(6);
  });
});

describe('Jump Buffer', () => {
  function airborneAbove(frames) {
    // Figur fällt aus der Höhe, Knopf wird "frames" Schritte vor der Landung gedrückt
    const p = P.createPlayer(40, FLOOR - P.H - 40);
    p.vy = 0;
    return p;
  }
  test('Druck kurz vor der Landung wird bei der Landung ausgeführt', () => {
    const p = airborneAbove();
    let landedAt = -1, steps = 0;
    // erst Landezeitpunkt ohne Eingabe messen
    const probe = airborneAbove();
    for (; ; steps++) if (P.step(probe, NONE, FLAT).landed) { landedAt = steps; break; }
    let jumpedAfterLand = false;
    for (let i = 0; i <= landedAt + 2; i++) {
      const input = i === landedAt - 3 ? JUMP : NONE; // 3 Schritte vor der Landung
      const r = P.step(p, input, FLAT);
      if (i >= landedAt && r.jumped) jumpedAfterLand = true;
    }
    expect(jumpedAfterLand).toBe(true);
  });
  test('Druck zu früh (länger als der Puffer) verfällt', () => {
    const p = airborneAbove();
    const probe = airborneAbove();
    let landedAt = 0;
    for (let i = 0; ; i++) if (P.step(probe, NONE, FLAT).landed) { landedAt = i; break; }
    let jumped = false;
    for (let i = 0; i <= landedAt + 2; i++) {
      const input = i === landedAt - (P.BUFFER + 4) ? JUMP : NONE;
      if (P.step(p, input, FLAT).jumped) jumped = true;
    }
    expect(jumped).toBe(false);
  });
});

describe('Eckenkorrektur', () => {
  // Deckenblock bei Kachel (2,2): x 32..48, y 32..48. Boden y = 96.
  const CEIL = lv([
    '....................', '....................', '..#.................',
    '....................', '....................', '....................',
    '####################', '####################',
  ]);
  test('Streift der Kopf nur knapp die Ecke, wird die Figur zur Seite geschoben', () => {
    const p = P.createPlayer(24, FLOOR - P.H); // Box x 24..34, ragt 2 px unter den Block
    settle(p, CEIL);
    let minY = p.y;
    for (let i = 0; i < 60; i++) { P.step(p, JUMP, CEIL); minY = Math.min(minY, p.y); }
    expect(minY).toBeLessThan(40); // ohne Korrektur Stopp bei y = 48
    expect(p.x + P.W).toBeLessThanOrEqual(32);
  });
  test('Volle Überdeckung stoppt dagegen an der Decke', () => {
    const p = P.createPlayer(34, FLOOR - P.H); // Box x 34..44, mittig unter dem Block
    settle(p, CEIL);
    let minY = p.y;
    for (let i = 0; i < 60; i++) { P.step(p, JUMP, CEIL); minY = Math.min(minY, p.y); }
    expect(minY).toBe(48);
    expect(p.x).toBe(34);
  });
});

describe('Determinismus', () => {
  test('gleiche Eingaben ergeben exakt gleichen Zustand', () => {
    const seq = i => (i % 40 < 20 ? RIGHT : (i % 7 === 0 ? JUMP : LEFT));
    const a = standing(40), b = standing(40);
    for (let i = 0; i < 300; i++) { P.step(a, seq(i), FLAT); P.step(b, seq(i), FLAT); }
    expect(a).toEqual(b);
  });
  test('FIXED_DT ist 1/60 s', () => { expect(P.FIXED_DT).toBeCloseTo(1 / 60, 10); });
});
