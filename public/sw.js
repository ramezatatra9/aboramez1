// Service Worker لنظام مبيعات وجرد أبو رامز (PWA Service Worker)
const CACHE_VERSION = 'aboramez-pos-v3.8.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// الملفات الأساسية للتخزين المؤقت المسبق
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

// مرحلة التثبيت: حفظ الملفات الأساسية في الكاش
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

// مرحلة التفعيل: تنظيف الكاش القديم
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

// اعتراض واستجابة الطلبات (Fetch Event)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. لا نتدخل في طلبات الـ POST / PUT / DELETE (تذهب مباشرة للخادم)
  if (request.method !== 'GET') {
    return;
  }

  // 2. طلبات الـ API: Network-First (الأولوية للشبكة دائماً لضمان دقة الأسعار والمخزون)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // يمكن حفظ نسخة مؤقتة لطلبات الـ GET فقط
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // إذا انقطع الإنترنت، نحاول جلب آخر نسخة مخزنة مؤقتاً
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({
                success: false,
                offline: true,
                error: 'أنت تعمل حالياً في وضع غير متصل بالإنترنت'
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 3. طلبات التنقل بين الصفحات (HTML Navigation)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 4. الملفات الثابتة (CSS, JS, Fonts, Images): Stale-While-Revalidate
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
          // خطأ في الشبكة، نستمر بالاعتماد على الكاش
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// الاستماع لرسائل التحديث المباشر
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});


