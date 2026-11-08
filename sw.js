// Presentation revision ui-01. Algorithm and access configuration unchanged.
const CACHE_NAME = 'scrollshot-offline-v1-8';
const PAGE_URL = new URL('./', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(PAGE_URL, {cache: 'reload'});
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Could not cache the application page');
    await cache.put(PAGE_URL, response);
    await cache.addAll(['./core.js?v=1.4.1','./extras.js?v=1.8','./flow.js?v=1.8','./manifest.webmanifest','./icon-192.png','./icon-512.png'].map(p=>new URL(p,self.registration.scope).href));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(x => x.startsWith('scrollshot-offline-') && x !== CACHE_NAME).map(x => caches.delete(x)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.origin === self.location.origin && (url.pathname.endsWith('/core.js')||url.pathname.endsWith('/extras.js')||url.pathname.endsWith('/flow.js'))) {event.respondWith(caches.open(CACHE_NAME).then(c=>c.match(event.request)).then(r=>r||fetch(event.request)));return;}
  if (event.request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname !== new URL(PAGE_URL).pathname) return;
  event.respondWith((async () => {
    try {
      const network = await fetch(event.request);
      if (network.ok && network.headers.get('content-type')?.includes('text/html')) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(PAGE_URL, network.clone());
      }
      return network;
    } catch (error) {
      const cached = await caches.match(PAGE_URL);
      if (cached) return cached;
      throw error;
    }
  })());
});
