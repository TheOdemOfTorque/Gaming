const CACHE = 'knobel-v8'; // bei jedem Release hochzählen
const ASSETS = ['./', './index.html', './knobel-logic.js', './manifest.json', './icon-192.png', './icon-512.png',
  './fonts/AtkinsonHyperlegible-Regular.woff2', './fonts/AtkinsonHyperlegible-Bold.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
