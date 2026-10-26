const CACHE = 'knobel-v9'; // bei jedem Release hochzählen
// Alle SWs des Origins teilen sich den CacheStorage: nur eigene alte Versionen löschen.
const PRAEFIX = CACHE.replace(/v\d+$/, '');
const ASSETS = ['./', './index.html', './knobel-logic.js', './manifest.json', './icon-192.png', './icon-512.png',
  './fonts/AtkinsonHyperlegible-Regular.woff2', './fonts/AtkinsonHyperlegible-Bold.woff2'];

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
