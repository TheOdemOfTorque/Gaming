// Lumo - Absturztest: der Bot mit 3 Leben laeuft durch jedes Level (Marco 31.10.2026). Geprueft wird
// nur, dass nichts abstuerzt, keine ungueltigen Werte entstehen und jeder Lauf innerhalb des
// Schrittlimits endet. Ob der Bot gewinnt oder Leben verliert, ist ausdruecklich kein Kriterium und
// wird hier nie geprueft (Regel "Bot ist kein Pass-Kriterium").
const { absturztest, pruefeWerte } = require('./helpers/jnr-spielbarkeit.js');
const D = require('../../jumpnrun/data/levels.js');

D.ORDER.forEach(absturztest);

describe('pruefeWerte (Pruefung des Absturztests)', () => {
  const gut = () => ({ player: { x: 1, y: 2, vx: 0, vy: -3 }, leben: 3, energie: 2, funken: 0 });
  test('gueltige Werte gehen durch', () => { expect(() => pruefeWerte(gut(), 'x')).not.toThrow(); });
  test.each([
    ['x', g => { g.player.x = NaN; }], ['y', g => { g.player.y = Infinity; }],
    ['vx', g => { g.player.vx = NaN; }], ['vy', g => { g.player.vy = -Infinity; }],
    ['leben', g => { g.leben = NaN; }], ['energie', g => { g.energie = undefined; }], ['funken', g => { g.funken = Infinity; }],
  ])('ungueltiges %s wird gemeldet', (name, kaputt) => {
    const g = gut(); kaputt(g);
    expect(() => pruefeWerte(g, 'Level 1-2')).toThrow(new RegExp('Level 1-2.*' + name));
  });
});
