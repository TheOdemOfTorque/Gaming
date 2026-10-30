const { applyKnobelResult, applyJnrResult, applyJnrTutorial, migrateState } = require('../../1x1-trainer/logic.js');
const { computeKnobelXP } = require('../../knobel/knobel-logic.js');
const { mergeResult } = require('../../jumpnrun/core/rewards.js');

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

  test('nicht-numerische gemeldete XP (z.B. gefälschte Nachricht) zerstört den XP-Zähler nicht mit NaN', () => {
    const state = stateWithKnobelJnr({ xp: 50 });
    const msg = { type: 'knobel:result', mode: 'mauer', stufe: 1, tipps: 0, xp: 'pwned', seed: 9 };
    const { state: next } = applyKnobelResult(state, msg, '2026-10-25', computeKnobelXP);
    expect(Number.isFinite(next.xp)).toBe(true);
    expect(next.xp).toBe(50);
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

// Lumo gibt keine XP mehr (Marco 30.10.2026). Medaillen, Funken und Fortschritt kommen weiter ueber
// mergeResult. Ein altes Lumo aus dem Cache meldet evtl. noch xp > 0: der Trainer schreibt nichts gut.
describe('applyJnrResult', () => {
  test('schreibt keine XP gut, merkt sich aber Medaillen, Funken und Fortschritt', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    const msg = { type: 'jnr:result', level: '1-2', medaillen: 2, funken: 30, xp: 0 };
    const { state: next, creditedXp } = applyJnrResult(state, msg, mergeResult);
    expect(next.xp).toBe(0);
    expect(creditedXp).toBe(0);
    expect(next.jnr.levels['1-2'].medals).toBe(2);
    expect(next.jnr.funkenTotal).toBe(30);
    expect(next.jnr.lastLevel).toBe('1-2');
  });

  test('ein altes Lumo aus dem Cache meldet noch XP: der Trainer schreibt trotzdem nichts gut', () => {
    const state = stateWithKnobelJnr({ xp: 120 });
    const msg = { type: 'jnr:result', level: '1-3', medaillen: 3, funken: 5, xp: 90 };
    // auch mit dem alten Aufruf (xpFor als viertes Argument) bleibt es bei 0
    const alt = () => 90;
    const { state: next, creditedXp } = applyJnrResult(state, msg, mergeResult, alt);
    expect(next.xp).toBe(120);
    expect(creditedXp).toBe(0);
    expect(next.jnr.levels['1-3'].medals).toBe(3);
  });

  test('zweiter Abschluss desselben Levels aktualisiert den Fortschritt', () => {
    let state = stateWithKnobelJnr({ xp: 0 });
    state = applyJnrResult(state, { type: 'jnr:result', level: '1-2', medaillen: 1, funken: 10, xp: 0 }, mergeResult).state;
    const { state: next } = applyJnrResult(state, { type: 'jnr:result', level: '1-2', medaillen: 3, funken: 25, xp: 0 }, mergeResult);
    expect(next.xp).toBe(0);
    expect(next.jnr.levels['1-2'].medals).toBe(3);
    expect(next.jnr.funkenTotal).toBe(35);
  });

  test('alter Spielstand mit der gestrichenen Stufe 1-1: 1-1 bleibt stehen, XP aendern sich nicht', () => {
    const state = stateWithKnobelJnr({ xp: 50 }); // 50 XP stammen noch aus 1-1 und bleiben
    state.jnr.levels['1-1'] = { medals: 2, bestTimeMs: 1, bestFunken: 3 };
    state.jnr.xpAwarded['1-1'] = true;
    state.jnr.lastLevel = '1-1';
    const next = applyJnrResult(state, { type: 'jnr:result', level: '1-2', medaillen: 1, funken: 4, xp: 50 }, mergeResult).state;
    expect(next.xp).toBe(50);
    expect(next.jnr.levels['1-1'].medals).toBe(2);
    expect(next.jnr.lastLevel).toBe('1-2');
  });

  test('mutiert den Eingabe-State nicht', () => {
    const state = stateWithKnobelJnr({ xp: 0 });
    applyJnrResult(state, { type: 'jnr:result', level: '1-2', medaillen: 1, funken: 5, xp: 30 }, mergeResult);
    expect(state.xp).toBe(0);
    expect(state.jnr.levels).toEqual({});
  });

  test('nicht-numerische gemeldete XP (z.B. gefälschte Nachricht) lässt den XP-Zähler stehen', () => {
    const state = stateWithKnobelJnr({ xp: 50 });
    const { state: next } = applyJnrResult(state, { type: 'jnr:result', level: '1-2', medaillen: 1, funken: 5, xp: 'pwned' }, mergeResult);
    expect(next.xp).toBe(50);
  });
});

describe('applyJnrTutorial (Nachricht jnr:tutorial, Vertrag jumpnrun/core/host.js)', () => {
  test('merkt sich, dass das Lumo-Tutorial gesehen wurde, und lässt den Rest von jnr stehen', () => {
    const state = stateWithKnobelJnr({ xp: 12 });
    state.jnr.levels['1-1'] = { medals: 2, bestTimeMs: 1, bestFunken: 3 };
    const next = applyJnrTutorial(state, { type: 'jnr:tutorial', gesehen: true });
    expect(next.jnr.tutorialGesehen).toBe(true);
    expect(next.jnr.levels['1-1'].medals).toBe(2);
    expect(next.xp).toBe(12); // das Tutorial bringt keine XP
  });
  test('verändert den Eingabe-State nicht', () => {
    const state = stateWithKnobelJnr({});
    applyJnrTutorial(state, { type: 'jnr:tutorial', gesehen: true });
    expect(state.jnr.tutorialGesehen).toBe(false);
  });
  test('ohne gesehen: true bleibt alles, wie es ist', () => {
    const state = stateWithKnobelJnr({});
    expect(applyJnrTutorial(state, { type: 'jnr:tutorial' })).toBe(state);
    expect(applyJnrTutorial(state, { type: 'jnr:tutorial', gesehen: 'ja' })).toBe(state);
  });
  test('das Flag übersteht ein späteres jnr:result', () => {
    let state = applyJnrTutorial(stateWithKnobelJnr({}), { type: 'jnr:tutorial', gesehen: true });
    state = applyJnrResult(state, { type: 'jnr:result', level: '1-2', medaillen: 1, funken: 1, xp: 0 }, mergeResult).state;
    expect(state.jnr.tutorialGesehen).toBe(true);
  });
});

describe('Lumo-Tutorial über die ganze Kette (Trainer-State -> jnr:init -> Lumo)', () => {
  const H = require('../../jumpnrun/core/host.js');
  const TU = require('../../jumpnrun/core/tutorial.js');
  test('v13-Spielstand ohne tutorialGesehen: Tutorial kommt; nach jnr:tutorial nicht mehr', () => {
    const alt = migrateState({ _version: 13, jnr: { v: 1, levels: { '1-1': { medals: 1, bestTimeMs: 9, bestFunken: 2 } }, lastLevel: '1-1', funkenTotal: 2, xpAwarded: { '1-1': true },
      options: { steuerung: 'standard', mathe: 'ziel', farbhilfe: true, musik: true } } });
    expect(alt.jnr.tutorialGesehen).toBeUndefined(); // Migration fasst bestehende jnr nicht an
    const init1 = H.parseHostMessage({ type: 'jnr:init', jnr: alt.jnr });
    expect(init1.jnr.tutorialGesehen).toBe(false); // Default aus sanitizeJnr
    expect(TU.sollAutomatischStarten(init1.jnr, false)).toBe(true);
    const neu = applyJnrTutorial(alt, H.buildTutorialMessage());
    const init2 = H.parseHostMessage({ type: 'jnr:init', jnr: neu.jnr });
    expect(TU.sollAutomatischStarten(init2.jnr, false)).toBe(false);
    expect(init2.jnr.levels['1-1'].medals).toBe(1);
  });
});
