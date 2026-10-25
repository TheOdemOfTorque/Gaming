const K = require('../../knobel/knobel-logic.js');

// Die interaktiven Tutorial-Mini-Aufgaben (index.html, TUTORIAL.kaefige[2] und
// TUTORIAL.mauer[0..1]) muessen eindeutig loesbar sein, geprueft mit dem
// vorhandenen zaehlenden Loeser (solvePyramid fuer die Mauer, cageOk -- den
// auch solveCages/logicSolveCages fuer die Kaefig-Korrektheit nutzen -- als
// erschoepfende Pruefung ueber den angebotenen Zahlenbereich).

describe('Tutorial-Mini-Aufgabe Rechenkaefige: "Welche zwei Zahlen ergeben malgenommen 6?"', () => {
  test('genau ein Zahlenpaar aus {1,2,3} erfuellt × = 6', () => {
    const bereich = [1, 2, 3];
    const treffer = [];
    for (let i = 0; i < bereich.length; i++) {
      for (let j = i + 1; j < bereich.length; j++) {
        if (K.cageOk({ op: '×', ziel: 6 }, [bereich[i], bereich[j]])) treffer.push([bereich[i], bereich[j]]);
      }
    }
    expect(treffer).toEqual([[2, 3]]);
  });
});

describe('Tutorial-Mini-Aufgabe Zahlenmauer: Ergebnis ausrechnen (2 x 3 = _)', () => {
  test('solvePyramid findet genau eine Loesung fuer das fehlende Ergebnis', () => {
    const p = { n: 2, fmin: 1, fmax: 9, regeln: ['', 'mul'], gegeben: [[2, 3], [null]] };
    expect(K.solvePyramid(p, 2)).toBe(1);
  });
});

describe('Tutorial-Mini-Aufgabe Zahlenmauer: Umkehraufgabe (3 x _ = 12)', () => {
  test('solvePyramid findet genau eine Loesung fuer die fehlende Quelle', () => {
    const p = { n: 2, fmin: 1, fmax: 9, regeln: ['', 'mul'], gegeben: [[3, null], [12]] };
    expect(K.solvePyramid(p, 2)).toBe(1);
    // Die gefundene Zahl ist tatsaechlich 4, nicht nur "irgendeine eindeutige".
    const geloest = K.logicSolvePyramid(p);
    expect(geloest.geloest).toBe(true);
    expect(geloest.zeilen[0][1]).toBe(4);
  });
});
