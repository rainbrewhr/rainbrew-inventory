/* Rainbrew service worker: the app shell loads instantly from cache and refreshes in the background.
   Database traffic (supabase.co) is never cached here. */
const V = 'rb-v12';
const SHELL = ['index.html', 'manifest.webmanifest', 'admin.html', 'stockkeeper.html', 'procurement.html', 'request.html', 'style.css', 'app.js', 'extras.js', 'config.js', 'vendor/supabase.js', 'icon-192.png', 'app-icon-192.png', 'app-favicon-32.png', 'app-apple-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
