/* Lumen Harbor — offline shell.

   The game is one HTML file that generates every mesh, texture and
   sound at load time, so "works offline" means exactly one thing:
   having that file. This caches it, its manifest and its icon on the
   first visit, then serves the cached copy first and quietly refreshes
   it in the background.

   Network-first would be more correct and much worse: the file is
   three quarters of a megabyte, and a player on a train with one bar
   would sit on a white screen waiting for a revalidation of something
   that has not changed. Cache-first, update-after, is the right trade
   for a game that ships as a single artefact.

   Bump CACHE when the game file changes; the activate handler deletes
   every older cache, so a stale build cannot outlive a deploy. */
var CACHE = 'lumen-harbor-v1';
var SHELL = [
  './lumen-harbor.html',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      /* A missing optional file must not fail the whole install, or the
         worker never activates and the game never caches at all. */
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  /* The two Google Font stylesheets are the only thing this game
     fetches that is not itself. They are allowed to fail — the CSS
     names real fallbacks — so they go to the network and are cached
     opportunistically rather than being part of the shell. */
  var sameOrigin = url.origin === self.location.origin;

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && (sameOrigin || res.type === 'basic' ||
            res.type === 'cors')) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
