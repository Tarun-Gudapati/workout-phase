/* Network first, cache fallback: the app keeps working in a gym with no signal.
   Cross-origin requests (Supabase API and auth) are never touched, so account data is never cached here. */
const CACHE = "jw-gym-v4";
const CORE = [
  "./", "index.html", "css/fonts.css", "css/style.css", "manifest.webmanifest", "icon.svg",
  "js/data.js", "js/muscles.js", "js/config.js", "js/vendor/supabase.js", "js/store.js", "js/logic.js", "js/sync.js", "js/account.js", "js/coach.js", "js/app.js",
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
