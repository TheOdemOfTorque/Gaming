const CACHE = 'jumpnrun-v1'; // bei jedem Release hochzählen
// Alle SWs des Origins teilen sich den CacheStorage: nur eigene alte Versionen löschen.
const PRAEFIX = CACHE.replace(/v\d+$/, '');
// Seite + alle Skripte aus index.html (tests/unit/sw-precache.test.js prüft die Liste).
const ASSETS = ['./', './index.html',
  './core/viewport.js', './core/collision.js', './core/physics.js', './core/level.js', './core/mathgen.js',
  './core/rewards.js', './core/gegner.js', './core/game.js', './core/tutorial.js', './core/camera.js',
  './core/host.js', './core/reihenwahl.js', './data/sections.js', './core/levelgen.js', './data/levels.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PRAEFIX) && k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Nur im eigenen Cache suchen: caches.match ohne cacheName durchsucht alle Caches des
// Origins und könnte veraltete Kopien eines anderen SWs liefern.
self.addEventListener('fetch', e => {
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request)).then(cached => cached || fetch(e.request)));
});
