// Offline shell. Bump VERSION whenever you change any app file so phones pick up the update.
const VERSION = 'kcct-capture-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/main.js', 'js/config.js', 'js/util.js', 'js/db.js', 'js/schema.js', 'js/form.js', 'js/pid.js', 'js/analytics.js', 'js/charts.js', 'js/demo.js',
  'assets/logo-mark.svg', 'assets/logo-horizontal.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase API calls (Firestore/Auth) are handled by the SDK itself.
  if (/googleapis\.com$/.test(url.hostname) && !/fonts\./.test(url.hostname)) return;
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebaseapp.com') && url.pathname.startsWith('/__/')) return;
  const sameOrigin = url.origin === location.origin;
  const staticExt = /gstatic\.com|fonts\.googleapis\.com/.test(url.hostname);
  if (!sameOrigin && !staticExt) return;
  // stale-while-revalidate: instant from cache, refresh in the background
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: sameOrigin });
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
