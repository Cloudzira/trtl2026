// Service Worker Tartili Digital - untuk caching sederhana agar aplikasi
// tetap bisa dibuka (dari cache) walau koneksi internet sedang lambat/terputus.
const CACHE_NAME = 'tartili-cache-v9';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(e.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') return response;
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => { cache.put(e.request, responseToCache); });
                return response;
            }).catch(() => {});
        })
    );
});
