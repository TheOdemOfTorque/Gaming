// Lumo - Absturztest: der Bot mit 3 Leben laeuft durch jedes Level (Marco 31.10.2026). Geprueft wird
// nur, dass nichts abstuerzt und keine ungueltigen Werte entstehen. Das Schrittlimit begrenzt nur die
// Laufzeit, ein Lauf am Limit ist kein Fehler. Ob der Bot gewinnt oder Leben verliert, ist ausdruecklich
// kein Kriterium und wird hier nie geprueft (Regel "Bot ist kein Pass-Kriterium").
const { absturztest, pruefeWerte, laufeMitLeben } = require('./helpers/jnr-spielbarkeit.js');
const D = require('../../jumpnrun/data/levels.js');
const R = require('../../jumpnrun/core/rewards.js');
const { parseLevel } = require('../../jumpnrun/core/level.js');

D.ORDER.forEach(absturztest);

describe('pruefeWerte (Pruefung des Absturztests)', () => {
  const gut = () => ({ player: { x: 1, y: 2, vx: 0, vy: -3 }, leben: 3, energie: 2, funken: 0,
    enemies: [{ x: 5, y: 6, minX: 0, maxX: 90, dir: -1, timer: 0 }, { x: 7, y: 8, minX: 0, maxX: 90, dir: 1, timer: 3 }] });
  test('gueltige Werte gehen durch', () => { expect(() => pruefeWerte(gut(), 'x')).not.toThrow(); });
  test.each([
    ['x', g => { g.player.x = NaN; }], ['y', g => { g.player.y = Infinity; }],
    ['vx', g => { g.player.vx = NaN; }], ['vy', g => { g.player.vy = -Infinity; }],
    ['leben', g => { g.leben = NaN; }], ['energie', g => { g.energie = undefined; }], ['funken', g => { g.funken = Infinity; }],
    ['leben', g => { g.leben = -1; }], ['energie', g => { g.energie = -1; }], ['funken', g => { g.funken = -1; }],
    ['enemies\\[0\\]\\.x', g => { g.enemies[0].x = NaN; }], ['enemies\\[1\\]\\.y', g => { g.enemies[1].y = Infinity; }],
    ['enemies\\[0\\]\\.minX', g => { g.enemies[0].minX = NaN; }], ['enemies\\[0\\]\\.maxX', g => { g.enemies[0].maxX = undefined; }],
    ['enemies\\[1\\]\\.dir', g => { g.enemies[1].dir = NaN; }], ['enemies\\[1\\]\\.timer', g => { g.enemies[1].timer = NaN; }],
  ])('ungueltiges %s wird gemeldet', (name, kaputt) => {
    const g = gut(); kaputt(g);
    expect(() => pruefeWerte(g, 'Level 1-2')).toThrow(new RegExp('Level 1-2.*' + name));
  });
  test('0 Leben, Energie und Funken sind gueltig (verlorener Lauf)', () => {
    const g = gut(); g.leben = 0; g.energie = 0; g.funken = 0;
    expect(() => pruefeWerte(g, 'x')).not.toThrow();
  });
  test('ein Level ohne Gegner geht durch', () => {
    const g = gut(); g.enemies = [];
    expect(() => pruefeWerte(g, 'x')).not.toThrow();
  });
});

describe('laufeMitLeben', () => {
  test('ein Lauf, der am Schrittlimit noch nicht zu Ende ist, gilt nicht als Fehler', () => {
    const gen = D.generateFor('1-2', 1);
    const opts = D.gameOptions(D.byId('1-2'), R.defaultJnr().options, 1, 3);
    const r = laufeMitLeben(parseLevel(gen.rows), opts, 'probe', 10);
    expect(r.frames).toBe(10);
    expect(r.game.status).toBe('play');
  });
});
