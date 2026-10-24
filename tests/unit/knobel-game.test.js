const K = require('../../knobel/knobel-logic.js');

describe('computeKnobelXP', () => {
  const base = { 1: 80, 2: 120, 3: 170, 4: 230, 5: 300 };
  test.each([1, 2, 3, 4, 5])('Basis-XP Stufe %i ohne Tipp', stufe => {
    const r = K.computeKnobelXP({ modus: 'mauer', stufe, tipps: 0, tagesraetsel: false }, 0);
    expect(r.xp).toBe(base[stufe]);
    expect(r.gedeckelt).toBe(false);
  });
  test('je Tipp minus 20 Prozent der Basis', () => {
    expect(K.computeKnobelXP({ stufe: 2, tipps: 1 }, 0).xp).toBe(96);
    expect(K.computeKnobelXP({ stufe: 2, tipps: 2 }, 0).xp).toBe(72);
  });
  test('Untergrenze 40 Prozent der Basis', () => {
    expect(K.computeKnobelXP({ stufe: 5, tipps: 3 }, 0).xp).toBe(120);
    expect(K.computeKnobelXP({ stufe: 5, tipps: 9 }, 0).xp).toBe(120);
  });
  test('Tagesraetsel mal 1,5', () => {
    expect(K.computeKnobelXP({ stufe: 2, tipps: 0, tagesraetsel: true }, 0).xp).toBe(180);
  });
  test('Tagescap 600: Rest wird ausgezahlt, danach 0 und gedeckelt', () => {
    const a = K.computeKnobelXP({ stufe: 5, tipps: 0 }, 400);
    expect(a.xp).toBe(200);
    expect(a.gedeckelt).toBe(true);
    const b = K.computeKnobelXP({ stufe: 5, tipps: 0 }, 600);
    expect(b.xp).toBe(0);
    expect(b.gedeckelt).toBe(true);
    const c = K.computeKnobelXP({ stufe: 5, tipps: 0 }, 300);
    expect(c.xp).toBe(300);
    expect(c.gedeckelt).toBe(false);
  });
  test('Cap-Konstante ist 600', () => { expect(K.TAGES_CAP).toBe(600); });
});

describe('nextKnobelStufe', () => {
  test('zwei saubere in Folge: Stufe plus 1', () => {
    let r = K.nextKnobelStufe(2, 0, true);
    expect(r).toEqual({ stufe: 2, serie: 1 });
    r = K.nextKnobelStufe(r.stufe, r.serie, true);
    expect(r).toEqual({ stufe: 3, serie: 0 });
  });
  test('zwei unsaubere in Folge: Stufe minus 1', () => {
    let r = K.nextKnobelStufe(3, 0, false);
    expect(r).toEqual({ stufe: 3, serie: -1 });
    r = K.nextKnobelStufe(r.stufe, r.serie, false);
    expect(r).toEqual({ stufe: 2, serie: 0 });
  });
  test('Grenzen 1 und 5', () => {
    expect(K.nextKnobelStufe(5, 1, true).stufe).toBe(5);
    expect(K.nextKnobelStufe(1, -1, false).stufe).toBe(1);
  });
  test('Wechsel der Richtung setzt die Serie neu', () => {
    expect(K.nextKnobelStufe(3, 1, false)).toEqual({ stufe: 3, serie: -1 });
    expect(K.nextKnobelStufe(3, -1, true)).toEqual({ stufe: 3, serie: 1 });
  });
});

describe('dailySeed', () => {
  test('gleiches Datum und Modus: gleicher Seed', () => {
    expect(K.dailySeed('2026-10-24', 'mauer')).toBe(K.dailySeed('2026-10-24', 'mauer'));
  });
  test('verschiedene Daten oder Modi: verschiedene Seeds', () => {
    expect(K.dailySeed('2026-10-24', 'mauer')).not.toBe(K.dailySeed('2026-10-25', 'mauer'));
    expect(K.dailySeed('2026-10-24', 'mauer')).not.toBe(K.dailySeed('2026-10-24', 'kaefige'));
  });
  test('Seed ist eine nichtnegative ganze Zahl', () => {
    const s = K.dailySeed('2026-10-24', 'kaefige');
    expect(Number.isInteger(s) && s >= 0).toBe(true);
  });
});

describe('generatePuzzle', () => {
  test('reproduzierbar aus (Modus, Stufe, Seed) und mit genVersion', () => {
    const a = K.generatePuzzle('mauer', 2, 1234), b = K.generatePuzzle('mauer', 2, 1234);
    expect(a).toEqual(b);
    expect(a.seed).toBe(1234);
    expect(a.genVersion).toBe(K.GEN_VERSION);
    expect(K.generatePuzzle('kaefige', 1, 7).modus).toBe('kaefige');
  });
  test('unbekannter Modus wirft', () => {
    expect(() => K.generatePuzzle('gitter', 1, 1)).toThrow();
  });
});

