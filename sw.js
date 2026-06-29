/* ══════════════════════════════════════════
   Blompasset — Service Worker
   ══════════════════════════════════════════ */

const CACHE_VERSION = 'blompasset-v3';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/state.js',
  './js/storage.js',
  './js/sync.js',
  './js/ui.js',
  './js/router.js',
  './js/dates.js',
  './js/salary.js',
  './js/validation.js',
  './js/exports.js',
  './js/qr.js',
  './js/modules/dashboard.js',
  './js/modules/blombilen.js',
  './js/modules/shifts.js',
  './js/modules/salaryView.js',
  './js/modules/settings.js',
  './js/modules/calendar.js',
  './js/modules/reports.js',
  './js/modules/places.js',
  './assets/icons/icon.svg',
];

/* ── Install ── */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

/* ── Activate ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('blompasset-') && k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  // Skip Google Apps Script requests (always needs network)
  if (request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_DYNAMIC).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => {
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ── Background sync (queue flush) ── */
self.addEventListener('sync', (event) => {
  if (event.tag === 'blompasset-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});

/* ── Message from app ── */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
