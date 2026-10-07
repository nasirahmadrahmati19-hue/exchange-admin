// این فایل موقتی است برای پاک کردن Service Worker خراب
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      self.registration.unregister();
    })
  );
});
