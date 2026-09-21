/* ==========================================================================
   DealD — Service Worker
   ใช้ relative path ทั้งหมด จึงทำงานได้ทั้งที่ root และที่ /DealD/ บน GitHub Pages
   ========================================================================== */

var CACHE_NAME = 'deald-v5';

// path เหล่านี้ resolve เทียบกับตำแหน่งของ service-worker.js เอง
var PRECACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './apple-touch-icon.png',
  './assets/icons/logo-rounded-96-v2.png',
  './assets/icons/favicon-16-v2.png',
  './assets/icons/favicon-32-v2.png',
  './assets/icons/favicon-48-v2.png',
  './assets/icons/favicon-64.png',
  './assets/icons/apple-touch-icon-152.png',
  './assets/icons/apple-touch-icon-167.png',
  './assets/icons/icon-192-v2.png',
  './assets/icons/icon-384-v2.png',
  './assets/icons/icon-512-v2.png',
  './assets/icons/icon-maskable-192-v2.png',
  './assets/icons/icon-maskable-512-v2.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // ใช้ addAll แบบทีละไฟล์ เพื่อให้ไฟล์เดียวพลาดแล้วไม่ล้มทั้งหมด
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {
          return null;
        });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE_NAME ? null : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // หน้าเว็บ: network first แล้วค่อย fallback เป็น cache (ได้เวอร์ชันใหม่เสมอเมื่อออนไลน์)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  // ไฟล์คงที่: cache first แล้วอัปเดต cache เบื้องหลัง
  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || network;
    })
  );
});
