// Service worker: só para notificações (push). Não guarda cache — o app sempre carrega a versão nova.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'AZ Elétrica', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'AZ Elétrica', {
    body: d.body || '',
    icon: '/icons/icon-192.png?v=2',
    badge: '/brand/favicon-32.png',
    tag: d.tag || 'az',
    renotify: true,
    vibrate: [80, 60, 80],
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
