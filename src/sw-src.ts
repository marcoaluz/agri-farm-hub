/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navegações: sempre rede primeiro (nunca serve HTML velho do cache)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'html-navigations', networkTimeoutSeconds: 3 }),
)

// Supabase REST: nunca cachear
registerRoute(
  ({ url }) => url.origin === 'https://kivnjwkomrkvdpvklakw.supabase.co' && url.pathname.startsWith('/rest/v1/'),
  new NetworkOnly(),
)

// Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// Só pula a espera quando o usuário confirma no banner "Atualizar agora"
// (postMessage vindo de registerServiceWorker.ts) — nunca sozinho.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ===== Notificações Push =====
self.addEventListener('push', (event) => {
  let data: any = { title: 'Agro GFI', body: 'Você tem uma nova notificação', link: '/' }
  try {
    if (event.data) data = event.data.json()
  } catch {
    /* payload não é JSON, usa o padrão */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo-full.png',
      badge: '/logo-full.png',
      data: { link: data.link || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data as any)?.link || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          ;(client as any).navigate?.(link)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link)
    }),
  )
})
