const { parseLevel } = require('../../jumpnrun/core/level.js');
const D = require('../../jumpnrun/data/sections.js');

const H = 9;
const FLAT_COLS = 2; // Rand-Kacheln, die an jedem Abschnittsende garantiert flach sind (core/levelgen.js verbindet dort)

function flatColOk(row0to6, row7, row8) {
  return row0to6.every(c => c === '.') && row7 === '#' && row8 === '#';
}

describe('Abschnitts-Bibliothek (data/sections.js)', () => {
  test('mindestens 20 Abschnitte, eindeutige IDs', () => {
    expect(D.SECTIONS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(D.SECTIONS.map(s => s.id)).size).toBe(D.SECTIONS.length);
  });

  test('alle drei Schwierigkeiten und mehrere Mechaniken kommen vor', () => {
    const schwierigkeiten = new Set(D.SECTIONS.map(s => s.schwierigkeit));
    expect(schwierigkeiten).toEqual(new Set([1, 2, 3]));
    const mechaniken = new Set(D.SECTIONS.flatMap(s => s.mechanik));
    expect(mechaniken.size).toBeGreaterThanOrEqual(5);
  });

  test.each(D.SECTIONS.map(s => [s.id, s]))('%s: 9 Zeilen, Breite 12-20, nur Abschnitts-Zeichen', (id, s) => {
    expect(s.rows).toHaveLength(H);
    const w = s.rows[0].length;
    expect(w).toBeGreaterThanOrEqual(12);
    expect(w).toBeLessThanOrEqual(20);
    s.rows.forEach(r => expect(r.length).toBe(w));
    const text = s.rows.join('');
    expect(text).not.toMatch(/[SGC]/); // Start/Ziel/Checkpoint setzt erst der Generator
  });

  test.each(D.SECTIONS.map(s => [s.id, s]))('%s: Anfang und Ende sind flach (anschlussfaehig)', (id, s) => {
    const w = s.rows[0].length;
    for (let x = 0; x < FLAT_COLS; x++) {
      const col0to6 = s.rows.slice(0, 7).map(r => r[x]);
      expect(flatColOk(col0to6, s.rows[7][x], s.rows[8][x])).toBe(true);
      const xr = w - 1 - x;
      const colR = s.rows.slice(0, 7).map(r => r[xr]);
      expect(flatColOk(colR, s.rows[7][xr], s.rows[8][xr])).toBe(true);
    }
  });

  test.each(D.SECTIONS.map(s => [s.id, s]))('%s: ist fuer sich allein (mit S/G an den Flach-Enden) ein gueltiges Level', (id, s) => {
    const rows = s.rows.map(r => r.split(''));
    rows[6][0] = 'S';
    rows[6][s.rows[0].length - 1] = 'G';
    const text = rows.map(r => r.join(''));
    expect(() => parseLevel(text)).not.toThrow();
  });

  test('Schwierigkeit 1 hat keine Dornen und keine Federpilze', () => {
    D.SECTIONS.filter(s => s.schwierigkeit === 1).forEach(s => {
      expect(s.rows.join('')).not.toMatch(/[\^~]/);
    });
  });
});

describe('Platz fuer Rechenwichte', () => {
  const { parseLevel, strecke, MIN_STRECKE } = require('../../jumpnrun/core/level.js');
  // Start auf der ersten Spalte, Ziel auf der ersten Spalte danach: genau wie die Laternen im echten Level
  function laengsteStrecke(section) {
    const rows = section.rows.map((r, y) => (r + (y >= 7 ? '#' : '.')).split(''));
    const w = section.rows[0].length;
    rows[6][0] = 'S'; rows[6][w] = 'G';
    const L = parseLevel(rows.map(r => r.join('')));
    let best = 0;
    for (let x = 0; x < w; x++) { const st = strecke(L, x, 6); if (st) best = Math.max(best, st.bis - st.von + 1); }
    return best;
  }
  test.each(['d1-lauf-a', 'd1-lauf-b', 'd1-lauf-c', 'd2-federpilz-a', 'd2-wichtwiese-a', 'd3-wicht-dornen', 'd3-wicht-luecke'])('%s hat eine kristallfreie flache Strecke fuer einen Wicht', (id) => {
    const sec = D.SECTIONS.find(s => s.id === id);
    expect(sec).toBeDefined();
    expect(laengsteStrecke(sec)).toBeGreaterThanOrEqual(MIN_STRECKE);
  });

  // Aufgabe 9 (Marco 30.10.): drei Wicht-Abschnitte fuer die Level 1-3 und 2-1 (Plan "Lumo zwei neue
  // Stufen", Zeilen aus der Messung der Vornacht: Wichte eine Kachel nach innen, damit die Enden flach
  // bleiben). d3-wicht-luecke behaelt beide Luecken mit 2 Kacheln, die rechte wird nicht verkleinert.
  const NEU = [
    ['d2-wichtwiese-a', 2, ['gegner'], 18, 2],
    ['d3-wicht-dornen', 3, ['gegner', 'dornen'], 20, 2],
    ['d3-wicht-luecke', 3, ['gegner', 'luecke'], 20, 2],
  ];
  test.each(NEU)('%s: Schwierigkeit %i, Mechanik %j, %i breit, %i Kristallplaetze auf dem Boden', (id, schw, mech, breite, kristalle) => {
    const sec = D.SECTIONS.find(s => s.id === id);
    expect(sec).toBeDefined();
    expect(sec.schwierigkeit).toBe(schw);
    expect(sec.mechanik).toEqual(mech);
    expect(sec.rows[0].length).toBe(breite);
    expect(sec.rows[6].split('').filter(c => c === 'o')).toHaveLength(kristalle);
    expect(sec.rows.slice(0, 6).join('')).toMatch(/^\.+$/); // Zeilen 0-5 reine Luft
  });

  test('d3-wicht-luecke: zwei Luecken zu je 2 Kacheln, der Wicht-Platz liegt dazwischen', () => {
    const sec = D.SECTIONS.find(s => s.id === 'd3-wicht-luecke');
    expect(sec.rows[7]).toBe('####..########..####');
    expect(sec.rows[8]).toBe(sec.rows[7]);
    expect(sec.rows[6]).toBe('..o..............o..');
  });

  test('d3-wicht-dornen: zwei Dornenfelder auf dem Boden, Kristalle an den Enden', () => {
    const sec = D.SECTIONS.find(s => s.id === 'd3-wicht-dornen');
    expect(sec.rows[6]).toBe('..o..^........^..o..');
    expect(sec.rows[7]).toBe('#'.repeat(20));
  });
});

