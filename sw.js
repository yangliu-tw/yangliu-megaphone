const CACHE_VERSION = "a7b90eee";

const PRECACHE = [ "./", "assets/icons/apple-touch-icon.png", "assets/icons/favicon-32.png", "assets/icons/icon-192.png", "assets/icons/icon-512-maskable.png", "assets/icons/icon-512.png", "assets/images/bg.webp", "assets/images/future_soon.webp", "assets/images/seagull_1.png", "assets/images/seagull_2.png", "assets/images/seagull_3.png", "assets/images/seagull_4.png", "assets/images/sprite_sheet.webp", "buttons.json", "css/styles.css", "index.html", "js/app.js", "js/audio-engine.js", "js/install.js", "js/name-dialog.js", "js/press.js", "js/recorder.js", "js/scene.js", "js/storage.js", "js/toast.js", "manifest.webmanifest" ];

const CACHE_PREFIX = "megaphone-";

const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE.map(url => new Request(url, {
      cache: "reload"
    })));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const {request: request} = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, {
      ignoreSearch: true
    }) || (request.mode === "navigate" ? await cache.match("index.html") : undefined);
    return cached || fetch(request);
  })());
});
