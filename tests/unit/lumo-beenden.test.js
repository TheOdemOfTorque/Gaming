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

  test('Fallback: schickt ein altes Lumo nach jnr:timeup kein jnr:beenden, schliesst der Trainer nach 5 s', () => {
    expect(LUMO_BEENDEN_FALLBACK_MS).toBe(5000);
  });
});
