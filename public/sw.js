const STATIC_CACHE = 'kpc-static-v1'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys
      .filter(key => key.startsWith('kpc-static-') && key !== STATIC_CACHE)
      .map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const scopePath = new URL(self.registration.scope).pathname
  // Cache only versioned same-origin build assets. Never cache Supabase/API
  // responses or HTML navigation, so directory data stays fresh.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath + 'assets/')) return

  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached

    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone())
      }
      return response
    } catch (error) {
      if (cached) return cached
      throw error
    }
  })())
})
