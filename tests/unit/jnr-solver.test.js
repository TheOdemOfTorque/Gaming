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
    const r = SOLVER.solve(L, { mode: 'ziel', reihe: 2, seed: 1 });
    expect(r.game.enemies.length).toBeGreaterThan(0);
    expect(r.won).toBe(true);
    // ohne falsche Zahlen und Dornen kann ein Fehltreffer nur vom Wicht kommen
    expect(r.game.fehltreffer).toBe(0);
    expect(r.game.energie).toBe(3);
  });
});

// Aufgabe 10 (Marco, 29.10.): Leben und Energie des Bots sind nur noch Messwerte. Der Nachweis der
// Erreichbarkeit laeuft unsterblich (game.createGame opts.unsterblich): Sturz und Treffer loesen weiter
// Respawn und Rueckstoss aus, kosten aber nichts. Steckt der Bot fest (SOFTLOCK Schritte ohne neues
// x-Maximum), meldet solve das als softlock, lange vor maxFrames.
describe('Greedy-Bot unsterblich und Softlock', () => {
  const G = require('../../jumpnrun/core/game.js');
  const PIT6 = parseLevel(['................', 'S..............G', '###......#######']);
  const FLAT = parseLevel(['.......', 'S.....G', '#######']);

  test('SOFTLOCK ist eine feste Schrittzahl von einigen hundert Schritten (deterministisch)', () => {
    // gemessen (3-Leben-Bot, Stufe 1-2, 200 Seeds): laengste Spanne ohne neues x-Maximum 145 Schritte,
    // alle 3 Leben in einer Grube zu verlieren dauert 261 Schritte; beides liegt deutlich darunter
    expect(SOLVER.SOFTLOCK).toBeGreaterThanOrEqual(300);
    expect(SOLVER.SOFTLOCK).toBeLessThanOrEqual(900);
  });

  test('zu breite Luecke, unsterblich: Endlosschleife Sturz/Respawn wird als softlock erkannt, nie lost', () => {
    const r = SOLVER.solve(PIT6, { mode: 'aus' }, undefined, { unsterblich: true });
    expect(r.won).toBe(false);
    expect(r.softlock).toBe(true);
    expect(r.game.status).toBe('play');
    expect(r.game.leben).toBe(G.LEBEN);
    expect(r.verluste.abgrund).toBeGreaterThanOrEqual(2); // es wurde wirklich gestuerzt und respawnt
    expect(r.frames).toBeLessThanOrEqual(SOLVER.SOFTLOCK + 300);
    expect(r.frames).toBeLessThan(60 * 180); // nicht bis maxFrames gewartet
  });

  test('normales Level, unsterblich: won, kein softlock', () => {
    const r = SOLVER.solve(FLAT, { mode: 'aus' }, undefined, { unsterblich: true });
    expect(r.won).toBe(true);
    expect(r.softlock).toBe(false);
    expect(r.game.unsterblich).toBe(true);
    expect(r.verluste).toEqual({});
  });

  test('ohne Option bleibt das Ergebnis wie bisher: Grube kostet Leben, status lost', () => {
    const r = SOLVER.solve(PIT6, { mode: 'aus' }, 600);
    expect(r.won).toBe(false);
    expect(r.softlock).toBe(false);
    expect(r.game.status).toBe('lost');
    expect(r.game.unsterblich).toBe(false);
    expect(r.verluste).toEqual({ abgrund: 3 });
  });

  test('Softlock greift auch mit 3 Leben, wenn der Bot ohne Sturz festhaengt (Wand ohne Weg)', () => {
    // Decke direkt ueber Lumo, davor eine Wand bis zur Decke: kein Sprung kommt drueber
    const WALL = parseLevel([
      '################',
      '......###.......',
      'S.....###......G',
      '################',
    ]);
    const r = SOLVER.solve(WALL, { mode: 'aus' });
    expect(r.won).toBe(false);
    expect(r.softlock).toBe(true);
    expect(r.frames).toBeLessThan(60 * 180);
  });

  test('sprungmass: vermessene Sprungweite und -hoehe in Kacheln, passend zur Physik-Messung', () => {
    const P = require('../../jumpnrun/core/physics.js');
    const m = SOLVER.sprungmass();
    expect(Number.isInteger(m.luecke) && m.luecke >= 2).toBe(true);
    expect(Number.isInteger(m.stufe) && m.stufe >= 2).toBe(true);
    // Apex eines gehaltenen Sprungs wie in jnr-physics.test.js (dort 44..64 px): ganze Kacheln davon
    // muessen als Stufe schaffbar sein
    const flat = parseLevel(['.......', 'S.....G', '#######']);
    const p = P.createPlayer(flat.start.x, flat.start.y);
    for (let i = 0; i < 5; i++) P.step(p, {}, flat);
    let minY = p.y; const y0 = p.y;
    for (let i = 0; i < 80; i++) { P.step(p, { jump: true }, flat); minY = Math.min(minY, p.y); }
    expect(m.stufe).toBe(Math.floor((y0 - minY) / 16));
    expect(SOLVER.sprungmass()).toBe(m); // gecacht: dieselbe Messung
  });

  test('Ergebnis meldet eine ungueltige Spielerposition (NaN) statt stumm weiterzulaufen', () => {
    const kaputt = Object.assign({}, FLAT, { start: { tx: 0, ty: 1, x: NaN, y: FLAT.start.y } });
    const r = SOLVER.solve(kaputt, { mode: 'aus' }, 50, { unsterblich: true });
    expect(r.won).toBe(false);
    expect(r.fehler).toMatch(/Spielerposition/);
    expect(r.frames).toBeLessThanOrEqual(2);
  });
});
