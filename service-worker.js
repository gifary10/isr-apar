const CACHE_NAME = 'isr-apar-v1';
const CACHE_TIMEOUT_MS = 20000;  // 20 detik timeout untuk fetch
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
  '/isr.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js'
];

// Helper: Fetch with timeout
function _fetchWithTimeout(request, timeoutMs = CACHE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return fetch(request, { signal: controller.signal })
    .finally(() => clearTimeout(timeoutId));
}

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
            _fetchWithTimeout(new Request(url, { method: 'GET' }))
              .then(response => cache.put(url, response))
              .catch(err => {
                console.warn(`[Service Worker] Failed to cache ${url}:`, err.message);
              })
          )
        );
      })
      .catch(err => {
        console.error('[Service Worker] Cache open failed:', err);
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
            return caches.delete(cacheName).catch(err => {
              console.warn('[Service Worker] Failed to delete cache:', err);
            });
          }
        })
      );
    }).then(() => self.clients.claim())
      .catch(err => console.error('[Service Worker] Activate error:', err))
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
      _fetchWithTimeout(request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(err => {
                console.warn('[Service Worker] Failed to cache API response:', err);
              });
            });
          }
          return response;
        })
        .catch((error) => {
          console.warn('[Service Worker] API fetch failed:', error.message);
          // If network fails, try cache
          return caches.match(request)
            .then((response) => {
              if (response) {
                console.log('[Service Worker] Using cached API response for:', url.href);
                return response;
              }
              // Return offline JSON response
              return new Response(
                JSON.stringify({
                  error: 'Offline - Data tidak tersedia',
                  message: 'Silakan periksa koneksi internet Anda',
                  success: false
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'application/json'
                  })
                }
              );
            })
            .catch(() => {
              return new Response(
                JSON.stringify({
                  error: 'Service Worker error',
                  success: false
                }),
                { status: 503, headers: new Headers({ 'Content-Type': 'application/json' }) }
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
          return _fetchWithTimeout(request)
            .then((response) => {
              // Cache successful responses
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone).catch(err => {
                    console.warn('[Service Worker] Failed to cache asset:', err);
                  });
                });
              }
              return response;
            })
            .catch((error) => {
              console.warn('[Service Worker] Asset fetch failed:', url.href, error.message);
              return new Response('Asset tidak tersedia (Offline)', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
        .catch(() => {
          return new Response('Service Worker error', { status: 503 });
        })
    );
  }

  // Strategy 3: Network-first for HTML pages
  if (request.destination === 'document' || 
      url.pathname.endsWith('.html') ||
      url.pathname === '/') {
    return event.respondWith(
      _fetchWithTimeout(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(err => {
                console.warn('[Service Worker] Failed to cache HTML:', err);
              });
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
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0f0f0;margin:0;padding:20px}div{text-align:center;background:white;padding:40px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}</style></head><body><div><h1>📡 Offline</h1><p>Aplikasi sedang offline. Silakan periksa koneksi internet Anda.</p></div></body></html>',
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/html'
                  })
                }
              );
            })
            .catch(() => {
              return new Response('Service Unavailable', { status: 503 });
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
