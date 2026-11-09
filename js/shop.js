/**
 * shop.js — Boutique : recherche, filtres par catégorie, tri, pagination et grille de produits.
 */
import { escapeHtml, icon } from './ui.js';
import { listCategories, listProducts, STATUS_LABELS, formatFcfa } from './products.js';

const PAGE_SIZE = 24;

/** Carte produit réutilisable (boutique et favoris). */
export function productCardHtml(p) {
  const status = STATUS_LABELS[p.status] || STATUS_LABELS.en_attente;
  const price = p.promo_price ?? p.price_ht;
  const image = p.main_image_url
    ? `<img src="${escapeHtml(p.main_image_url)}" alt="${escapeHtml(p.name)}" loading="lazy">`
    : `<div class="product-placeholder">${icon('package')}</div>`;
  return `
    <a class="product-card" href="#/produit/${encodeURIComponent(p.code)}">
      <div class="product-img">${image}</div>
      <div class="product-body">
        <span class="status-badge" style="--c: ${status.color}">${escapeHtml(status.label)}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-code">Code ${escapeHtml(p.code)}</p>
        <p class="product-price">${escapeHtml(formatFcfa(price))}</p>
      </div>
    </a>`;
}

export async function render(container) {
  const categories = await listCategories();

  container.innerHTML = `
    <h1>Boutique</h1>
    <form id="filters" class="filters" role="search">
      <input type="search" name="q" placeholder="Nom ou code (ex. 24ABCDEF)" aria-label="Rechercher un produit">
      <div class="filters-row">
        <select name="category" aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select name="sort" aria-label="Trier">
          <option value="newest">Nouveautés</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
        </select>
      </div>
    </form>
    <div id="grid" class="product-grid" aria-live="polite"></div>
    <p id="empty" class="empty" hidden>Aucun produit ne correspond à votre recherche.</p>
    <div class="center"><button id="more" class="btn btn-ghost" type="button" hidden>Afficher plus</button></div>`;

  const form = container.querySelector('#filters');
  const grid = container.querySelector('#grid');
  const empty = container.querySelector('#empty');
  const more = container.querySelector('#more');
  let offset = 0;

  async function load(reset) {
    if (reset) { offset = 0; grid.innerHTML = '<div class="loader"></div>'; }
    const fd = new FormData(form);
    try {
      const items = await listProducts({
        q: String(fd.get('q') || ''),
        categoryId: String(fd.get('category') || ''),
        sort: String(fd.get('sort') || 'newest'),
        offset,
        limit: PAGE_SIZE,
      });
      if (reset) grid.innerHTML = '';
      grid.insertAdjacentHTML('beforeend', items.map(productCardHtml).join(''));
      offset += items.length;
      empty.hidden = grid.children.length > 0;
      more.hidden = items.length < PAGE_SIZE;
    } catch (err) {
      grid.innerHTML = `<div class="alert alert-error">Impossible de charger les produits. ${escapeHtml(err.message)}</div>`;
    }
  }

  // Recherche avec une légère attente pour éviter une requête à chaque lettre
  let timer;
  form.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(true), 300); });
  form.addEventListener('change', () => load(true));
  form.addEventListener('submit', (e) => { e.preventDefault(); load(true); });
  more.addEventListener('click', () => load(false));

  load(true);
}
