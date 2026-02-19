// Self-destructing Service Worker
// このファイルが読み込まれると、すべてのキャッシュを削除し、自分自身を解除します

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (cacheName) {
                    console.log('Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(function () {
            return self.registration.unregister();
        }).then(function () {
            return self.clients.matchAll();
        }).then(function (clients) {
            clients.forEach(function (client) {
                client.navigate(client.url);
            });
        })
    );
});

// すべてのfetchリクエストをネットワークに通す（キャッシュを使わない）
self.addEventListener('fetch', function (event) {
    event.respondWith(fetch(event.request));
});
