const R = require('../../jumpnrun/core/rewards.js');

const base = { reached: true, richtig: 10, totalGood: 10, fehltreffer: 0 };

describe('parseLevelId', () => {
  test('liest Welt und Nummer', () => { expect(R.parseLevelId('1-2')).toEqual({ welt: 1, nr: 2 }); });
  test('ungültig wirft', () => {
    expect(() => R.parseLevelId('x')).toThrow();
    expect(() => R.parseLevelId('1-0')).toThrow();
  });
});

describe('calcMedals', () => {
  test('alle drei bei perfektem Lauf', () => {
    expect(R.calcMedals(base)).toEqual({ geschafft: true, funken: true, fehlerfrei: true, anzahl: 3 });
  });
  test('ohne Ziel keine Medaille', () => {
    expect(R.calcMedals({ ...base, reached: false }).anzahl).toBe(0);
  });
  test('Funken-Medaille ab 80 Prozent', () => {
    expect(R.calcMedals({ ...base, richtig: 8 }).funken).toBe(true);
    expect(R.calcMedals({ ...base, richtig: 7 }).funken).toBe(false);
  });
  test('Fehltreffer kostet die dritte Medaille', () => {
    const m = R.calcMedals({ ...base, fehltreffer: 1 });
    expect(m).toMatchObject({ geschafft: true, funken: true, fehlerfrei: false, anzahl: 2 });
  });
  test('ohne gute Kristalle zählt die Funken-Medaille automatisch', () => {
    expect(R.calcMedals({ reached: true, richtig: 0, totalGood: 0, fehltreffer: 0 }).funken).toBe(true);
  });
});

describe('xpFor', () => {
  test('beim ersten Abschluss: 20 mal Levelnummer plus 10 je Medaille', () => {
    expect(R.xpFor('1-1', 3, false)).toBe(20 * 1 + 30);
    expect(R.xpFor('1-2', 1, false)).toBe(20 * 2 + 10);
  });
  test('Wiederholung gibt keine XP', () => { expect(R.xpFor('1-1', 3, true)).toBe(0); });
  test('ohne Medaille keine XP', () => { expect(R.xpFor('1-1', 0, false)).toBe(0); });
});

describe('buildResult', () => {
  const jnr = R.defaultJnr();
  test('liefert Level, Medaillen, Funken und XP', () => {
    const r = R.buildResult('1-1', { ...base, funken: 9, timeMs: 61000 }, jnr);
    expect(r).toMatchObject({ level: '1-1', medaillen: 3, funken: 9, xp: 50, timeMs: 61000 });
  });
  test('zweiter Abschluss desselben Levels gibt 0 XP', () => {
    const j2 = R.mergeResult(jnr, R.buildResult('1-1', { ...base, funken: 9, timeMs: 61000 }, jnr));
    expect(R.buildResult('1-1', { ...base, funken: 9, timeMs: 50000 }, j2).xp).toBe(0);
  });
});

describe('mergeResult', () => {
  const r1 = { level: '1-1', medaillen: 2, funken: 7, xp: 40, timeMs: 70000 };
  test('legt Bestwerte an und markiert XP als ausgezahlt', () => {
    const j = R.mergeResult(R.defaultJnr(), r1);
    expect(j.levels['1-1']).toEqual({ medals: 2, bestTimeMs: 70000, bestFunken: 7 });
    expect(j.xpAwarded['1-1']).toBe(true);
    expect(j.funkenTotal).toBe(7);
    expect(j.lastLevel).toBe('1-1');
  });
  test('behält bessere Altwerte, übernimmt bessere neue', () => {
    let j = R.mergeResult(R.defaultJnr(), r1);
    j = R.mergeResult(j, { level: '1-1', medaillen: 1, funken: 9, xp: 0, timeMs: 60000 });
    expect(j.levels['1-1']).toEqual({ medals: 2, bestTimeMs: 60000, bestFunken: 9 });
    expect(j.funkenTotal).toBe(16);
  });
  test('verändert das Eingabeobjekt nicht', () => {
    const j0 = R.defaultJnr();
    R.mergeResult(j0, r1);
    expect(j0.levels).toEqual({});
  });
});

