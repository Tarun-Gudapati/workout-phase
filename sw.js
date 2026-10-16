/* Network first, cache fallback: the app keeps working in a gym with no signal. */
const CACHE = "jw-gym-v2";
const CORE = [
  "./", "index.html", "css/fonts.css", "css/style.css", "js/data.js", "js/store.js", "js/logic.js", "js/app.js", "manifest.webmanifest", "icon.svg",
  "fonts/BigShouldersDisplay-100_900.woff2", "fonts/InterTight-400_800.woff2", "fonts/JetBrainsMono-400.woff2", "fonts/JetBrainsMono-600.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
