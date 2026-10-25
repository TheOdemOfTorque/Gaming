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
