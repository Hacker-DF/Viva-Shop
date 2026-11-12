/**
 * favorites.js — Liste des produits favoris de l'utilisateur connecté.
 */
import { escapeHtml, icon } from './ui.js';
import { listFavorites } from './products.js';
import { getSession } from './auth.js';
import { productCardHtml } from './shop.js';
import { t } from './i18n.js';

export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = `
      <section class="card placeholder">
        <div class="placeholder-icon">${icon('heart')}</div>
        <h1>${t('fav.title')}</h1>
        <p>${t('fav.login_text')}</p>
        <a class="btn btn-primary" href="#/connexion">${t('auth.submit.login')}</a>
      </section>`;
    return;
  }

  const items = await listFavorites();
  container.innerHTML = `
    <h1>${t('fav.title')}</h1>
    ${items.length
      ? `<div class="product-grid">${items.map((p) => productCardHtml(p)).join('')}</div>`
      : `<p class="empty">${t('fav.empty')}</p>`}
    <a class="btn btn-ghost" href="#/boutique">${t('fav.go_shop')}</a>`;
}
