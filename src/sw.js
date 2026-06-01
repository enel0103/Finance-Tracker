import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Cache API calls with network-first
registerRoute(
  ({ url }) => url.hostname.includes('supabase'),
  new NetworkFirst({ cacheName: 'supabase-cache', networkTimeoutSeconds: 5 })
)

// Allow the Settings page to trigger an immediate SW update
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { return }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Yutori', {
      body: data.body || '',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: data.tag || 'yutori',
      renotify: true,
      data: { url: data.url || '/bills' }
    })
  )
})

// When user taps a notification, open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
