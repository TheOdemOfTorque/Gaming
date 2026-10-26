const { lumoAktivNeu, applyJnrAktiv, lumoTimerSollLaufen } = require('../../1x1-trainer/logic.js');

// Stern-Zeit in Lumo laeuft nur, solange aktiv gespielt wird (Vertrag jumpnrun/core/host.js, jnr:aktiv).
describe('Lumo-Aktivzustand im Trainer', () => {
  test('Startzustand: Lumo hat sich noch nicht gemeldet', () => {
    expect(lumoAktivNeu()).toEqual({ meldet: false, aktiv: false });
  });

  test('jnr:aktiv setzt den Zustand und merkt sich, dass Lumo meldet', () => {
    const z = lumoAktivNeu();
    expect(applyJnrAktiv(z, { type: 'jnr:aktiv', aktiv: true })).toEqual({ meldet: true, aktiv: true });
    expect(applyJnrAktiv({ meldet: true, aktiv: true }, { type: 'jnr:aktiv', aktiv: false })).toEqual({ meldet: true, aktiv: false });
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
    const aktiv = { meldet: true, aktiv: true };
    expect(lumoTimerSollLaufen(aktiv, { sichtbar: true, sternZeit: true })).toBe(true);
    expect(lumoTimerSollLaufen(aktiv, { sichtbar: false, sternZeit: true })).toBe(false);
    expect(lumoTimerSollLaufen(aktiv, { sichtbar: true, sternZeit: false })).toBe(false);
  });

  test('Timer steht, solange Lumo "nicht aktiv" meldet (Menue, Reihenwahl, Pause, Hilfe, Ende)', () => {
    expect(lumoTimerSollLaufen({ meldet: true, aktiv: false }, { sichtbar: true, sternZeit: true })).toBe(false);
  });

  test('visibilitychange startet den Timer nicht, wenn Lumo gerade nicht aktiv ist', () => {
    let z = applyJnrAktiv(lumoAktivNeu(), { type: 'jnr:aktiv', aktiv: true });
    z = applyJnrAktiv(z, { type: 'jnr:aktiv', aktiv: false }); // jnr:pause beim App-Wechsel
    expect(lumoTimerSollLaufen(z, { sichtbar: true, sternZeit: true })).toBe(false);
  });

  test('Fallback: ein Lumo ohne jnr:aktiv (alter Cache) laesst den Timer wie bisher laufen', () => {
    expect(lumoTimerSollLaufen(lumoAktivNeu(), { sichtbar: true, sternZeit: true })).toBe(true);
    expect(lumoTimerSollLaufen(lumoAktivNeu(), { sichtbar: false, sternZeit: true })).toBe(false);
  });
});
