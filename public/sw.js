// Minimal service worker: enables the installable app lifecycle without caching live directory data.
self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
