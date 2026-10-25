const { computeLernstand } = require('../../1x1-trainer/logic.js');

// Lernstand je Reihe fuer Lumo (jnr:init.lernstand): Mittel ueber die Faktoren 1..10 von
// min(consecutiveCorrect, 6) / 6 (6 = Leitner-Meisterschaft wie im Statistik-Screen).
// Nur Reihen 2..10, nur bereits geuebte Reihen (mind. eine beantwortete Aufgabe).
function qs(cc, correct = cc, wrong = 0) { return { correct, wrong, consecutiveCorrect: cc }; }

describe('computeLernstand', () => {
  test('leere questionStats ergeben ein leeres Objekt', () => {
    expect(computeLernstand({})).toEqual({});
    expect(computeLernstand(undefined)).toEqual({});
  });

  test('alle 10 Aufgaben gemeistert ergibt 1', () => {
    const s = { 7: {} };
    for (let f = 1; f <= 10; f++) s[7][f] = qs(6);
    expect(computeLernstand(s)).toEqual({ 7: 1 });
  });

  test('Serien ueber 6 zaehlen wie 6', () => {
    const s = { 3: {} };
    for (let f = 1; f <= 10; f++) s[3][f] = qs(12);
    expect(computeLernstand(s)[3]).toBe(1);
  });

  test('geuebt erst ab 3 verschiedenen beantworteten Faktoren', () => {
    expect(computeLernstand({ 3: { 1: qs(3) } })).toEqual({});
    expect(computeLernstand({ 3: { 1: qs(3), 2: qs(1) } })).toEqual({});
    expect(computeLernstand({ 3: { 1: qs(3), 2: qs(0, 0, 0), 4: qs(2) } })).toEqual({});
  });

  test('ungesehene Faktoren zaehlen als 0, gerundet auf 2 Stellen', () => {
    // 3x1, 3x2, 3x3 mit Serie 3/0/0 -> (3/6) / 10 = 0.05
    expect(computeLernstand({ 3: { 1: qs(3), 2: qs(0, 0, 1), 3: qs(0, 0, 2) } })).toEqual({ 3: 0.05 });
    // 4 Faktoren mit Serie 6, Rest ungesehen -> 0.4
    const s = { 4: { 1: qs(6), 2: qs(6), 3: qs(6), 4: qs(6) } };
    expect(computeLernstand(s)).toEqual({ 4: 0.4 });
  });

  test('nur falsch beantwortet ist geuebt mit Wert 0', () => {
    expect(computeLernstand({ 8: { 5: qs(0, 0, 1), 6: qs(0, 0, 2), 7: qs(0, 0, 3) } })).toEqual({ 8: 0 });
  });

  test('Eintraege ohne Antworten (correct=0, wrong=0) gelten als nicht geuebt', () => {
    expect(computeLernstand({ 5: { 1: qs(0, 0, 0) } })).toEqual({});
  });

  test('Reihen ausserhalb 2..10 und Faktoren ueber 10 werden ignoriert', () => {
    const s = { 1: { 1: qs(6) }, 11: { 1: qs(6) }, 15: { 2: qs(6) }, 6: { 12: qs(6) } };
    expect(computeLernstand(s)).toEqual({});
  });

  test('mehrere Reihen, Schluessel als Strings', () => {
    const s = { 2: {}, 9: { 1: qs(1, 1, 2), 2: qs(0, 0, 1), 3: qs(0, 1, 1) } };
    for (let f = 1; f <= 10; f++) s[2][f] = qs(f <= 9 ? 6 : 0, 5, 1);
    const l = computeLernstand(s);
    expect(Object.keys(l).sort()).toEqual(['2', '9']);
    expect(l['2']).toBe(0.9);
    expect(l['9']).toBe(0.02);
  });

  test('kaputte Eintraege werfen nicht', () => {
    expect(computeLernstand({ 4: null, 5: { 1: null, 2: 'x' }, 6: 'kaputt' })).toEqual({});
  });

  test('mutiert die Eingabe nicht', () => {
    const s = { 7: { 1: qs(2) } };
    const copy = JSON.parse(JSON.stringify(s));
    computeLernstand(s);
    expect(s).toEqual(copy);
  });
});
