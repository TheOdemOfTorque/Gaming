const C = require('../../jumpnrun/core/collision.js');

// Kleines Testlevel direkt aus Strings, ohne den Parser (Isolation).
function lv(rows) {
  const h = rows.length, w = rows[0].length;
  const solid = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') solid[y * w + x] = 1; }));
  return { w, h, solid };
}

describe('solidAt', () => {
  const L = lv(['....', '.#..', '####']);
  test('liest Kacheln', () => {
    expect(C.solidAt(L, 1, 1)).toBe(true);
    expect(C.solidAt(L, 0, 1)).toBe(false);
  });
  test('links und rechts außerhalb ist Wand', () => {
    expect(C.solidAt(L, -1, 0)).toBe(true);
    expect(C.solidAt(L, 4, 0)).toBe(true);
  });
  test('oben und unten außerhalb ist Luft (Abgrund, freier Himmel)', () => {
    expect(C.solidAt(L, 1, -1)).toBe(false);
    expect(C.solidAt(L, 1, 3)).toBe(false);
  });
});

describe('overlapsSolid', () => {
  const L = lv(['....', '....', '####']); // Boden ab y = 32
  test('Box knapp über dem Boden überlappt nicht', () => {
    expect(C.overlapsSolid(L, 5, 20, 10, 12)).toBe(false); // Unterkante 32
  });
  test('Box ein Pixel im Boden überlappt', () => {
    expect(C.overlapsSolid(L, 5, 21, 10, 12)).toBe(true);
  });
  test('Box erstreckt sich über Kachelgrenzen', () => {
    const M = lv(['....', '.#..', '....']);
    expect(C.overlapsSolid(M, 10, 10, 10, 10)).toBe(true); // reicht in x 10..20 in Kachel 1
    expect(C.overlapsSolid(M, 0, 0, 16, 16)).toBe(false);
  });
});

describe('moveX', () => {
  const L = lv(['......', '......', '......', '######']);
  test('freie Bewegung', () => {
    const r = C.moveX(L, { x: 4, y: 20, w: 10, h: 12 }, 3);
    expect(r.x).toBe(7);
    expect(r.hit).toBe(false);
  });
  test('rechte Wand stoppt bündig an der Kachelkante', () => {
    const W = lv(['....#', '....#', '#####']);
    const r = C.moveX(W, { x: 50, y: 4, w: 10, h: 12 }, 10);
    expect(r.x).toBe(64 - 10);
    expect(r.hit).toBe(true);
  });
  test('linke Wand stoppt bündig', () => {
    const W = lv(['#....', '#....', '#####']);
    const r = C.moveX(W, { x: 20, y: 4, w: 10, h: 12 }, -10);
    expect(r.x).toBe(16);
    expect(r.hit).toBe(true);
  });
  test('Levelrand links ist Wand', () => {
    const r = C.moveX(L, { x: 2, y: 20, w: 10, h: 12 }, -5);
    expect(r.x).toBe(0);
    expect(r.hit).toBe(true);
  });
  test('gleitet am Boden entlang (Boden blockiert X nicht)', () => {
    const r = C.moveX(L, { x: 4, y: 36, w: 10, h: 12 }, 3); // steht exakt auf Boden y=48
    expect(r.x).toBe(7);
  });
});

describe('moveY', () => {
  test('Fallen landet bündig auf dem Boden', () => {
    const L = lv(['....', '....', '####']);
    const r = C.moveY(L, { x: 5, y: 10, w: 10, h: 12 }, 12);
    expect(r.y).toBe(32 - 12);
    expect(r.hitDown).toBe(true);
    expect(r.hitUp).toBe(false);
  });
  test('Aufstieg stößt bündig an die Decke', () => {
    const L = lv(['####', '....', '....']);
    const r = C.moveY(L, { x: 5, y: 20, w: 10, h: 12 }, -10);
    expect(r.y).toBe(16);
    expect(r.hitUp).toBe(true);
  });
  test('in der Luft ohne Hindernis', () => {
    const L = lv(['....', '....', '....']);
    const r = C.moveY(L, { x: 5, y: 10, w: 10, h: 12 }, 4);
    expect(r).toMatchObject({ y: 14, hitDown: false, hitUp: false });
  });
  test('unter dem Levelende gibt es keinen Boden (Abgrund)', () => {
    const L = lv(['....', '....']);
    const r = C.moveY(L, { x: 5, y: 10, w: 10, h: 12 }, 40);
    expect(r.hitDown).toBe(false);
    expect(r.y).toBe(50);
  });
  test('Lücke von 2 Kacheln: Box steht auf der Kante und fällt durch, wenn ganz in der Lücke', () => {
    const L = lv(['......', '......', '##..##']);
    const inGap = C.moveY(L, { x: 34, y: 10, w: 10, h: 12 }, 12);
    expect(inGap.hitDown).toBe(false);
    const onEdge = C.moveY(L, { x: 28, y: 10, w: 10, h: 12 }, 12); // ragt noch auf Kachel 1
    expect(onEdge.hitDown).toBe(true);
  });
});
