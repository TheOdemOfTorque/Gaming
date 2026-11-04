const { generateTrainingSequence, defaultSettings, defaultState,
        initSeededRNG, resetRNG } = require('../../1x1-trainer/logic.js');

// Helper: settings with grosses1x1 toggle
function settingsSmall() { return defaultSettings(); } // grosses1x1=false → maxF=10
function settingsLarge() {
  const s = defaultSettings();
  s.grosses1x1 = true;
  return s; // maxF=20
}

// Helper: minimal questionStats
function emptyStats() { return {}; }

beforeEach(() => {
  // Deterministisch testen — seed RNG vor jedem Test
  initSeededRNG(12345);
});
afterEach(() => resetRNG());

describe('generateTrainingSequence — Single-Row (BC zu altem Verhalten)', () => {
  test('reihen=[3] → 20 pairs, alle a===3, alle b in 1..10', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), [3]);
    expect(seq.length).toBe(20);
    seq.forEach(p => {
      expect(p.a).toBe(3);
      expect(p.b).toBeGreaterThanOrEqual(1);
      expect(p.b).toBeLessThanOrEqual(10);
    });
  });

  test('reihen=[7] mit grosses1x1 → 30 pairs, b in 1..20', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsLarge(), [7]);
    expect(seq.length).toBe(30);
    seq.forEach(p => {
      expect(p.a).toBe(7);
      expect(p.b).toBeGreaterThanOrEqual(1);
      expect(p.b).toBeLessThanOrEqual(20);
    });
  });

  test('reihen=[5]: alle 10 Faktoren mindestens 1× enthalten (required-set)', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), [5]);
    const distinctFactors = new Set(seq.map(p => p.b));
    for (let f = 1; f <= 10; f++) expect(distinctFactors.has(f)).toBe(true);
  });
});

describe('generateTrainingSequence — Multi-Row Mix', () => {
  test('reihen=[3,7] → 20 pairs, beide Reihen vertreten', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), [3, 7]);
    expect(seq.length).toBe(20);
    const aSet = new Set(seq.map(p => p.a));
    expect(aSet.has(3)).toBe(true);
    expect(aSet.has(7)).toBe(true);
    expect(aSet.size).toBe(2);
  });

  test('reihen=[3,7] → ungefähr gleiche Verteilung (10/10)', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), [3, 7]);
    const count3 = seq.filter(p => p.a === 3).length;
    const count7 = seq.filter(p => p.a === 7).length;
    expect(count3).toBe(10);
    expect(count7).toBe(10);
  });

  test('reihen=[3,7,8] → 20 pairs, Verteilung 7/7/6 (Remainder auf ersten)', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), [3, 7, 8]);
    expect(seq.length).toBe(20);
    const count3 = seq.filter(p => p.a === 3).length;
    const count7 = seq.filter(p => p.a === 7).length;
    const count8 = seq.filter(p => p.a === 8).length;
    expect(count3 + count7 + count8).toBe(20);
    // baseShare = 6, remainder = 2 → ersten 2 Reihen bekommen +1 → 7, 7, 6
    expect(count3).toBe(7);
    expect(count7).toBe(7);
    expect(count8).toBe(6);
  });

  test('Mix mit grosses1x1 → 30 pairs', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsLarge(), [3, 5]);
    expect(seq.length).toBe(30);
    expect(seq.filter(p => p.a === 3).length).toBe(15);
    expect(seq.filter(p => p.a === 5).length).toBe(15);
  });

  test('per-Reihe alle b im erlaubten Range', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), [4, 6]);
    seq.filter(p => p.a === 4).forEach(p => {
      expect(p.b).toBeGreaterThanOrEqual(1);
      expect(p.b).toBeLessThanOrEqual(10);
    });
    seq.filter(p => p.a === 6).forEach(p => {
      expect(p.b).toBeGreaterThanOrEqual(1);
      expect(p.b).toBeLessThanOrEqual(10);
    });
  });
});

describe('generateTrainingSequence — Edge Cases', () => {
  test('leere reihen[] → leere Sequenz', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), []);
    expect(seq).toEqual([]);
  });

  test('scalar input (BC) wird in Array gewrappt', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), 5);
    expect(seq.length).toBe(20);
    seq.forEach(p => expect(p.a).toBe(5));
  });

  test('Sequenz ist geshufflet — nicht alle a===3 vor a===7', () => {
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), [3, 7]);
    // Wenn perfekt sortiert wäre, würden die ersten 10 alle dieselbe a haben.
    // Mit shuffle ist das praktisch unmöglich (1/C(20,10) ≈ 5×10⁻⁶).
    const firstTen = seq.slice(0, 10).map(p => p.a);
    const hasBoth = firstTen.includes(3) && firstTen.includes(7);
    expect(hasBoth).toBe(true);
  });

  test('alle 10 Reihen Mix mit grosses1x1=false → totalQ=20, je Reihe 2 Pairs', () => {
    const allRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const seq = generateTrainingSequence(emptyStats(), settingsSmall(), allRows);
    expect(seq.length).toBe(20);
    allRows.forEach(r => {
      expect(seq.filter(p => p.a === r).length).toBe(2);
    });
  });
});

