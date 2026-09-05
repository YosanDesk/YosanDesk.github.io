// Bump this version whenever the static shell changes so browsers do not keep
// running an outdated script.js (the previous cache was cache-first forever).
const CACHE = "desk-setup-shell-v2";
const SHELL = ["./", "./index.html", "./styles.css", "./script.js", "./manifest.webmanifest", "./assets/app-icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Always check for updated application code first; use cache only offline.
  if (url.pathname.endsWith("/script.js") || url.pathname.endsWith("/styles.css") || url.pathname.endsWith("/index.html")) {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match("./index.html"))));
});
