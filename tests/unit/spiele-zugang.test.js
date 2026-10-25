const { GAME_RULES, getGameAccess, tickStarTime } = require('../../1x1-trainer/logic.js');

function baseState(over) {
  return Object.assign({ streak: 0, stars: 0, gameSecondsLeft: 0 }, over);
}

describe('GAME_RULES', () => {
  test('invader und jnr kosten Stern-Zeit und brauchen 3 Tage Streak', () => {
    expect(GAME_RULES.invader).toEqual({ kostetSternZeit: true, minStreak: 3 });
    expect(GAME_RULES.jnr).toEqual({ kostetSternZeit: true, minStreak: 3 });
  });

  test('knobel kostet keine Stern-Zeit, hat keine Streak-Sperre, braucht aber eine Runde am selben Tag', () => {
    expect(GAME_RULES.knobel).toEqual({ kostetSternZeit: false, minStreak: 0, nachRundeHeute: true });
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

  // heute = new Date().toDateString()-Format; lastRoundDate wird nur in endGame() bei einer gezaehlten Runde gesetzt
  // (nicht vom Streak-Schutz, der lastPlayDate setzt)
  test('knobel: ohne Runde heute gesperrt (lastRoundDate leer)', () => {
    const state = baseState({ lastRoundDate: null });
    expect(getGameAccess(state, 'knobel', 'Sun Oct 25 2026')).toEqual({ spielbar: false, grund: 'keine_runde' });
  });

  test('knobel: Runde gestern reicht nicht', () => {
    const state = baseState({ streak: 4, lastRoundDate: 'Sat Oct 24 2026' });
    expect(getGameAccess(state, 'knobel', 'Sun Oct 25 2026')).toEqual({ spielbar: false, grund: 'keine_runde' });
  });

  test('knobel: Runde heute schaltet frei, auch ohne Sterne und Streak-Mindestwert', () => {
    const state = baseState({ streak: 1, stars: 0, gameSecondsLeft: 0, lastRoundDate: 'Sun Oct 25 2026' });
    expect(getGameAccess(state, 'knobel', 'Sun Oct 25 2026')).toEqual({ spielbar: true, grund: null });
  });

  test('knobel: Kalendertag statt 24 h, Zeitumstellungstag (25 h) und Tageswechsel', () => {
    // Letzte Runde am 24.10. spät abends; am 25.10. (25-h-Tag) um 00:30 sind es < 24 h, aber ein neuer Kalendertag.
    const state = baseState({ lastRoundDate: new Date(2026, 9, 24, 23, 50).toDateString() });
    const heute = new Date(2026, 9, 25, 0, 30).toDateString();
    expect(getGameAccess(state, 'knobel', heute)).toEqual({ spielbar: false, grund: 'keine_runde' });
    // Runde um 00:10 am 25.10., Abfrage um 23:50 am selben Kalendertag (am 25-Stunden-Tag liegen real 24 h 40 min dazwischen).
    const s2 = baseState({ lastRoundDate: new Date(2026, 9, 25, 0, 10).toDateString() });
    expect(getGameAccess(s2, 'knobel', new Date(2026, 9, 25, 23, 50).toDateString()).spielbar).toBe(true);
  });

  test('knobel: ohne heute-Argument wird der aktuelle Kalendertag genommen', () => {
    expect(getGameAccess(baseState({ lastRoundDate: new Date().toDateString() }), 'knobel').spielbar).toBe(true);
    expect(getGameAccess(baseState({ lastRoundDate: 'Mon Jan 01 2001' }), 'knobel').spielbar).toBe(false);
  });

  test('knobel: lastPlayDate allein (Streak-Schutz/Dev-Panel) schaltet nicht frei', () => {
    const state = baseState({ lastPlayDate: 'Sun Oct 25 2026', lastRoundDate: null });
    expect(getGameAccess(state, 'knobel', 'Sun Oct 25 2026')).toEqual({ spielbar: false, grund: 'keine_runde' });
    expect(getGameAccess(baseState({ lastPlayDate: 'Sun Oct 25 2026' }), 'knobel', 'Sun Oct 25 2026').spielbar).toBe(false); // Feld fehlt
  });

  test('invader/jnr ignorieren lastRoundDate (Regeln unverändert)', () => {
    const state = baseState({ streak: 3, stars: 1, lastRoundDate: null });
    expect(getGameAccess(state, 'invader', 'Sun Oct 25 2026').spielbar).toBe(true);
    expect(getGameAccess(state, 'jnr', 'Sun Oct 25 2026').spielbar).toBe(true);
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
