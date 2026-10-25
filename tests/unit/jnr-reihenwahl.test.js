const RW = require('../../jumpnrun/core/reihenwahl.js');

describe('REIHEN', () => {
  test('wählbar sind die Reihen 2 bis 10', () => {
    expect(RW.REIHEN).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  test('istReihe', () => {
    expect(RW.istReihe(2)).toBe(true);
    expect(RW.istReihe(10)).toBe(true);
    expect(RW.istReihe(1)).toBe(false);
    expect(RW.istReihe(11)).toBe(false);
    expect(RW.istReihe(2.5)).toBe(false);
    expect(RW.istReihe('7')).toBe(false);
    expect(RW.istReihe(null)).toBe(false);
  });
});

describe('empfehlungen', () => {
  test('ohne Lernstand (Standalone) keine Empfehlung', () => {
    expect(RW.empfehlungen(null)).toEqual([]);
    expect(RW.empfehlungen(undefined)).toEqual([]);
    expect(RW.empfehlungen({})).toEqual([]);
  });
  test('die zwei schwächsten geübten Reihen, schwächste zuerst', () => {
    expect(RW.empfehlungen({ 2: 0.9, 7: 0.3, 5: 0.6, 9: 0.45 })).toEqual([7, 9]);
  });
  test('nur eine geübte Reihe ergibt eine Empfehlung', () => {
    expect(RW.empfehlungen({ 4: 0.2 })).toEqual([4]);
  });
  test('gemeisterte Reihen (Wert 1) werden nicht empfohlen', () => {
    expect(RW.empfehlungen({ 2: 1, 3: 1, 6: 0.8 })).toEqual([6]);
    expect(RW.empfehlungen({ 2: 1, 3: 1 })).toEqual([]);
  });
  test('Gleichstand: kleinere Reihe zuerst', () => {
    expect(RW.empfehlungen({ 8: 0.5, 3: 0.5, 6: 0.5 })).toEqual([3, 6]);
  });
  test('Schlüssel außerhalb 2..10 und kaputte Werte werden ignoriert', () => {
    expect(RW.empfehlungen({ 1: 0, 12: 0, 5: 'x', 6: NaN, 7: 0.4 })).toEqual([7]);
  });
});

describe('vorauswahl', () => {
  test('schwächste Empfehlung geht vor', () => {
    expect(RW.vorauswahl({ 2: 0.9, 7: 0.3 }, 4, 2)).toBe(7);
  });
  test('ohne Empfehlung die zuletzt gewählte Reihe', () => {
    expect(RW.vorauswahl(null, 6, 2)).toBe(6);
  });
  test('ohne Empfehlung und ohne gültige letzte Wahl die Reihe der Stufe', () => {
    expect(RW.vorauswahl(null, null, 3)).toBe(3);
    expect(RW.vorauswahl(null, 42, 3)).toBe(3);
  });
  test('letzter Ausweg ist die 2er-Reihe', () => {
    expect(RW.vorauswahl(null, null, null)).toBe(2);
    expect(RW.vorauswahl(null, null, 12)).toBe(2);
  });
});

describe('naechsteReihe (Tastatur im 3er-Raster 2-3-4 / 5-6-7 / 8-9-10)', () => {
  test('links und rechts gehen eine Reihe weiter', () => {
    expect(RW.naechsteReihe(5, 'rechts')).toBe(6);
    expect(RW.naechsteReihe(6, 'links')).toBe(5);
  });
  test('hoch und runter springen um eine Zeile', () => {
    expect(RW.naechsteReihe(3, 'runter')).toBe(6);
    expect(RW.naechsteReihe(9, 'hoch')).toBe(6);
  });
  test('am Rand bleibt die Auswahl stehen', () => {
    expect(RW.naechsteReihe(2, 'links')).toBe(2);
    expect(RW.naechsteReihe(10, 'rechts')).toBe(10);
    expect(RW.naechsteReihe(3, 'hoch')).toBe(3);
    expect(RW.naechsteReihe(9, 'runter')).toBe(9);
  });
  test('unbekannte Richtung ändert nichts', () => {
    expect(RW.naechsteReihe(7, 'quer')).toBe(7);
  });
});

describe('Texte', () => {
  test('beispiel nennt die ersten drei Ergebnisse der Reihe', () => {
    expect(RW.beispiel(7)).toBe('7, 14, 21');
    expect(RW.beispiel(10)).toBe('10, 20, 30');
  });
  test('chipReihe und zaehler', () => {
    expect(RW.chipReihe(7)).toBe('7er-Reihe');
    expect(RW.zaehler(3, 10)).toBe('3 / 10');
    expect(RW.zaehler(0, 0)).toBe('0 / 0');
  });
});
