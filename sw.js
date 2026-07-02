/* ══════════════════════════════════════════
   Blompasset — Service Worker
   ══════════════════════════════════════════ */

const CACHE_VERSION = 'blompasset-v8';
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
  './js/ui.js',
  './js/router.js',
  './js/dates.js',
  './js/salary.js',
  './js/validation.js',
  './js/exports.js',
  './js/effects.js',
  './js/modules/dashboard.js',
  './js/modules/blombilen.js',
  './js/modules/shifts.js',
  './js/modules/salaryView.js',
  './js/modules/settings.js',
  './js/modules/calendar.js',
  './js/modules/reports.js',
  './js/modules/places.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
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

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Cross-origin: cacha Google Fonts (så typsnitten funkar offline), skippa resten
  const isFont = request.url.startsWith('https://fonts.googleapis.com') ||
                 request.url.startsWith('https://fonts.gstatic.com');
  if (!request.url.startsWith(self.location.origin) && !isFont) return;

  // Nätverk först: alltid färsk version när man är online.
  // Cachen används bara som reserv när nätet saknas (offline-läge).
  event.respondWith(
    fetch(request).then((response) => {
      if (response && response.status === 200 && response.type !== 'opaque') {
        const clone = response.clone();
        caches.open(CACHE_DYNAMIC).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      })
    )
  );
});

/* ── Message from app ── */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