describe('Freischaltung', () => {
  const order = ['1-1', '1-2'];
  test('Level 1 ist immer offen, Level 2 nach Abschluss von Level 1', () => {
    const j0 = R.defaultJnr();
    expect(R.isUnlocked(j0, '1-1', order)).toBe(true);
    expect(R.isUnlocked(j0, '1-2', order)).toBe(false);
    const j1 = R.mergeResult(j0, { level: '1-1', medaillen: 1, funken: 0, xp: 30, timeMs: 1 });
    expect(R.isUnlocked(j1, '1-2', order)).toBe(true);
  });
});

describe('sanitizeJnr', () => {
  test('kaputte Daten ergeben Standardwerte', () => {
    expect(R.sanitizeJnr(null)).toEqual(R.defaultJnr());
    expect(R.sanitizeJnr('quatsch')).toEqual(R.defaultJnr());
    expect(R.sanitizeJnr({ levels: 5, options: 'x' })).toEqual(R.defaultJnr());
  });
  test('gültige Teile bleiben, ungültige Medaillen werden begrenzt', () => {
    const j = R.sanitizeJnr({ levels: { '1-1': { medals: 9, bestTimeMs: -3, bestFunken: 'a' } }, funkenTotal: 12, options: { steuerung: 'einfach' } });
    expect(j.levels['1-1'].medals).toBe(3);
    expect(j.levels['1-1'].bestTimeMs).toBeNull();
    expect(j.levels['1-1'].bestFunken).toBe(0);
    expect(j.funkenTotal).toBe(12);
    expect(j.options.steuerung).toBe('einfach');
    expect(j.options.mathe).toBe('ziel');
  });
  test('Standard-Optionen', () => {
    expect(R.defaultJnr().options).toEqual({ steuerung: 'standard', mathe: 'ziel', farbhilfe: true, musik: true });
  });
});

describe('verlorener Lauf (alle Leben weg)', () => {
  const lost = { reached: false, lost: true, leben: 0, richtig: 9, totalGood: 10, fehltreffer: 9, funken: 4, timeMs: 30000 };
  test('buildResult: keine Medaille, kein XP', () => {
    const r = R.buildResult('1-2', lost, R.defaultJnr());
    expect(r.medaillen).toBe(0);
    expect(r.xp).toBe(0);
  });
  test('shouldReport: nur geschaffte Laeufe gehen als jnr:result an den Trainer', () => {
    expect(R.shouldReport(lost)).toBe(false);
    expect(R.shouldReport({ ...base, lost: false })).toBe(true);
    expect(R.shouldReport({ ...base, reached: true, lost: true })).toBe(false);
  });
});

describe('Tutorial-Flag (tutorialGesehen)', () => {
  test('Standard: noch nicht gesehen', () => {
    expect(R.defaultJnr().tutorialGesehen).toBe(false);
  });
  test('sanitizeJnr übernimmt nur ein echtes true', () => {
    expect(R.sanitizeJnr({ tutorialGesehen: true }).tutorialGesehen).toBe(true);
    expect(R.sanitizeJnr({ tutorialGesehen: 'ja' }).tutorialGesehen).toBe(false);
    expect(R.sanitizeJnr({ tutorialGesehen: 1 }).tutorialGesehen).toBe(false);
    expect(R.sanitizeJnr({}).tutorialGesehen).toBe(false);
  });
  test('mergeResult (Trainer bei jnr:result) verliert das Flag nicht', () => {
    const j = R.mergeResult({ tutorialGesehen: true }, { level: '1-1', medaillen: 1, funken: 2, xp: 30, timeMs: 5 });
    expect(j.tutorialGesehen).toBe(true);
  });
});
