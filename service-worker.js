/**
 * service-worker.js — Cache des ressources statiques et mode hors connexion.
 *
 * Règles de sécurité (cahier des charges, section 25) :
 * - seules les ressources statiques du même domaine sont mises en cache ;
 * - les appels Supabase et les CDN ne passent JAMAIS par le cache ;
 * - une opération de paiement ou de confirmation n'est jamais validée hors connexion.
 *
 * ⚠️ Incrémenter CACHE_VERSION à chaque mise à jour des fichiers statiques.
 */
const CACHE_VERSION = 'v63';
const CACHE_NAME = `cct-static-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  './',
  'index.html',
  'reset.html',
  'offline.html',
  'manifest.json',
  'css/style.css',
  'css/components.css',
  'css/auth.css',
  'css/shop.css',
  'css/admin.css',
  'assets/logo.jpg',
  'assets/logo-transparent.png',
  'assets/logo-watermark.png',
  'assets/sceau-viva-shop.png',
  'assets/signature-admin.png',
  'css/responsive.css',
  'js/app.js',
  'js/config.js',
  'js/router.js',
  'js/ui.js',
  'js/supabase.js',
  'js/home.js',
  'js/placeholder.js',
  'js/auth.js',
  'js/auth-pages.js',
  'js/profile.js',
  'js/i18n-status.js',
  'js/i18n-guide.js',
  'js/i18n-admin.js',
  'js/i18n-like.js',
  'js/likes.js',
  'js/viewer.js',
  'js/category-guess.js',
  'js/i18n-viewer.js',
  'js/products.js',
  'js/shop.js',
  'js/product.js',
  'js/favorites.js',
  'js/admin.js',
  'js/commandes.js',
  'js/team.js',
  'js/campaigns.js',
  'js/i18n.js',
  'js/theme.js',
  'js/legal.js',
  'js/gallery.js',
  'js/verifier.js',
  'js/addresses.js',
  'js/password.js',
  'js/payments.js',
  'js/declare.js',
  'js/pdf.js',
  'js/i18n-extra.js',
  'js/i18n-pay.js',
  'js/i18n-more.js',
  'js/i18n-profile.js',
  'js/payments-admin.js',
  'js/floating.js',
  'js/logistics-admin.js',
  'js/dashboard-admin.js',
  'js/support.js',
  'js/announcements-admin.js',
  'js/notifications.js',
  'js/special-orders.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Supprime les anciennes versions du cache
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ressources externes (Supabase, CDN) : jamais mises en cache
  if (url.origin !== self.location.origin) return;

  // Navigation : réseau d'abord, page hors connexion en secours
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('offline.html')));
    return;
  }

  // Ressources statiques : cache d'abord, puis réseau (et mise en cache)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
