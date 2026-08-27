// Service Worker de Push — roda em segundo plano, mesmo com o app fechado.

self.addEventListener('push', (event) => {
  let data = { title: 'Agro GFI', body: 'Você tem uma nova notificação', link: '/' };

  try {
    data = event.data.json();
  } catch (e) {
    // payload não é JSON, ignora e usa o padrão
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo-full.png',
      badge: '/logo-full.png',
      data: { link: data.link || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(link);
      }
    })
  );
});
