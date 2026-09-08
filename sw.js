// Service worker — makes the game work offline after first load.
// ⚠️ HTML is NETWORK-FIRST on purpose. The old cache-first version kept serving a stale
// index.html forever, so deploys never reached the kids' devices. Do not "optimise" this back.
const CACHE = 'hebrew-school-20260908170651';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // cache:'reload' bypasses the browser HTTP cache — otherwise a fresh SW can install a stale page
      .then(c => Promise.all(ASSETS.map(u => fetch(u, { cache: 'reload' }).then(r => c.put(u, r)).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isPage(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only handle same-origin GETs. Supabase sync + Twemoji CDN go straight to the network.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // The app itself: always try the network first, fall back to cache when offline.
  if (isPage(e.request)) {
    e.respondWith(
      fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => { c.put('./index.html', copy.clone()); c.put('./', copy); });
        return resp;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Everything else (icon, manifest): cache-first is fine.
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