describe('generateTrainingSequence — keine direkte Wiederholung', () => {
  const { ordneOhneDirekteWiederholung } = require('../../1x1-trainer/logic.js');
  const key = p => p.a + 'x' + p.b;
  function direkteWiederholungen(seq) {
    let n = 0;
    for (let i = 1; i < seq.length; i++) if (key(seq[i]) === key(seq[i - 1])) n++;
    return n;
  }
  // Schwache 7er-Stats: Faktor 8 oft falsch, Faktor 3 oft falsch → hohes Leitner-Gewicht
  function schwacheStats() {
    return { 7: { 8: { correct: 1, wrong: 9, consecutiveCorrect: 0 },
                  3: { correct: 0, wrong: 6, consecutiveCorrect: 0 } } };
  }

  test.each([
    ['[3] kleines 1×1', settingsSmall, [3], emptyStats],
    ['[7] großes 1×1', settingsLarge, [7], emptyStats],
    ['[3,7] Mix', settingsSmall, [3, 7], emptyStats],
    ['[7] mit schwachen Faktoren', settingsSmall, [7], schwacheStats],
  ])('%s: über 500 Seeds nie dieselbe Aufgabe direkt hintereinander', (_n, settings, reihen, stats) => {
    let summe = 0;
    for (let seed = 1; seed <= 500; seed++) {
      initSeededRNG(seed);
      summe += direkteWiederholungen(generateTrainingSequence(stats(), settings(), reihen));
    }
    expect(summe).toBe(0);
  });

  test('Anzahl je Paar bleibt beim Umordnen erhalten', () => {
    const pairs = [{a:3,b:1},{a:3,b:1},{a:3,b:2},{a:3,b:2},{a:3,b:2},{a:3,b:4}];
    const out = ordneOhneDirekteWiederholung(pairs.slice());
    expect(out.map(key).sort()).toEqual(pairs.map(key).sort());
    expect(direkteWiederholungen(out)).toBe(0);
  });

  test('unlösbare Eingabe (5× dasselbe Paar) liefert alle Elemente ohne Fehler', () => {
    const pairs = Array.from({ length: 5 }, () => ({ a: 4, b: 4 }));
    const out = ordneOhneDirekteWiederholung(pairs);
    expect(out).toHaveLength(5);
  });

  test('leere Eingabe → leeres Array', () => {
    expect(ordneOhneDirekteWiederholung([])).toEqual([]);
  });
});

describe('ordneOhneDirekteWiederholung — Verteilung bleibt zufällig', () => {
  const { ordneOhneDirekteWiederholung } = require('../../1x1-trainer/logic.js');

  // 7er-Reihe: 8 und 3 je 5×, die übrigen 8 Faktoren je 1× (20 Aufgaben)
  function eingabe() {
    const p = [];
    for (let i = 0; i < 5; i++) { p.push({ a: 7, b: 8 }); p.push({ a: 7, b: 3 }); }
    [1, 2, 4, 5, 6, 7, 9, 10].forEach(b => p.push({ a: 7, b }));
    return p;
  }

  test('Mehrfach-Faktoren ballen sich nicht in der ersten Hälfte', () => {
    let vorne = 0, hinten = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      initSeededRNG(seed);
      const out = ordneOhneDirekteWiederholung(eingabe());
      out.forEach((p, i) => {
        if (p.b === 8 || p.b === 3) { if (i < 10) vorne++; else hinten++; }
      });
    }
    // gleichverteilt wären je ~5000; die gierige Variante lag bei ~10000 zu 0
    expect(vorne / (vorne + hinten)).toBeLessThan(0.6);
  });

  test('erste Aufgabe ist nicht immer ein Mehrfach-Faktor', () => {
    let mehrfachVorn = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      initSeededRNG(seed);
      const b = ordneOhneDirekteWiederholung(eingabe())[0].b;
      if (b === 8 || b === 3) mehrfachVorn++;
    }
    expect(mehrfachVorn / 1000).toBeLessThan(0.75); // Anteil in der Eingabe: 10/20
  });

  test('zufällige lösbare Eingaben: nie eine direkte Wiederholung', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      initSeededRNG(seed);
      const n = 2 + Math.floor(Math.random() * 25);
      const arten = 1 + Math.floor(Math.random() * 8);
      const p = Array.from({ length: n }, () => ({ a: 2, b: 1 + Math.floor(Math.random() * arten) }));
      const anzahl = {};
      p.forEach(x => { anzahl[x.b] = (anzahl[x.b] || 0) + 1; });
      if (Math.max(...Object.values(anzahl)) > Math.ceil(n / 2)) continue;
      const out = ordneOhneDirekteWiederholung(p);
      expect(out).toHaveLength(n);
      for (let i = 1; i < out.length; i++) expect(out[i].b).not.toBe(out[i - 1].b);
    }
  });
});
