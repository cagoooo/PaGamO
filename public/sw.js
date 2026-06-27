const BUILD_VERSION = "20260627-3";
const CACHE_NAME = `pagamo-${BUILD_VERSION}`;

self.addEventListener('install', () => {
  // prompt-to-refresh：不 skipWaiting，等使用者點「立刻更新」才換版
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ includeUncontrolled: true }).then(clients =>
          clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: BUILD_VERSION }))
        )
      )
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const SKIP_CACHE_HOSTS = [
  'supabase.co',       // Supabase REST / Edge Functions — 動態資料，絕不快取
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'cdn.sheetjs.com',
];

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 動態來源（API / CDN）：直通網路，不碰快取
  if (SKIP_CACHE_HOSTS.some(h => url.hostname.endsWith(h))) return;

  // HTML 頁面：network-first，確保老師永遠拿到最新表單
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then(r => r || Response.error()))
    );
    return;
  }

  // 本站靜態資源（圖片、favicon、manifest 等）：cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});
