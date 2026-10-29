const CACHE = '1x1-trainer-v32'; // bei jedem Release hochzählen — löst Update auf bestehenden PWAs aus (APP_VERSION in index.html mitpflegen)
// Alle SWs des Origins teilen sich den CacheStorage: nur eigene alte Versionen löschen.
const PRAEFIX = CACHE.replace(/v\d+$/, '');
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logic.js',
  // Von der Trainer-Seite selbst per <script> geladen (XP-Rechnung der Spiele):
  '../knobel/knobel-logic.js',
  '../jumpnrun/core/rewards.js',
  // Die Spiele im iframe cachen ihre Dateien selbst (knobel/sw.js, jumpnrun/sw.js,
  // eigene Scopes); der Trainer registriert beide beim Start mit.
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
      Promise.all(keys.filter(k => k.startsWith(PRAEFIX) && k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Nur im eigenen Cache suchen: caches.match ohne cacheName durchsucht alle Caches des
// Origins und könnte veraltete Kopien eines anderen SWs liefern.
self.addEventListener('fetch', e => {
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request)).then(cached => cached || fetch(e.request)));
});
