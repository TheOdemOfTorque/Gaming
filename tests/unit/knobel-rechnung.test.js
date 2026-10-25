const K = require('../../knobel/knobel-logic.js');

// rechnungFuer(kaefig|stein, eingaben) baut die Rechnung fuer den Rechenstreifen.
// kaefig: { op: '+'|'×'|'−'|'÷'|'=', ziel }, eingaben = Zellenwerte (null = leer), 1..4 Glieder.
// stein (Zahlenmauer): { op: 'mul'|'add' }, eingaben = [a, b, ergebnis] (null = leer/noch nicht getippt).

describe('rechnungFuer: Rechenkaefige', () => {
  test('Plus, drei Felder, teilweise gefuellt', () => {
    const r = K.rechnungFuer({ op: '+', ziel: 8 }, [4, null, 1]);
    expect(r.op).toBe('+');
    expect(r.glieder).toEqual([4, null, 1]);
    expect(r.lueckeIndex).toBe(1);
    expect(r.ergebnis).toBe(8);
    expect(r.ergebnisIstLuecke).toBe(false);
    expect(r.vollstaendig).toBe(false);
    expect(r.erfuellt).toBeNull();
  });

  test('Mal, vier Felder, teilweise gefuellt (Mockup-Beispiel 4 x 1 x _ = 8)', () => {
    const r = K.rechnungFuer({ op: '×', ziel: 8 }, [4, 1, null]);
    expect(r.glieder).toEqual([4, 1, null]);
    expect(r.lueckeIndex).toBe(2);
    expect(r.ergebnis).toBe(8);
    expect(r.vollstaendig).toBe(false);
  });

  test('Mal, zwei Felder, voll und falsch: zeigt das tatsaechliche Ergebnis, nicht die Zielzahl', () => {
    const r = K.rechnungFuer({ op: '×', ziel: 18 }, [3, 5]);
    expect(r.glieder).toEqual([3, 5]);
    expect(r.vollstaendig).toBe(true);
    expect(r.erfuellt).toBe(false);
    expect(r.computed).toBe(15);
    expect(r.ergebnis).toBe(15);
  });

  test('Mal, zwei Felder, voll und richtig', () => {
    const r = K.rechnungFuer({ op: '×', ziel: 18 }, [3, 6]);
    expect(r.vollstaendig).toBe(true);
    expect(r.erfuellt).toBe(true);
    expect(r.ergebnis).toBe(18);
  });

  test('Minus: groessere Zahl steht vorne, unabhaengig von der Eingabereihenfolge', () => {
    const a = K.rechnungFuer({ op: '−', ziel: 2 }, [3, 5]);
    expect(a.glieder).toEqual([5, 3]);
    expect(a.computed).toBe(2);
    expect(a.erfuellt).toBe(true);
    const b = K.rechnungFuer({ op: '−', ziel: 2 }, [5, 3]);
    expect(b.glieder).toEqual([5, 3]);
  });

  test('Geteilt: groessere Zahl steht vorne', () => {
    const r = K.rechnungFuer({ op: '÷', ziel: 2 }, [3, 6]);
    expect(r.glieder).toEqual([6, 3]);
    expect(r.computed).toBe(2);
    expect(r.erfuellt).toBe(true);
  });

  test('Minus/Geteilt teilweise gefuellt: keine Umsortierung moeglich, Eingabereihenfolge bleibt', () => {
    const r = K.rechnungFuer({ op: '−', ziel: 2 }, [5, null]);
    expect(r.glieder).toEqual([5, null]);
    expect(r.lueckeIndex).toBe(1);
    expect(r.vollstaendig).toBe(false);
  });

  test('Ein-Feld-Kaefig "=" ist ein Geschenk', () => {
    const r = K.rechnungFuer({ op: '=', ziel: 3 }, [3]);
    expect(r.op).toBe('=');
    expect(r.glieder).toEqual([]);
    expect(r.ergebnis).toBe(3);
    expect(r.vollstaendig).toBe(true);
    expect(r.erfuellt).toBe(true);
  });

  test('Ein-Feld-Kaefig, noch nicht eingetragen', () => {
    const r = K.rechnungFuer({ op: '=', ziel: 3 }, [null]);
    expect(r.vollstaendig).toBe(false);
    expect(r.ergebnisIstLuecke).toBe(true);
    expect(r.erfuellt).toBeNull();
  });

  test('nichts eingetragen: Luecke beim ersten Glied', () => {
    const r = K.rechnungFuer({ op: '+', ziel: 5 }, [null, null]);
    expect(r.lueckeIndex).toBe(0);
    expect(r.vollstaendig).toBe(false);
  });
});

