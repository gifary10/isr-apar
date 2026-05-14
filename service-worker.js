// Service Worker untuk ISR APAR PWA
// Strategi: Network-first untuk API calls, Cache-first untuk static assets

const CACHE_NAME = 'isr-apar-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/config.js',
  '/cache.js',
  '/navigation.js',
  '/ui-components.js',
  '/inspection.js',
  '/manifest.json',
  '/logo.webp',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        // Cache essential files, but don't fail on missing ones
        return Promise.all(
          URLS_TO_CACHE.map(url => 
            cache.add(url).catch(err => 
              console.log(`[Service Worker] Failed to cache ${url}:`, err)
            )
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and external protocols
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Strategy 1: Network-first for API calls (Google Sheets API)
  if (url.hostname === 'sheets.googleapis.com' || 
      url.pathname.includes('/api') ||
      request.url.includes('script.google.com')) {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request)
            .then((response) => {
              if (response) {
                console.log('[Service Worker] Using cached response for:', url.href);
                return response;
              }
              // Return offline page or default response
              return new Response(
                JSON.stringify({
                  error: 'Offline - Data tidak tersedia',
                  message: 'Silakan periksa koneksi internet Anda'
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'application/json'
                  })
                }
              );
            });
        })
    );
  }

  // Strategy 2: Cache-first for static assets (CSS, JS, Images)
  if (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'image' ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.webp') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.svg')) {
    return event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            console.log('[Service Worker] Cache hit for:', url.href);
            return response;
          }
          return fetch(request)
            .then((response) => {
              // Cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            })
            .catch(() => {
              console.log('[Service Worker] Failed to fetch:', url.href);
              return new Response('Offline - Asset tidak tersedia', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  }

  // Strategy 3: Network-first for HTML pages
  if (request.destination === 'document' || 
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((response) => {
              if (response) {
                return response;
              }
              // Return offline page
              return new Response(
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title></head><body><h1>Offline</h1><p>Aplikasi sedang offline. Silakan periksa koneksi internet Anda.</p></body></html>',
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/html'
                  })
                }
              );
            });
        })
    );
  }
});

// Background sync for offline data submission
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(
      // This will be triggered when user comes back online
      // You can implement data sync logic here
      Promise.resolve()
    );
  }
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[Service Worker] Loaded successfully');
