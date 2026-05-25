const CACHE_VERSION = 'kosar-pwa-v1.4.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './customer.html',
  './ai_studio_code (5).html',
  './license-registry.json',
  './icons-192.svg',
  './icons-512.svg',
  './manifest.webmanifest',
  './service-worker.js'
];

function isManagerPanelPath(url) {
  const path = decodeURIComponent(url.pathname || '').toLowerCase();
  return path.endsWith('/ai_studio_code (6).html') || path.endsWith('ai_studio_code (6).html');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Keep only same-origin caching logic to avoid CORS/cache noise.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    if (isManagerPanelPath(url)) {
      event.respondWith(
        fetch(req).catch(() => new Response(
          '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>مدیریت فقط آنلاین</title><body style="font-family:tahoma,sans-serif;padding:24px;background:#0b1220;color:#fff;line-height:2">پنل مدیریت فقط در حالت آنلاین در دسترس است. لطفا اتصال اینترنت را برقرار کنید.</body></html>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        ))
      );
      return;
    }

    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cachedPage = await caches.match(req);
          if (cachedPage) return cachedPage;
          const fallback = await caches.match('./customer.html');
          return fallback || Response.error();
        })
    );
    return;
  }

  // Keep license registry as fresh as possible when online.
  if (url.pathname.endsWith('/license-registry.json') || url.pathname.endsWith('license-registry.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('./license-registry.json');
          return fallback || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./customer.html'));
    })
  );
});
