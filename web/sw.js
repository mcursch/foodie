/* Foodie service worker — caches the app shell so it works fully offline. */
// Bump this whenever the shell changes — same-origin GETs are served cache-first,
// so a stale version pins the old app.js/styles.css until the name changes.
var CACHE = "foodie-v3";
var ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "trends.js",
  "foods.js",
  "foodsearch.js",
  "scanner.js",
  // Only loaded on the first scan, but precached so scanning works offline too.
  "vendor/zxing.min.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Cache what we can; ignore individual failures so install still succeeds.
      return Promise.allSettled(ASSETS.map(function (a) { return c.add(a); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        // Runtime-cache same-origin GETs for resilience.
        if (res && res.ok && e.request.url.indexOf(self.location.origin) === 0) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        // Offline and uncached: fall back to the app shell for navigations.
        if (e.request.mode === "navigate") return caches.match("index.html");
      });
    })
  );
});
