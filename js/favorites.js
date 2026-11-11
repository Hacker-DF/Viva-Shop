/**
 * favorites.js — Liste des produits favoris de l'utilisateur connecté.
 */
import { escapeHtml, icon } from './ui.js';
import { listFavorites } from './products.js';
import { getSession } from './auth.js';
import { productCardHtml } from './shop.js';

export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = `
      <section class="card placeholder">
        <div class="placeholder-icon">${icon('heart')}</div>
        <h1>Mes favoris</h1>
        <p>Connectez-vous pour retrouver vos produits favoris.</p>
        <a class="btn btn-primary" href="#/connexion">Se connecter</a>
      </section>`;
    return;
  }

  const items = await listFavorites();
  container.innerHTML = `
    <h1>Mes favoris</h1>
    ${items.length
      ? `<div class="product-grid">${items.map((p) => productCardHtml(p)).join('')}</div>`
      : '<p class="empty">Vous n’avez pas encore de favoris. Ajoutez-en depuis la boutique.</p>'}
    <a class="btn btn-ghost" href="#/boutique">Aller à la boutique</a>`;
}
