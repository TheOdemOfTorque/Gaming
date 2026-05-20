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
