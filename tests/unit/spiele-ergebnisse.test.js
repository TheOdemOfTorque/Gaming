const { applyKnobelResult, applyJnrResult, migrateState } = require('../../1x1-trainer/logic.js');
const { computeKnobelXP } = require('../../knobel/knobel-logic.js');
const { mergeResult, xpFor } = require('../../jumpnrun/core/rewards.js');

function stateWithKnobelJnr(over) {
  return Object.assign(migrateState({}), over);
}

describe('applyKnobelResult', () => {
  test('schreibt die vom Spiel gemeldete XP gut, wenn sie plausibel ist', () => {
    const state = stateWithKnobelJnr({ xp: 100 });
    const msg = { type: 'knobel:result', mode: 'mauer', stufe: 2, tipps: 0, xp: 120, seed: 1 };
    const { state: next } = applyKnobelResult(state, msg, '2026-10-25', computeKnobelXP);
    expect(next.xp).toBe(220);
    expect(next.knobel.tagesXp).toEqual({ datum: '2026-10-25', xp: 120 });
    expect(next.knobel.stufe.mauer).toBe(2);
  });

  test('kappt eine zu hohe gemeldete XP auf die plausible Obergrenze', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    // Stufe 1 ohne Tipps, kein Tagesrätsel-Bonus bekannt -> Obergrenze mit
    // dem großzügigsten Fall (tagesraetsel: true) gerechnet.
    const obergrenze = computeKnobelXP({ stufe: 1, tipps: 0, tagesraetsel: true }, 0).xp;
    const msg = { type: 'knobel:result', mode: 'kaefige', stufe: 1, tipps: 0, xp: 999999, seed: 2 };
    const { state: next } = applyKnobelResult(state, msg, '2026-10-25', computeKnobelXP);
    expect(next.xp).toBe(obergrenze);
  });

  test('negative gemeldete XP werden auf 0 geklemmt', () => {
    const state = stateWithKnobelJnr({ xp: 50 });
    const msg = { type: 'knobel:result', mode: 'mauer', stufe: 1, tipps: 0, xp: -10, seed: 3 };
    const { state: next } = applyKnobelResult(state, msg, '2026-10-25', computeKnobelXP);
    expect(next.xp).toBe(50);
  });

  test('tagesXp wird am neuen Tag zurückgesetzt, bevor die neue XP gutgeschrieben wird', () => {
    const state = stateWithKnobelJnr({ xp: 0, knobel: { tagesXp: { datum: '2026-10-24', xp: 580 }, stufe: { mauer: 1, kaefige: 1 } } });
    const msg = { type: 'knobel:result', mode: 'mauer', stufe: 3, tipps: 0, xp: 150, seed: 4 };
    const { state: next } = applyKnobelResult(state, msg, '2026-10-25', computeKnobelXP);
    expect(next.knobel.tagesXp.datum).toBe('2026-10-25');
    expect(next.xp).toBe(150);
  });

  test('mutiert den Eingabe-State nicht', () => {
    const state = stateWithKnobelJnr({ xp: 10 });
    const msg = { type: 'knobel:result', mode: 'mauer', stufe: 1, tipps: 0, xp: 50, seed: 5 };
    applyKnobelResult(state, msg, '2026-10-25', computeKnobelXP);
    expect(state.xp).toBe(10);
  });

  test('dieselbe Ergebnis-Nachricht doppelt gesendet gibt die XP nur einmal gut', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    const msg = { type: 'knobel:result', mode: 'mauer', stufe: 2, tipps: 0, xp: 40, seed: 7 };
    let next = applyKnobelResult(state, msg, '2026-10-25', computeKnobelXP).state;
    expect(next.xp).toBe(40);
    // exakt dieselbe Nachricht kommt ein zweites Mal an (z.B. doppeltes postMessage)
    next = applyKnobelResult(next, msg, '2026-10-25', computeKnobelXP).state;
    expect(next.xp).toBe(40);
  });
});

describe('applyJnrResult', () => {
  test('schreibt die XP beim ersten Levelabschluss gut und merkt sich den Fortschritt', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    const msg = { type: 'jnr:result', level: '1-1', medaillen: 2, funken: 30, xp: 30 };
    const { state: next } = applyJnrResult(state, msg, mergeResult, xpFor);
    expect(next.xp).toBe(30);
    expect(next.jnr.levels['1-1'].medals).toBe(2);
    expect(next.jnr.xpAwarded['1-1']).toBe(true);
    expect(next.jnr.funkenTotal).toBe(30);
    expect(next.jnr.lastLevel).toBe('1-1');
  });

  test('zweiter Abschluss desselben Levels gibt keine weitere XP, aktualisiert aber den Fortschritt', () => {
    let state = stateWithKnobelJnr({ xp: 0 });
    const erst = { type: 'jnr:result', level: '1-1', medaillen: 1, funken: 10, xp: 30 };
    state = applyJnrResult(state, erst, mergeResult, xpFor).state;
    expect(state.xp).toBe(30);

    const zweit = { type: 'jnr:result', level: '1-1', medaillen: 3, funken: 25, xp: 0 };
    const { state: next } = applyJnrResult(state, zweit, mergeResult, xpFor);
    expect(next.xp).toBe(30); // keine weitere Gutschrift
    expect(next.jnr.levels['1-1'].medals).toBe(3); // Fortschritt trotzdem aktualisiert
    expect(next.jnr.funkenTotal).toBe(35);
  });

  test('kappt eine vom iframe zu hoch gemeldete XP auf die plausible Obergrenze', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    const msg = { type: 'jnr:result', level: '2-3', medaillen: 3, funken: 5, xp: 999999 };
    const obergrenze = xpFor('2-3', 3, false);
    const { state: next } = applyJnrResult(state, msg, mergeResult, xpFor);
    expect(next.xp).toBe(obergrenze);
  });

  test('0 Medaillen (Ziel nicht erreicht) gibt keine XP, Level bleibt wie gemerkt', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    const msg = { type: 'jnr:result', level: '1-2', medaillen: 0, funken: 0, xp: 0 };
    const { state: next } = applyJnrResult(state, msg, mergeResult, xpFor);
    expect(next.xp).toBe(0);
    expect(next.jnr.xpAwarded['1-2']).toBeUndefined();
  });

  test('mutiert den Eingabe-State nicht', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    const msg = { type: 'jnr:result', level: '1-1', medaillen: 1, funken: 5, xp: 30 };
    applyJnrResult(state, msg, mergeResult, xpFor);
    expect(state.xp).toBe(0);
    expect(state.jnr.levels).toEqual({});
  });
});
