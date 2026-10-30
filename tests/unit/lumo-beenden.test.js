const { lumoBeendenGewuenscht, LUMO_BEENDEN_FALLBACK_MS } = require('../../1x1-trainer/logic.js');

// Lumo meldet per jnr:beenden, dass es verlassen werden will (Knopf "Zurueck zum Trainer" im Menue
// oder im Dialog "Deine Stern-Zeit ist vorbei"). Der Trainer schliesst das Overlay dann selbst.
// Vertrag: jumpnrun/core/host.js.
describe('Lumo beenden (jnr:beenden)', () => {
  test('nur jnr:beenden vom laufenden Lumo schliesst das Overlay', () => {
    expect(lumoBeendenGewuenscht('jnr', { type: 'jnr:beenden' })).toBe(true);
  });

  test('andere Nachrichten oder ein anderes Spiel im Overlay aendern nichts', () => {
    expect(lumoBeendenGewuenscht('jnr', { type: 'jnr:aktiv', aktiv: false })).toBe(false);
    expect(lumoBeendenGewuenscht('jnr', { type: 'jnr:result' })).toBe(false);
    expect(lumoBeendenGewuenscht('knobel', { type: 'jnr:beenden' })).toBe(false);
    expect(lumoBeendenGewuenscht(null, { type: 'jnr:beenden' })).toBe(false);
    expect(lumoBeendenGewuenscht('jnr', null)).toBe(false);
    expect(lumoBeendenGewuenscht('jnr', 'jnr:beenden')).toBe(false);
    expect(lumoBeendenGewuenscht('jnr', {})).toBe(false);
  });

  test('Fallback: schickt ein altes Lumo nach jnr:timeup weder jnr:zeitende noch jnr:beenden, schliesst der Trainer nach 5 s', () => {
    expect(LUMO_BEENDEN_FALLBACK_MS).toBe(5000);
  });

  // Das neue Lumo bestaetigt jnr:timeup sofort; der Trainer loescht dann den Fallback (Review X1).
  const { lumoZeitendeBestaetigt } = require('../../1x1-trainer/logic.js');
  test('jnr:zeitende vom laufenden Lumo bestaetigt den Dialog', () => {
    expect(lumoZeitendeBestaetigt('jnr', { type: 'jnr:zeitende' })).toBe(true);
  });
  test('andere Nachrichten, anderes Spiel oder Muell bestaetigen nichts', () => {
    expect(lumoZeitendeBestaetigt('jnr', { type: 'jnr:beenden' })).toBe(false);
    expect(lumoZeitendeBestaetigt('jnr', { type: 'jnr:aktiv', aktiv: false })).toBe(false);
    expect(lumoZeitendeBestaetigt('knobel', { type: 'jnr:zeitende' })).toBe(false);
    expect(lumoZeitendeBestaetigt(null, { type: 'jnr:zeitende' })).toBe(false);
    expect(lumoZeitendeBestaetigt('jnr', null)).toBe(false);
    expect(lumoZeitendeBestaetigt('jnr', 'jnr:zeitende')).toBe(false);
  });
});

// Das X der Trainer-Leiste bleibt Notausgang, loest aber im laufenden Level zuerst die Pause aus
// (Soll-Struktur im Review, B6): nur wenn Lumo per jnr:aktiv "aktiv" meldet (im Level). Pause, Menue,
// Dialoge oder ein altes Lumo ohne jnr:aktiv: X schliesst sofort wie bisher. Dass die Stern-Zeit im
// Menue laeuft (zeit true), aendert daran nichts.
describe('Schliess-Knopf (X) des Overlays', () => {
  const { schliessKnopfAktion } = require('../../1x1-trainer/logic.js');
  test('Lumo im aktiven Spiel: X pausiert zuerst', () => {
    expect(schliessKnopfAktion('jnr', { meldet: true, aktiv: true })).toBe('pausieren');
  });
  test('Lumo in Pause, Menue oder Dialog: X schliesst', () => {
    expect(schliessKnopfAktion('jnr', { meldet: true, aktiv: false })).toBe('schliessen');
  });
  test('Lumo im Menue (Stern-Zeit laeuft, aber kein Level): X schliesst', () => {
    expect(schliessKnopfAktion('jnr', { meldet: true, aktiv: false, zeit: true })).toBe('schliessen');
  });
  test('altes Lumo ohne jnr:aktiv: X schliesst sofort wie frueher', () => {
    expect(schliessKnopfAktion('jnr', { meldet: false, aktiv: false })).toBe('schliessen');
  });
  test('anderes Spiel oder kein Spiel: X schliesst', () => {
    expect(schliessKnopfAktion('knobel', { meldet: true, aktiv: true })).toBe('schliessen');
    expect(schliessKnopfAktion(null, { meldet: true, aktiv: true })).toBe('schliessen');
    expect(schliessKnopfAktion('jnr', null)).toBe('schliessen');
  });
});
