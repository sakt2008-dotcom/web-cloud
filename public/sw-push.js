/* AMASA Resort - Service Worker Push & Notification Handlers */

self.addEventListener('fetch', function (event) {
  try {
    var reqUrl = new URL(event.request.url);
    if (reqUrl.origin === self.location.origin && reqUrl.pathname.indexOf('/__/') === 0) {
      return;
    }
  } catch (_e) {}
});

self.addEventListener('push', function (event) {
  let payload = {
    title: 'AMASA RESORT',
    body: 'لديك إشعار جديد في التطبيق',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'amasa-push-' + Date.now(),
    url: '/',
    type: 'system',
    notifId: '',
    silent: false,
    vibrate: [240, 100, 240, 100, 300],
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        payload = Object.assign({}, payload, parsed);
      }
    } catch (_e) {
      try {
        const text = event.data.text();
        if (text) payload.body = text;
      } catch (_ignored) {}
    }
  }

  const notifOptions = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || 'amasa-push-' + Date.now(),
    dir: 'rtl',
    lang: 'ar',
    renotify: true,
    requireInteraction: false,
    silent: Boolean(payload.silent),
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [240, 100, 240, 100, 300],
    timestamp: Date.now(),
    data: {
      url: payload.url || '/',
      type: payload.type || 'system',
      notifId: payload.notifId || '',
    },
  };

  const notifyPromise = self.registration
    .showNotification(payload.title || 'AMASA RESORT', notifOptions)
    .then(function () {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    })
    .then(function (clientList) {
      clientList.forEach(function (client) {
        try {
          client.postMessage({
            type: 'AMASA_PUSH_RECEIVED',
            payload: payload,
          });
        } catch (_err) {}
      });
    });

  event.waitUntil(notifyPromise);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const notifData = (event.notification && event.notification.data) || {};
  const targetUrl = notifData.url || '/';

  const clickPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          return client.focus().then(function (focusedClient) {
            try {
              (focusedClient || client).postMessage({
                type: 'AMASA_NOTIFICATION_CLICK',
                data: notifData,
              });
            } catch (_err) {}
            return focusedClient || client;
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    });

  event.waitUntil(clickPromise);
});

self.addEventListener('message', function (event) {
  var msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SHOW_LOCAL_NOTIFICATION' && msg.payload) {
    var p = msg.payload;
    event.waitUntil(
      self.registration.showNotification(p.title || 'AMASA RESORT', {
        body: p.body || '',
        icon: p.icon || '/pwa-192x192.png',
        badge: p.badge || '/pwa-192x192.png',
        tag: p.tag || 'amasa-local-' + Date.now(),
        dir: 'rtl',
        lang: 'ar',
        renotify: true,
        silent: Boolean(p.silent),
        vibrate: Array.isArray(p.vibrate) ? p.vibrate : [220, 90, 220, 90, 260],
        timestamp: Date.now(),
        data: {
          url: p.url || '/',
          type: p.type || 'system',
          notifId: p.notifId || '',
        },
      })
    );
  }
});