// Aufgabe 10 (Marco, 29.10.): statische Geometrie je Abschnitt gegen die vermessene Sprungweite und
// -hoehe des Bots (core/solver.js sprungmass, per Simulation aus core/physics.js abgeleitet). Das sind
// notwendige Bedingungen; den hinreichenden Nachweis liefert der unsterbliche Bot-Lauf in
// jnr-solver.test.js und jnr-levels.test.js. Flache Enden (2 Kacheln) prueft der Test oben schon.
describe('Geometrie je Abschnitt (core/level.js geometrie)', () => {
  const { geometrie } = require('../../jumpnrun/core/level.js');
  const SOLVER = require('../../jumpnrun/core/solver.js');
  const MASS = SOLVER.sprungmass();

  function alsLevel(section) {
    const rows = section.rows.map(r => r.split(''));
    rows[6][0] = 'S';
    rows[6][section.rows[0].length - 1] = 'G';
    return parseLevel(rows.map(r => r.join('')));
  }

  test('Messwerte sind ganze Kacheln (Luecke und Stufe mindestens 2, Bibliothek geht bis genau 3)', () => {
    expect(MASS.luecke).toBeGreaterThanOrEqual(2);
    expect(MASS.stufe).toBeGreaterThanOrEqual(2);
  });

  test.each(D.SECTIONS.map(s => [s.id, s]))('%s: jede Luecke und jede Stufe liegt in Sprungweite bzw. -hoehe', (id, s) => {
    const g = geometrie(alsLevel(s));
    expect(Math.max(0, ...g.luecken)).toBeLessThanOrEqual(MASS.luecke);
    expect(Math.max(0, ...g.stufen)).toBeLessThanOrEqual(MASS.stufe);
  });

  test.each(D.SECTIONS.map(s => [s.id, s]))('%s: jeder Kristall hat festen Boden in seiner Spalte, hoechstens Sprunghoehe tiefer', (id, s) => {
    // Erreichbar heisst hier: in der Spalte des Kristalls liegt fester Boden, und der Kristall schwebt
    // hoechstens MASS.stufe Kacheln ueber der Standkachel darauf (0 = er liegt direkt auf dem Boden).
    const g = geometrie(alsLevel(s));
    expect(g.kristallHoehen.length).toBe(alsLevel(s).crystalSlots.length);
    g.kristallHoehen.forEach(h => expect(h).toBeLessThanOrEqual(MASS.stufe));
  });

  test('geometrie misst Luecken, Stufen und Kristallhoehen an einem handgebauten Level', () => {
    const L = parseLevel([
      '.........o....',
      '.....o...##...',
      'S.........##.G',
      '###..#########',
    ]);
    const g = geometrie(L);
    expect(g.luecken).toEqual([2]);
    expect(g.stufen).toEqual([2, -1, -1]); // hoch auf die 2er-Stufe, dann zweimal eine Kachel runter
    expect(g.kristallHoehen).toEqual([1, 0]); // Kristall ueber Spalte 5 schwebt 1 Kachel, der andere liegt auf
    expect(g.startFrei).toBe(true);
  });

  test('geometrie: Kristall ohne Boden darunter zaehlt als unendlich hoch, Start in Dornen ist nicht frei', () => {
    const L = parseLevel([
      '...o..........',
      '......o.......',
      'S^...........G',
      '###..#########',
    ]);
    const g = geometrie(L);
    expect(g.kristallHoehen).toEqual([Infinity, 1]);
    expect(g.startFrei).toBe(true);
    const IN_WAND = Object.assign({}, L, { start: { tx: 2, ty: 3, x: 2 * 16 + 3, y: 4 * 16 - 12 } });
    expect(geometrie(IN_WAND).startFrei).toBe(false);
    const IN_DORNEN = Object.assign({}, L, { start: { tx: 1, ty: 2, x: 1 * 16 + 3, y: 3 * 16 - 12 } });
    expect(geometrie(IN_DORNEN).startFrei).toBe(false);
  });
});
