const { parseLevel } = require('../../jumpnrun/core/level.js');
const G = require('../../jumpnrun/core/game.js');
const R = require('../../jumpnrun/core/rewards.js');
const D = require('../../jumpnrun/data/levels.js');
const fixture = require('./fixtures/jnr-replays.json');

const KEYS = k => ({ left: k.includes('L'), right: k.includes('R'), jump: k.includes('J') });

function playReplay(runs, game, maxExtra = 0) {
  let frames = 0;
  for (const [n, k] of runs) {
    for (let i = 0; i < n; i++) { G.tick(game, KEYS(k)); frames++; }
  }
  for (let i = 0; i < maxExtra; i++) G.tick(game, KEYS('-'));
  return frames;
}

describe('Leveldaten Welt 1', () => {
  test('es gibt 2 Level in Welt 1 mit eindeutigen IDs', () => {
    expect(D.ORDER).toEqual(['1-1', '1-2']);
    expect(new Set(D.ORDER).size).toBe(2);
    D.LEVELS.forEach(l => expect(l.welt).toBe(1));
  });
  test.each(D.LEVELS.map(l => [l.id, l]))('%s ist ein gültiges Raster', (id, l) => {
    const L = parseLevel(l.rows);
    expect(L.h).toBe(9); // Bildhöhe: 9 Kacheln
    expect(L.w).toBeGreaterThanOrEqual(100);
    expect(L.checkpoints.length).toBeGreaterThanOrEqual(2);
    expect(L.checkpoints.length).toBeLessThanOrEqual(4);
    expect(L.crystalSlots.length).toBeGreaterThanOrEqual(12);
    R.parseLevelId(l.id);
  });
  test('Level 1 hat keine Gefahren und keine Mathe', () => {
    const l = D.byId('1-1');
    const L = parseLevel(l.rows);
    expect(L.spikes).toHaveLength(0);
    expect(l.mathe).toBe(false);
  });
  test('Mathe-Level haben eine gültige Reihe', () => {
    D.LEVELS.filter(l => l.mathe).forEach(l => expect(Number.isInteger(l.reihe) && l.reihe >= 2).toBe(true));
  });
  test('gameOptions: Mathe-Modus aus der Einstellung überschreibt das Level', () => {
    const l = D.byId('1-2');
    expect(D.gameOptions(l, { mathe: 'ziel' }).mode).toBe('ziel');
    expect(D.gameOptions(l, { mathe: 'aus' }).mode).toBe('aus');
    expect(D.gameOptions(D.byId('1-1'), { mathe: 'ziel' }).mode).toBe('aus');
  });
});

describe('Lösbarkeit per Replay (Geist-Lauf)', () => {
  const defaults = R.defaultJnr().options;
  test.each(D.ORDER)('Level %s: der aufgezeichnete Lauf erreicht das Ziel', (id) => {
    const meta = D.byId(id);
    const game = G.createGame(parseLevel(meta.rows), D.gameOptions(meta, defaults));
    const frames = playReplay(fixture.replays[id], game);
    expect(game.status).toBe('won');
    expect(game.t).toBeLessThanOrEqual(frames);
    expect(frames).toBeGreaterThan(600);   // mindestens ~10 s Spielzeit
    expect(frames).toBeLessThan(60 * 180); // höchstens 3 Minuten
    const medals = R.calcMedals(G.stats(game));
    expect(medals.geschafft).toBe(true);
  });
  test.each(D.ORDER)('Level %s: ohne den ersten Sprung scheitert derselbe Lauf (Test schlägt an)', (id) => {
    const meta = D.byId(id);
    const game = G.createGame(parseLevel(meta.rows), D.gameOptions(meta, defaults));
    const broken = fixture.replays[id].map(([n, k]) => [n, k.replace('J', '')]);
    playReplay(broken, game);
    expect(game.status).toBe('play');
  });
  test('Level 1-1 mit allen Medaillen-Bedingungen: ohne Fehltreffer geschafft', () => {
    const meta = D.byId('1-1');
    const game = G.createGame(parseLevel(meta.rows), D.gameOptions(meta, defaults));
    playReplay(fixture.replays['1-1'], game);
    expect(game.fehltreffer).toBe(0);
    expect(R.calcMedals(G.stats(game)).anzahl).toBe(3);
  });
  test('Replay ist deterministisch', () => {
    const meta = D.byId('1-2');
    const a = G.createGame(parseLevel(meta.rows), D.gameOptions(meta, defaults));
    const b = G.createGame(parseLevel(meta.rows), D.gameOptions(meta, defaults));
    playReplay(fixture.replays['1-2'], a); playReplay(fixture.replays['1-2'], b);
    expect(a.player).toEqual(b.player);
    expect(a.t).toBe(b.t);
  });
});
