// Service Worker Ù„Ù†Ø¸Ø§Ù… Ù…Ø¨ÙŠØ¹Ø§Øª ÙˆØ¬Ø±Ø¯ Ø£Ø¨Ùˆ Ø±Ø§Ù…Ø² (PWA Service Worker)
const CACHE_VERSION = 'aboramez-pos-v8.8.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© Ù„Ù„ØªØ®Ø²ÙŠÙ† Ø§Ù„Ù…Ø¤Ù‚Øª Ø§Ù„Ù…Ø³Ø¨Ù‚
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/html2pdf.bundle.min.js',
  '/js/pin-barcode.js',
  '/js/html5-qrcode.min.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];

// Ù…Ø±Ø­Ù„Ø© Ø§Ù„ØªØ«Ø¨ÙŠØª: Ø­ÙØ¸ Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© ÙÙŠ Ø§Ù„ÙƒØ§Ø´
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Pre-caching core assets');
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[Service Worker] Non-critical precache error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ù…Ø±Ø­Ù„Ø© Ø§Ù„ØªÙØ¹ÙŠÙ„: ØªÙ†Ø¸ÙŠÙ Ø§Ù„ÙƒØ§Ø´ Ø§Ù„Ù‚Ø¯ÙŠÙ…
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Ø§Ø¹ØªØ±Ø§Ø¶ ÙˆØ§Ø³ØªØ¬Ø§Ø¨Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª (Fetch Event)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ù„Ø§ Ù†ØªØ¯Ø®Ù„ ÙÙŠ Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù€ POST / PUT / DELETE (ØªØ°Ù‡Ø¨ Ù…Ø¨Ø§Ø´Ø±Ø© Ù„Ù„Ø®Ø§Ø¯Ù…)
  if (request.method !== 'GET') {
    return;
  }

  // 2. ØªØ³Ø±ÙŠØ¹ ÙÙˆØ±ÙŠ Ù„ÙƒØªØ§Ù„ÙˆØ¬ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª: Stale-While-Revalidate
  // ÙŠÙØªØ­ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ ÙÙˆØ±Ø§Ù‹ (0ms) Ù…Ù† Ø§Ù„ÙƒØ§Ø´ Ø§Ù„Ù…Ø­Ù„ÙŠ Ø«Ù… ÙŠØ­Ø¯Ø«Ù‡ ØµØ§Ù…ØªØ§Ù‹ ÙÙŠ Ø§Ù„Ø®Ù„ÙÙŠØ©
  if (url.pathname === '/api/products' || url.pathname === '/api/settings') {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. Ø¨Ø§Ù‚ÙŠ Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù€ API: Network-First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // ÙŠÙ…ÙƒÙ† Ø­ÙØ¸ Ù†Ø³Ø®Ø© Ù…Ø¤Ù‚ØªØ© Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù€ GET ÙÙ‚Ø·
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ø¥Ø°Ø§ Ø§Ù†Ù‚Ø·Ø¹ Ø§Ù„Ø¥Ù†ØªØ±Ù†ØªØŒ Ù†Ø­Ø§ÙˆÙ„ Ø¬Ù„Ø¨ Ø¢Ø®Ø± Ù†Ø³Ø®Ø© Ù…Ø®Ø²Ù†Ø© Ù…Ø¤Ù‚ØªØ§Ù‹
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({
                success: false,
                offline: true,
                error: 'Ø£Ù†Øª ØªØ¹Ù…Ù„ Ø­Ø§Ù„ÙŠØ§Ù‹ ÙÙŠ ÙˆØ¶Ø¹ ØºÙŠØ± Ù…ØªØµÙ„ Ø¨Ø§Ù„Ø¥Ù†ØªØ±Ù†Øª'
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 3. Ø·Ù„Ø¨Ø§Øª Ø§Ù„ØªÙ†Ù‚Ù„ Ø¨ÙŠÙ† Ø§Ù„ØµÙØ­Ø§Øª (HTML Navigation)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 4. Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø«Ø§Ø¨ØªØ© (CSS, JS, Fonts, Images): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Ø®Ø·Ø£ ÙÙŠ Ø§Ù„Ø´Ø¨ÙƒØ©ØŒ Ù†Ø³ØªÙ…Ø± Ø¨Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯ Ø¹Ù„Ù‰ Ø§Ù„ÙƒØ§Ø´
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Ø§Ù„Ø§Ø³ØªÙ…Ø§Ø¹ Ù„Ø±Ø³Ø§Ø¦Ù„ Ø§Ù„ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù…Ø¨Ø§Ø´Ø±
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});



