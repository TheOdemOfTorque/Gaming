const CACHE = '1x1-trainer-v27'; // bei jedem Release hochzählen — löst Update auf bestehenden PWAs aus (APP_VERSION in index.html mitpflegen)
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logic.js',
  // Knobelwerkstatt + Lumo (ADR-0001, Same-Origin-iframe) — Cache-Storage-Einträge
  // ausserhalb des SW-Scopes von 1x1-trainer/; sie werden NICHT automatisch beim
  // iframe-Request ausgeliefert (dafür bräuchte jedes Spiel seinen eigenen Service
  // Worker im eigenen Scope). Knobel hat ein eigenes sw.js, Lumo noch nicht.
  '../knobel/index.html',
  '../knobel/knobel-logic.js',
  '../knobel/manifest.json',
  '../knobel/icon-192.png',
  '../knobel/icon-512.png',
  '../jumpnrun/index.html',
  '../jumpnrun/core/collision.js',
  '../jumpnrun/core/game.js',
  '../jumpnrun/core/host.js',
  '../jumpnrun/core/level.js',
  '../jumpnrun/core/mathgen.js',
  '../jumpnrun/core/physics.js',
  '../jumpnrun/core/rewards.js',
  '../jumpnrun/data/levels.js',
  '../jumpnrun/data/sections.js',
  '../jumpnrun/core/levelgen.js',
  '../jumpnrun/core/viewport.js',
  '../jumpnrun/core/camera.js',
  '../knobel/fonts/AtkinsonHyperlegible-Regular.woff2',
  '../knobel/fonts/AtkinsonHyperlegible-Bold.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
