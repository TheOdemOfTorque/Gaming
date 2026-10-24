const { GAME_RULES, getGameAccess, tickStarTime } = require('../../1x1-trainer/logic.js');

function baseState(over) {
  return Object.assign({ streak: 0, stars: 0, gameSecondsLeft: 0 }, over);
}

describe('GAME_RULES', () => {
  test('invader und jnr kosten Stern-Zeit und brauchen 3 Tage Streak', () => {
    expect(GAME_RULES.invader).toEqual({ kostetSternZeit: true, minStreak: 3 });
    expect(GAME_RULES.jnr).toEqual({ kostetSternZeit: true, minStreak: 3 });
  });

  test('knobel kostet keine Stern-Zeit und hat keine Streak-Sperre', () => {
    expect(GAME_RULES.knobel).toEqual({ kostetSternZeit: false, minStreak: 0 });
  });
});

describe('getGameAccess', () => {
  test('unbekanntes Spiel ist nie spielbar', () => {
    expect(getGameAccess(baseState(), 'unbekannt')).toEqual({ spielbar: false, grund: 'unbekannt' });
  });

  test('invader: Streak unter 3 sperrt, unabhängig von Sternen', () => {
    const state = baseState({ streak: 2, stars: 5, gameSecondsLeft: 600 });
    expect(getGameAccess(state, 'invader')).toEqual({ spielbar: false, grund: 'streak' });
  });

  test('invader: Streak reicht, aber keine Sterne und keine Zeit', () => {
    const state = baseState({ streak: 3, stars: 0, gameSecondsLeft: 0 });
    expect(getGameAccess(state, 'invader')).toEqual({ spielbar: false, grund: 'keine_sterne' });
  });

  test('invader: Streak reicht und Sterne vorhanden', () => {
    const state = baseState({ streak: 3, stars: 1, gameSecondsLeft: 0 });
    expect(getGameAccess(state, 'invader')).toEqual({ spielbar: true, grund: null });
  });

  test('invader: Streak reicht und laufende Spielzeit reicht auch ohne Sterne', () => {
    const state = baseState({ streak: 5, stars: 0, gameSecondsLeft: 120 });
    expect(getGameAccess(state, 'invader')).toEqual({ spielbar: true, grund: null });
  });

  test('jnr verhält sich wie invader (gleiche Sperren)', () => {
    const state = baseState({ streak: 2, stars: 5 });
    expect(getGameAccess(state, 'jnr')).toEqual({ spielbar: false, grund: 'streak' });
  });

  test('knobel ist immer spielbar, auch ohne Streak und Sterne', () => {
    const state = baseState({ streak: 0, stars: 0, gameSecondsLeft: 0 });
    expect(getGameAccess(state, 'knobel')).toEqual({ spielbar: true, grund: null });
  });
});

describe('tickStarTime', () => {
  test('zählt eine Sekunde runter, solange Zeit übrig ist', () => {
    const result = tickStarTime(baseState({ gameSecondsLeft: 10 }));
    expect(result.state.gameSecondsLeft).toBe(9);
    expect(result.abgelaufen).toBe(false);
  });

  test('meldet Ablauf, wenn die letzte Sekunde verstreicht', () => {
    const result = tickStarTime(baseState({ gameSecondsLeft: 1 }));
    expect(result.state.gameSecondsLeft).toBe(0);
    expect(result.abgelaufen).toBe(true);
  });

  test('tut nichts, wenn schon 0 Sekunden übrig sind', () => {
    const input = baseState({ gameSecondsLeft: 0 });
    const result = tickStarTime(input);
    expect(result.state.gameSecondsLeft).toBe(0);
    expect(result.abgelaufen).toBe(false);
    expect(result.state).toBe(input); // keine unnötige Kopie
  });

  test('mutiert den Eingabe-State nicht', () => {
    const input = baseState({ gameSecondsLeft: 5 });
    tickStarTime(input);
    expect(input.gameSecondsLeft).toBe(5);
  });
});
