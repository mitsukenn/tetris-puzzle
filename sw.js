const CACHE_NAME = 'tetris-puzzle-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './mode-normal.webp',
  './mode-timeattack.webp',
  './mode-hard.webp',
  './mode-veryhard.webp',
  './icon-home.webp',
  './icon-stats.webp',
  './icon-rank.webp',
  './icon-sound-on.webp',
  './icon-sound-off.webp',
  './title-logo.webp',
  './icon-fire.webp',
  './icon-party.webp',
  './medal-gold.webp',
  './medal-silver.webp',
  './medal-bronze.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // HTML（ナビゲーション）はネットワーク優先で常に最新を取りに行く
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  // それ以外（画像・JSON等）はキャッシュ優先
  event.respondWith(
    caches.match(req).then((res) => res || fetch(req))
  );
});