describe('Standalone-Speicher', () => {
  test('defaultKnobelState hat alle Felder', () => {
    const s = K.defaultKnobelState();
    expect(s.v).toBe(K.KNOBEL_STATE_VERSION);
    expect(s.stufe).toEqual({ mauer: 1, kaefige: 1 });
    expect(s.serie).toEqual({ mauer: 0, kaefige: 0 });
    expect(s.tagesXp).toEqual({ datum: null, xp: 0 });
    expect(s.laufend).toBeNull();
    expect(s.stumm).toBe(false);
  });
  test('knobelMigration ergaenzt fehlende Felder und laesst Vorhandenes', () => {
    const m = K.knobelMigration({ stufe: { mauer: 4 }, geloest: { mauer: 9 } });
    expect(m.stufe).toEqual({ mauer: 4, kaefige: 1 });
    expect(m.geloest).toEqual({ mauer: 9, kaefige: 0 });
    expect(m.tagesXp).toEqual({ datum: null, xp: 0 });
  });
  test('knobelMigration verkraftet null und Muell', () => {
    expect(K.knobelMigration(null)).toEqual(K.defaultKnobelState());
    expect(K.knobelMigration('x')).toEqual(K.defaultKnobelState());
  });
  test('tagesXpFuer: anderes Datum setzt auf 0', () => {
    expect(K.tagesXpFuer({ datum: '2026-10-23', xp: 500 }, '2026-10-24')).toBe(0);
    expect(K.tagesXpFuer({ datum: '2026-10-24', xp: 500 }, '2026-10-24')).toBe(500);
  });
});

describe('checkSolution / findHint (Mauer)', () => {
  const p = K.generatePyramid(2, K.mulberry32(11));
  function leer() { return p.loesung.map(r => r.map(() => null)); }
  function voll() { return p.loesung.map(r => r.slice()); }
  test('leere Eingabe: unvollstaendig', () => {
    const r = K.checkSolution('mauer', p, leer());
    expect(r.vollstaendig).toBe(false);
    expect(r.richtig).toBe(false);
    expect(r.falsche).toEqual([]);
  });
  test('Loesung eingetragen: richtig', () => {
    const r = K.checkSolution('mauer', p, voll());
    expect(r.vollstaendig).toBe(true);
    expect(r.richtig).toBe(true);
  });
  test('falscher Eintrag wird markiert', () => {
    const e = voll();
    let ziel = null;
    p.gegeben.forEach((row, rr) => row.forEach((v, c) => { if (v === null && !ziel) ziel = [rr, c]; }));
    e[ziel[0]][ziel[1]] = 9999;
    const r = K.checkSolution('mauer', p, e);
    expect(r.richtig).toBe(false);
    expect(r.falsche).toEqual([ziel]);
  });
  test('findHint liefert ein verstecktes, ableitbares Feld mit korrektem Wert', () => {
    const h = K.findHint('mauer', p, leer());
    expect(p.gegeben[h.r][h.c]).toBeNull();
    expect(h.wert).toBe(p.loesung[h.r][h.c]);
  });
  test('findHint korrigiert zuerst ein falsches Feld', () => {
    const e = leer();
    let ziel = null;
    p.gegeben.forEach((row, rr) => row.forEach((v, c) => { if (v === null) ziel = [rr, c]; }));
    e[ziel[0]][ziel[1]] = 4242;
    const h = K.findHint('mauer', p, e);
    expect([h.r, h.c]).toEqual(ziel);
    expect(h.wert).toBe(p.loesung[ziel[0]][ziel[1]]);
  });
  test('findHint ist null wenn alles stimmt', () => {
    expect(K.findHint('mauer', p, voll())).toBeNull();
  });
});

describe('checkSolution / findHint (Kaefige)', () => {
  const p = K.generateCages(2, K.mulberry32(5));
  function leer() { return p.loesung.map(r => r.map(() => 0)); }
  function voll() { return p.loesung.map(r => r.slice()); }
  test('Loesung ist richtig, leer ist unvollstaendig', () => {
    expect(K.checkSolution('kaefige', p, voll()).richtig).toBe(true);
    expect(K.checkSolution('kaefige', p, leer()).vollstaendig).toBe(false);
  });
  test('Hinweisfelder zaehlen auch bei leerer Eingabe als gesetzt', () => {
    const e = leer();
    const r = K.checkSolution('kaefige', p, e);
    expect(r.falsche).toEqual([]);
  });
  test('falsche Zahl wird als falsch, Doppelte als Konflikt gemeldet', () => {
    const e = voll();
    const frei = [];
    p.kaefige.forEach(k => { if (k.op !== '=') k.zellen.forEach(z => frei.push(z)); });
    const [r0, c0] = frei[0];
    const n = p.n;
    e[r0][c0] = p.loesung[r0][(c0 + 1) % n]; // Duplikat in der Zeile
    const res = K.checkSolution('kaefige', p, e);
    expect(res.richtig).toBe(false);
    expect(res.falsche).toContainEqual([r0, c0]);
    expect(res.konflikte.length).toBeGreaterThan(0);
  });
  test('findHint liefert korrekten Wert fuer ein nicht festes Feld', () => {
    const h = K.findHint('kaefige', p, leer());
    expect(h.wert).toBe(p.loesung[h.r][h.c]);
    const kaefig = p.kaefige.find(k => k.zellen.some(z => z[0] === h.r && z[1] === h.c));
    expect(kaefig.op).not.toBe('=');
  });
});

describe('applyMove / undoMove', () => {
  test('Zugliste reproduziert Zustand, Undo stellt ihn zurueck', () => {
    const start = [[null, null], [null]];
    const moves = [
      { r: 0, c: 1, alt: null, neu: 3 },
      { r: 1, c: 0, alt: null, neu: 12 },
      { r: 0, c: 1, alt: 3, neu: 4 }
    ];
    let e = start;
    moves.forEach(m => { e = K.applyMove(e, m); });
    expect(e).toEqual([[null, 4], [12]]);
    expect(start).toEqual([[null, null], [null]]); // unveraendert
    for (let i = moves.length - 1; i >= 0; i--) e = K.undoMove(e, moves[i]);
    expect(e).toEqual(start);
  });
});
