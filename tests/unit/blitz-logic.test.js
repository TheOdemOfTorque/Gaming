const { pickBlitzReihe, addBlitzListeEntry } = require('../../1x1-trainer/logic.js');

describe('pickBlitzReihe', () => {
  test('gibt null zurück wenn alleReihen true', () => {
    expect(pickBlitzReihe({ alleReihen: true, reihen: [] }, 10)).toBeNull();
  });

  test('gibt null zurück wenn reihen leer', () => {
    expect(pickBlitzReihe({ alleReihen: false, reihen: [] }, 10)).toBeNull();
  });

  test('gibt immer eine Zahl aus reihen zurück', () => {
    const cfg = { alleReihen: false, reihen: [3, 5] };
    for (let i = 0; i < 50; i++) {
      expect([3, 5]).toContain(pickBlitzReihe(cfg, 10));
    }
  });
});

describe('addBlitzListeEntry', () => {
  test('fügt einen Eintrag hinzu', () => {
    const result = addBlitzListeEntry([], { score: 10, reihen: [], alleReihen: true, datum: '19.04.2026' });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(10);
  });

  test('sortiert absteigend nach score', () => {
    const liste = [{ score: 20 }, { score: 15 }, { score: 30 }];
    const result = addBlitzListeEntry(liste, { score: 25 });
    expect(result.map(e => e.score)).toEqual([30, 25, 20, 15]);
  });

  test('begrenzt auf 5 Einträge', () => {
    const liste = [{ score: 50 }, { score: 40 }, { score: 30 }, { score: 20 }, { score: 10 }];
    const result = addBlitzListeEntry(liste, { score: 45 });
    expect(result).toHaveLength(5);
    expect(result[0].score).toBe(50);
    expect(result[4].score).toBe(20);
  });

  test('neuer Rekord landet auf Platz 1', () => {
    const liste = [{ score: 30 }, { score: 20 }];
    const result = addBlitzListeEntry(liste, { score: 99 });
    expect(result[0].score).toBe(99);
  });
});
