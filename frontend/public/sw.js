/*
 * Service worker minimal du poste de scan.
 * - Met en cache l'interface (HTML, JS, CSS, icônes) pour un démarrage rapide.
 * - Ne met JAMAIS en cache l'API (/api, /sanctum) : chaque décision d'accès vient du serveur.
 * Le mode hors ligne complet (file d'attente de scans) est hors MVP : voir docs/DECISIONS.md.
 */
const CACHE = 'gym-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/sanctum/')) return

  // Navigation : réseau d'abord (version à jour), cache en secours.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Fichiers statiques versionnés (/assets/*) : cache d'abord.
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((response) => {
        if (response.ok && url.pathname.startsWith('/assets/')) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      }),
    ),
  )
})
