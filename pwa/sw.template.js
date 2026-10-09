/* Polier Service Worker – wird beim Build aus pwa/sw.template.js erzeugt (Platzhalter ersetzt).
 * Strategie: Die App-Dateien werden beim Installieren vollständig vorgeladen (Precache).
 * Aufrufe der Seite werden aus dem Cache bedient (App-Shell), damit die App offline startet.
 * Neue Versionen werden im Hintergrund geladen und erst nach Bestätigung durch die Nutzerin
 * bzw. den Nutzer aktiviert (Nachricht SKIP_WAITING). Fremde Domains und Nicht-GET-Anfragen
 * werden nie angefasst. Die Projektdaten liegen im localStorage und nicht in diesem Cache. */
const VERSION = '__VERSION__';
const CACHE = 'polier-' + VERSION;
const PRECACHE = __PRECACHE__;
const url = file => new URL(file, self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.all(PRECACHE.map(file => cache.add(new Request(url(file), { cache: 'reload' })))),
    ),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('polier-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', version: VERSION });
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const target = new URL(request.url);
  if (target.origin !== self.location.origin) return;

  // Seitenaufrufe: App-Shell aus dem Cache, sonst Netzwerk
  if (request.mode === 'navigate') {
    event.respondWith(caches.match(url('index.html')).then(hit => hit || fetch(request)));
    return;
  }
  // Alles andere: Cache zuerst, bei Fehlen Netzwerk und für später ablegen
  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    })),
  );
});
