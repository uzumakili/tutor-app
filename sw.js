// 改動 app 檔案後把版本號加一，舊快取才會被清掉
const CACHE = 'tutor-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const CDN = 'https://cdnjs.cloudflare.com';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Claude、GitHub 同步與本機伺服器的 /api/ 一律直接連線，不經過快取
  if (url.origin === CDN) {
    // 函式庫的網址帶版本號，內容不會變：有快取就直接用
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }));
  } else if (url.origin === location.origin && !url.pathname.includes('/api/')) {
    // App 本身先抓新版，離線時才退回快取
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      } catch (err) {
        const cached = await cache.match(e.request, { ignoreSearch: true });
        if (cached) return cached;
        throw err;
      }
    }));
  }
});
