// ============================================================
// indigo AI — Service Worker
// Handles: PWA app-shell caching + Web Push notifications
//
// This no longer uses Firebase. Push notifications are sent
// directly from the server using the standard Web Push protocol
// (VAPID), which requires no Google account.
// ============================================================

const CACHE_NAME = 'indigo-shell-v2';

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// ── Install: pre-cache the app shell ─────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
  // Take control immediately without waiting for old SW to expire
  self.skipWaiting();
});

// ── Activate: clean up stale caches from old versions ────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for navigation, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept API calls, auth routes, non-GET, or cross-origin
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.match('/').then(
            (cached) =>
              cached ||
              new Response(
                '<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0f0d2e;color:#e0e7ff"><h2 style="color:#818cf8">indigo AI</h2><p>You are offline. Please reconnect to continue.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              )
          )
        )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()));
        }
        return response;
      });
    })
  );
});

// ── Web Push: handle incoming push notifications ──────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch (e) {
    data = { title: 'indigo AI', body: event.data?.text() || 'New message' };
  }

  const title = data.title || 'indigo AI';
  const options = {
    body: data.body || 'You have a new message.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192-maskable.png',
    tag: data.tag || 'indigo-notification',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/chat', payload: data },
  };

  event.waitUntil(self.registration.showNotification(title, options));

  // Also forward to any open app windows so they can show a toast
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'PUSH_RECEIVED', title, body: options.body });
      }
    })
  );
});

// ── Notification click: open or focus the app ─────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate to target
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