describe('rechnungFuer: Zahlenmauer-Steine', () => {
  test('Mauerstein, beide Quellen bekannt, Ergebnis noch Luecke (3 x 4 = _)', () => {
    const r = K.rechnungFuer({ op: 'mul' }, [3, 4, null]);
    expect(r.op).toBe('×');
    expect(r.glieder).toEqual([3, 4]);
    expect(r.computed).toBe(12);
    expect(r.ergebnisIstLuecke).toBe(true);
    expect(r.lueckeIndex).toBeNull();
    expect(r.vollstaendig).toBe(false);
  });

  test('Mauerstein, Plus-Reihe', () => {
    const r = K.rechnungFuer({ op: 'add' }, [2, 3, null]);
    expect(r.op).toBe('+');
    expect(r.computed).toBe(5);
  });

  test('Umkehraufgabe: Ergebnis und eine Quelle bekannt (3 x _ = 12)', () => {
    const r = K.rechnungFuer({ op: 'mul' }, [3, null, 12]);
    expect(r.glieder).toEqual([3, null]);
    expect(r.lueckeIndex).toBe(1);
    expect(r.ergebnis).toBe(12);
    expect(r.ergebnisIstLuecke).toBe(false);
    expect(r.vollstaendig).toBe(false);
  });

  test('Umkehraufgabe mit der anderen Quelle bekannt (_ x 4 = 12)', () => {
    const r = K.rechnungFuer({ op: 'mul' }, [null, 4, 12]);
    expect(r.glieder).toEqual([null, 4]);
    expect(r.lueckeIndex).toBe(0);
  });

  test('Mauerstein vollstaendig und richtig', () => {
    const r = K.rechnungFuer({ op: 'mul' }, [3, 4, 12]);
    expect(r.vollstaendig).toBe(true);
    expect(r.erfuellt).toBe(true);
    expect(r.ergebnis).toBe(12);
  });

  test('Mauerstein vollstaendig und falsch (zeigt die getippte Zahl, nicht korrigiert)', () => {
    const r = K.rechnungFuer({ op: 'mul' }, [3, 4, 10]);
    expect(r.vollstaendig).toBe(true);
    expect(r.erfuellt).toBe(false);
    expect(r.ergebnis).toBe(10);
  });

  test('doppelte Zahl aendert die Rechnung selbst nicht (Satz kommt separat)', () => {
    const ohneDublette = K.rechnungFuer({ op: '×', ziel: 8 }, [4, 1, null]);
    const mitDublette = K.rechnungFuer({ op: '×', ziel: 8 }, [4, 1, null]);
    expect(mitDublette).toEqual(ohneDublette);
  });
});

describe('satzFuer: Saetze aus der Zustandstabelle', () => {
  test('Kaefig teilweise gefuellt', () => {
    const r = K.rechnungFuer({ op: '×', ziel: 8 }, [4, 1, null]);
    expect(K.satzFuer(r, { modus: 'kaefig' })).toBe('Malnehmen: Welche Zahl fehlt noch?');
  });
  test('Kaefig voll, falsch', () => {
    const r = K.rechnungFuer({ op: '×', ziel: 18 }, [3, 5]);
    expect(K.satzFuer(r, { modus: 'kaefig' })).toBe('Das ergibt 15, gesucht ist 18.');
  });
  test('Kaefig voll, richtig', () => {
    const r = K.rechnungFuer({ op: '×', ziel: 18 }, [3, 6]);
    expect(K.satzFuer(r, { modus: 'kaefig' })).toBe('Käfig fertig.');
  });
  test('Ein-Feld-Kaefig', () => {
    const r = K.rechnungFuer({ op: '=', ziel: 3 }, [3]);
    expect(K.satzFuer(r, { modus: 'kaefig' })).toBe('Diese Zahl ist geschenkt.');
  });
  test('Mauerstein teilweise (Ergebnis-Luecke)', () => {
    const r = K.rechnungFuer({ op: 'mul' }, [3, 4, null]);
    expect(K.satzFuer(r, { modus: 'mauer' })).toBe('Malnehmen: 3 mal 4 ergibt …');
  });
  test('Mauer-Umkehraufgabe (Quellen-Luecke)', () => {
    const r = K.rechnungFuer({ op: 'mul' }, [3, null, 12]);
    expect(K.satzFuer(r, { modus: 'mauer' })).toBe('Malnehmen: Welche Zahl fehlt noch?');
  });
  test('doppelte Zahl ueberschreibt den Satz', () => {
    const r = K.rechnungFuer({ op: '×', ziel: 8 }, [4, 1, null]);
    expect(K.satzFuer(r, { modus: 'kaefig', dublette: 3 })).toBe('Die 3 steht in dieser Zeile schon.');
  });
});
