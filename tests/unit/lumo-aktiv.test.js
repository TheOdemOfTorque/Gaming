const { lumoAktivNeu, applyJnrAktiv, lumoTimerSollLaufen } = require('../../1x1-trainer/logic.js');

// Stern-Zeit in Lumo laeuft, solange Lumo zeit meldet (Vertrag jumpnrun/core/host.js, jnr:aktiv):
// in Menue, Reihenwahl und Spiel, nicht in Pause und Dialogen (gleiche Regel wie Space Invader).
describe('Lumo-Aktivzustand im Trainer', () => {
  test('Startzustand: Lumo hat sich noch nicht gemeldet', () => {
    expect(lumoAktivNeu()).toEqual({ meldet: false, aktiv: false, zeit: false });
  });

  test('jnr:aktiv setzt den Zustand und merkt sich, dass Lumo meldet', () => {
    const z = lumoAktivNeu();
    expect(applyJnrAktiv(z, { type: 'jnr:aktiv', aktiv: true, zeit: true })).toEqual({ meldet: true, aktiv: true, zeit: true });
    expect(applyJnrAktiv(z, { type: 'jnr:aktiv', aktiv: false, zeit: true })).toEqual({ meldet: true, aktiv: false, zeit: true });
    expect(applyJnrAktiv({ meldet: true, aktiv: true, zeit: true }, { type: 'jnr:aktiv', aktiv: false, zeit: false }))
      .toEqual({ meldet: true, aktiv: false, zeit: false });
  });

  test('Fallback: ein altes Lumo ohne Feld zeit meldet aktiv nur im Level, dann gilt zeit = aktiv', () => {
    expect(applyJnrAktiv(lumoAktivNeu(), { type: 'jnr:aktiv', aktiv: true })).toEqual({ meldet: true, aktiv: true, zeit: true });
    expect(applyJnrAktiv(lumoAktivNeu(), { type: 'jnr:aktiv', aktiv: false })).toEqual({ meldet: true, aktiv: false, zeit: false });
    expect(applyJnrAktiv(lumoAktivNeu(), { type: 'jnr:aktiv', aktiv: false, zeit: 'ja' })).toEqual({ meldet: true, aktiv: false, zeit: false });
  });

  test('ungueltige Nachrichten aendern nichts (pure, keine Mutation)', () => {
    const z = { meldet: true, aktiv: true };
    expect(applyJnrAktiv(z, { type: 'jnr:aktiv', aktiv: 'ja' })).toBe(z);
    expect(applyJnrAktiv(z, { type: 'jnr:aktiv' })).toBe(z);
    expect(applyJnrAktiv(z, null)).toBe(z);
    const neu = applyJnrAktiv(z, { type: 'jnr:aktiv', aktiv: false });
    expect(z).toEqual({ meldet: true, aktiv: true });
    expect(neu).not.toBe(z);
  });

  test('Timer laeuft nur mit eingeloester Stern-Zeit und sichtbarer Seite', () => {
    const aktiv = { meldet: true, aktiv: true, zeit: true };
    expect(lumoTimerSollLaufen(aktiv, { sichtbar: true, sternZeit: true })).toBe(true);
    expect(lumoTimerSollLaufen(aktiv, { sichtbar: false, sternZeit: true })).toBe(false);
    expect(lumoTimerSollLaufen(aktiv, { sichtbar: true, sternZeit: false })).toBe(false);
  });

  test('Timer laeuft im Menue und in der Reihenwahl (zeit true, aktiv false)', () => {
    expect(lumoTimerSollLaufen({ meldet: true, aktiv: false, zeit: true }, { sichtbar: true, sternZeit: true })).toBe(true);
  });

  test('Timer steht, solange Lumo zeit false meldet (Pause, Hilfe aus der Pause, Dialoge, Ende)', () => {
    expect(lumoTimerSollLaufen({ meldet: true, aktiv: false, zeit: false }, { sichtbar: true, sternZeit: true })).toBe(false);
  });

  test('visibilitychange startet den Timer nicht, wenn Lumo gerade pausiert', () => {
    let z = applyJnrAktiv(lumoAktivNeu(), { type: 'jnr:aktiv', aktiv: true, zeit: true });
    z = applyJnrAktiv(z, { type: 'jnr:aktiv', aktiv: false, zeit: false }); // jnr:pause beim App-Wechsel
    expect(lumoTimerSollLaufen(z, { sichtbar: true, sternZeit: true })).toBe(false);
  });

  test('Fallback: ein Lumo ohne jnr:aktiv (alter Cache) laesst den Timer wie bisher laufen', () => {
    expect(lumoTimerSollLaufen(lumoAktivNeu(), { sichtbar: true, sternZeit: true })).toBe(true);
    expect(lumoTimerSollLaufen(lumoAktivNeu(), { sichtbar: false, sternZeit: true })).toBe(false);
  });
});
