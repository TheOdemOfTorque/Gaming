// Alle Service Worker im Repo laufen auf demselben Origin und teilen sich dessen
// CacheStorage. Räumt ein SW in activate jeden Cache mit fremdem Namen weg, löscht er
// die Caches der anderen Spiele mit (QA-Befund H1: einmal Knobel geöffnet -> Trainer
// offline kaputt). Jeder SW darf nur eigene alte Versionen löschen.
// Getestet wird der echte sw.js-Code in einer vm-Sandbox mit nachgebautem caches-API.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function alleServiceWorker() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map((d) => path.join(d.name, 'sw.js'))
    .filter((p) => fs.existsSync(path.join(ROOT, p)));
}

function ladeSw(relPfad, vorhandeneCaches) {
  const listeners = {};
  const store = new Set(vorhandeneCaches);
  const sandbox = {
    self: {
      addEventListener: (typ, fn) => { listeners[typ] = fn; },
      skipWaiting: () => {},
      clients: { claim: () => Promise.resolve() },
    },
    caches: {
      keys: () => Promise.resolve([...store]),
      delete: (k) => Promise.resolve(store.delete(k)),
      open: () => Promise.resolve({ addAll: () => Promise.resolve() }),
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.reject(new Error('kein Netz im Test')),
  };
  const src = fs.readFileSync(path.join(ROOT, relPfad), 'utf8');
  vm.runInNewContext(src + '\n;this.__CACHE = CACHE;', sandbox);
  return { listeners, store, cache: sandbox.__CACHE };
}

async function aktiviere(sw) {
  let warten;
  sw.listeners.activate({ waitUntil: (p) => { warten = p; } });
  await warten;
}

const FREMDE = ['1x1-trainer-v27', '1x1-trainer-v28', 'knobel-v8', 'knobel-v9', 'jumpnrun-v1', 'jumpnrun-v2', 'irgendwas'];

describe('Service Worker: activate räumt nur eigene alte Caches weg', () => {
  const sws = alleServiceWorker();

  test('Trainer, Knobel und Lumo haben je einen eigenen Service Worker', () => {
    expect(sws.sort()).toEqual(['1x1-trainer/sw.js', 'jumpnrun/sw.js', 'knobel/sw.js']);
  });

  test.each(sws)('%s: Cache-Name ist <ordner>-v<zahl>', (rel) => {
    const { cache } = ladeSw(rel, []);
    expect(cache).toMatch(new RegExp('^' + path.dirname(rel) + '-v\\d+$'));
  });

  test.each(sws)('%s: Caches der anderen Spiele bleiben stehen, eigene alte Versionen gehen', async (rel) => {
    const { cache } = ladeSw(rel, []);
    const praefix = cache.replace(/v\d+$/, '');
    const sw = ladeSw(rel, [...FREMDE, cache]);
    await aktiviere(sw);
    const erwartet = [...FREMDE, cache].filter((k) => k === cache || !k.startsWith(praefix));
    expect([...sw.store].sort()).toEqual([...new Set(erwartet)].sort());
    expect(sw.store.has(cache)).toBe(true);
  });

  test('Präfix trennt sauber: knobel- löscht nicht knobelwerkstatt-…', async () => {
    const sw = ladeSw('knobel/sw.js', ['knobelwerkstatt-v1', 'knobel-v1']);
    await aktiviere(sw);
    expect(sw.store.has('knobelwerkstatt-v1')).toBe(true);
    expect(sw.store.has('knobel-v1')).toBe(false);
  });
});
