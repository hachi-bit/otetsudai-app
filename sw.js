// sw.js - Service Worker (PWA オフライン対応)

const CACHE_NAME = 'otetsudai-v13';
const ASSETS = [
  './',
  './index.html',
  './parent.html',
  './child.html',
  './css/common.css',
  './css/parent.css',
  './css/child.css',
  './js/crypto.js',
  './js/storage.js',
  './js/qr.js',
  './js/qrcode.min.js',
  './js/confetti.js',
  './js/chart.js',
  './js/parent.js',
  './js/child.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 古いキャッシュ削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ネットワーク優先、失敗したらキャッシュ
self.addEventListener('fetch', (event) => {
  // CDNリクエストはネットワークのみ
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功したらキャッシュを更新
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
