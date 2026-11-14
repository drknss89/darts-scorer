/* Darts Scorer service worker: lets the app open offline and load fast.
   The page itself is fetched fresh when online (no-cache: always checks GitHub, skipping the 10-minute browser cache) (so updates show up right away),
   with the saved copy used when there's no signal. Online services are never cached. */
const CACHE = "darts-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (/firebaseio\.com|googleapis\.com\/identitytoolkit|securetoken|script\.google|emailjs|firebaseapp\.com/.test(url.href)) return;
  if (req.mode === "navigate" || url.pathname.endsWith(".html")) {
    const file = url.pathname.split("/").pop(), key = file && file !== "index.html" ? "./" + file : "./index.html";
    e.respondWith(fetch(url.href, { cache: "no-cache" }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)); return r; })
      .catch(() => caches.match(key)));
    return;
  }
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/.test(url.href)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })));
  }
});
