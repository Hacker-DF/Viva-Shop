/**
 * router.js — Routage léger par hash (#/accueil, #/boutique, …)
 *
 * Choix d'architecture : une seule page HTML (SPA légère) pour éviter de
 * dupliquer l'en-tête et la navigation, et pour un fonctionnement hors connexion simple.
 * Chaque écran est un module chargé à la demande (import dynamique).
 */
import { APP_CONFIG } from './config.js';
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';

/** Clés de traduction des libellés de navigation. */
const NAV_KEYS = { accueil: 'nav.home', boutique: 'nav.shop', commandes: 'nav.orders', favoris: 'nav.favorites', compte: 'nav.account' };

/**
 * Table des routes. Ordre = ordre des menus (section 5 du cahier des charges).
 * `phase` indique la phase de développement où l'écran sera complété.
 */
export const ROUTES = {
  accueil:   { label: 'Accueil',    icon: 'home',    phase: 1, load: () => import('./home.js') },
  boutique:  { label: 'Boutique',   icon: 'store',   phase: 3, load: () => import('./shop.js') },
  commandes: { label: 'Commandes',  icon: 'package', phase: 4, load: () => import('./commandes.js') },
  favoris:   { label: 'Favoris',    icon: 'heart',   phase: 3, load: () => import('./favorites.js') },
  produit:   { label: 'Produit',    icon: 'tag',     phase: 3, hidden: true, load: () => import('./product.js') },
  guide:           { label: 'Guide d’utilisation', icon: 'file-text', phase: 1, hidden: true, view: 'guide', load: () => import('./legal.js') },
  confidentialite: { label: 'Confidentialité', icon: 'lock', phase: 1, hidden: true, view: 'privacy', load: () => import('./legal.js') },
  conditions:      { label: 'Conditions générales', icon: 'shield', phase: 1, hidden: true, view: 'terms', load: () => import('./legal.js') },
  support:         { label: 'Signaler un problème', icon: 'message', phase: 8, hidden: true, load: () => import('./support.js') },
  notifications:   { label: 'Notifications', icon: 'bell', phase: 10, hidden: true, load: () => import('./notifications.js') },
  demande:         { label: 'Demande spéciale', icon: 'package', phase: 11, hidden: true, load: () => import('./special-orders.js') },
  verifier:        { label: 'Vérification', icon: 'shield', phase: 15, hidden: true, load: () => import('./verifier.js') },
  'mot-de-passe':  { label: 'Mot de passe oublié', icon: 'lock', phase: 2, hidden: true, load: () => import('./password.js') },
  declarer:        { label: 'Déclarer un paiement', icon: 'credit-card', phase: 5, hidden: true, load: () => import('./declare.js') },
  admin:     { label: 'Administration', icon: 'shield', phase: 3, hidden: true, load: () => import('./admin.js') },
  compte:    { label: 'Mon compte', icon: 'user',    phase: 2, load: () => import('./profile.js') },
  // Routes masquées de la navigation (accessibles par lien)
  connexion:   { label: 'Connexion',   icon: 'user', phase: 2, hidden: true, view: 'login',    load: () => import('./auth-pages.js') },
  inscription: { label: 'Inscription', icon: 'user', phase: 2, hidden: true, view: 'register', load: () => import('./auth-pages.js') },
};

const DEFAULT_ROUTE = 'accueil';
let renderToken = 0; // évite qu'un ancien rendu écrase un rendu plus récent

/** Nom de la route active déduit de l'URL (#/boutique → 'boutique'). */
export function currentRouteName() {
  const name = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return ROUTES[name] ? name : DEFAULT_ROUTE;
}

/** Construit la barre de navigation principale. */
export function buildNav(navEl) {
  navEl.innerHTML = Object.entries(ROUTES)
    .filter(([, route]) => !route.hidden)
    .map(([name, route]) => `
      <a class="nav-item" href="#/${name}" data-route="${name}">
        ${icon(route.icon)}
        <span>${escapeHtml(t(NAV_KEYS[name] || 'nav.home'))}</span>
      </a>`)
    .join('');
}

/** Affiche la route courante dans le conteneur `outlet`. */
export async function renderCurrent(outlet) {
  const name = currentRouteName();
  const route = ROUTES[name];
  const token = ++renderToken;

  // État actif dans la navigation
  document.querySelectorAll('[data-route]').forEach((link) => {
    if (link.dataset.route === name) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  outlet.innerHTML = '<div class="loader" aria-label="Chargement"></div>';

  try {
    const module = await route.load();
    if (token !== renderToken) return; // une navigation plus récente a été demandée
    await module.render(outlet, { name, route });
  } catch (err) {
    console.error(err);
    if (token !== renderToken) return;
    outlet.innerHTML = `
      <div class="alert alert-error">
        Impossible d'afficher cette page. Vérifiez votre connexion puis réessayez.
        <br><small>${escapeHtml(err.message)}</small>
      </div>`;
  }

  document.title = `${route.label} · ${APP_CONFIG.name}`;
  outlet.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/** Démarre le routeur : rendu initial + réaction aux changements de hash. */
export function initRouter(outlet) {
  window.addEventListener('hashchange', () => renderCurrent(outlet));
  renderCurrent(outlet);
}
