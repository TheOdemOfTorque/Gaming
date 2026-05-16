const { getMaxReihe, getMaxFactor, getQuestionWeight, pickWeightedFactor } = require('../../1x1-trainer/logic.js');

describe('getMaxReihe', () => {
  test('grosses1x1=false → 10', () => {
    expect(getMaxReihe({ grosses1x1: false })).toBe(10);
  });

  test('grosses1x1=true → 20', () => {
    expect(getMaxReihe({ grosses1x1: true })).toBe(20);
  });
});

describe('getMaxFactor', () => {
  test('grosses1x1=false → 10 unabhängig von reihe', () => {
    expect(getMaxFactor({ grosses1x1: false, reiheMax: {} }, 5)).toBe(10);
  });

  test('grosses1x1=true → reiheMax[reihe]', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: { 3: 15 } }, 3)).toBe(15);
  });

  test('grosses1x1=true, reiheMax[reihe] fehlt → 20 (Fallback)', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: {} }, 7)).toBe(20);
  });

  test('grosses1x1=true, reiheMax[reihe]=0 → 20 (|| 20-Fallback)', () => {
    expect(getMaxFactor({ grosses1x1: true, reiheMax: { 3: 0 } }, 3)).toBe(20);
  });
});

describe('getQuestionWeight', () => {
  test('fehlende Stats → 5 (Neuling-Default)', () => {
    expect(getQuestionWeight({}, 3, 4)).toBe(5);
  });

  test('correct=0, wrong=0 → 5', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:0, wrong:0, consecutiveCorrect:0 } } }, 3, 4)).toBe(5);
  });

  test('consecutiveCorrect=6 → 1', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:6, wrong:0, consecutiveCorrect:6 } } }, 3, 4)).toBe(1);
  });

  test('consecutiveCorrect=5 → 2', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:5, wrong:0, consecutiveCorrect:5 } } }, 3, 4)).toBe(2);
  });

  test('consecutiveCorrect=3 → 3', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:3, wrong:0, consecutiveCorrect:3 } } }, 3, 4)).toBe(3);
  });

  test('consecutiveCorrect=1 → 5', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:1, wrong:0, consecutiveCorrect:1 } } }, 3, 4)).toBe(5);
  });

  test('nie korrekt, wrong=3 → min(4 + 3*2, 12) = 10', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:0, wrong:3, consecutiveCorrect:0 } } }, 3, 4)).toBe(10);
  });

  test('nie korrekt, wrong=20 → 12 (Cap)', () => {
    expect(getQuestionWeight({ 3: { 4: { correct:0, wrong:20, consecutiveCorrect:0 } } }, 3, 4)).toBe(12);
  });
});

describe('pickWeightedFactor', () => {
  afterEach(() => jest.restoreAllMocks());

  test('Math.random=0 → erster Faktor (1)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickWeightedFactor({}, 3, 5)).toBe(1);
  });

  test('Math.random=0.999 → letzter Faktor (maxF)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(pickWeightedFactor({}, 3, 5)).toBe(5);
  });

  test('Statistik: gleiche Weights → Gleichverteilung über 1000 Runs', () => {
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 1000; i++) counts[pickWeightedFactor({}, 3, 5) - 1]++;
    counts.forEach(c => expect(c).toBeGreaterThan(150));
  });
});
