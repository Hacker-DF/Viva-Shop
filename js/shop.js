/**
 * shop.js — Boutique : recherche, filtres par catégorie, tri, pagination et grille de produits.
 */
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';
import { listCategories, listProducts, listProductImages, allImages, STATUS_LABELS, formatFcfa } from './products.js';
import './likes.js';

const PAGE_SIZE = 24;

/** Carte produit réutilisable (boutique et favoris). */
export function productCardHtml(p, extra = []) {
  const status = STATUS_LABELS[p.status] || STATUS_LABELS.en_attente;
  const price = p.promo_price ?? p.price_ht;
  const list = allImages(p, extra);
  const image = list.length > 1
    ? `<div class="cycle" data-cycle>${list.map((u, i) => `<img src="${escapeHtml(u)}" alt="${escapeHtml(p.name)}" loading="lazy" class="${i === 0 ? 'on' : ''}">`).join('')}</div>`
    : list.length === 1
      ? `<img src="${escapeHtml(list[0])}" alt="${escapeHtml(p.name)}" loading="lazy">`
      : `<div class="product-placeholder">${icon('package')}</div>`;
  return `
    <div class="product-card-wrap">
      <a class="product-card" href="#/produit/${encodeURIComponent(p.code)}">
        <div class="product-img">${image}</div>
        <div class="product-body">
          <span class="status-badge" style="--c: ${status.color}">${escapeHtml(t('pstatus.' + p.status))}</span>
          <h3>${escapeHtml(p.name)}</h3>
          <p class="product-code">${escapeHtml(t('shop.code'))} ${escapeHtml(p.code)}</p>
          <p class="product-price">${escapeHtml(formatFcfa(price))}</p>
        </div>
      </a>
      <button class="like-btn" type="button" data-like="${p.id}" aria-pressed="false" aria-label="${escapeHtml(t('like.add'))}">${icon('heart')}</button>
    </div>`;
}

export async function render(container) {
  const categories = await listCategories();

  container.innerHTML = `
    <h1>${escapeHtml(t('shop.title'))}</h1>
    <p class="hint">Vous ne trouvez pas un produit ? <a href="#/demande">Faites une demande spéciale</a>.</p>
    <form id="filters" class="filters" role="search">
      <input type="search" name="q" placeholder="${escapeHtml(t('shop.search'))}" aria-label="${escapeHtml(t('shop.aria'))}">
      <div class="filters-row">
        <select name="category" aria-label="Catégorie">
          <option value="">${escapeHtml(t('shop.allcats'))}</option>
          ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select name="sort" aria-label="Trier">
          <option value="newest">${escapeHtml(t('shop.sort.new'))}</option>
          <option value="price_asc">${escapeHtml(t('shop.sort.asc'))}</option>
          <option value="price_desc">${escapeHtml(t('shop.sort.desc'))}</option>
        </select>
      </div>
    </form>
    <div id="grid" class="product-grid" aria-live="polite"></div>
    <p id="empty" class="empty" hidden>${escapeHtml(t('shop.empty'))}</p>
    <div class="center"><button id="more" class="btn btn-ghost" type="button" hidden>${escapeHtml(t('shop.more'))}</button></div>`;

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
      const imgs = await listProductImages(items.map((p) => p.id)).catch(() => ({}));
      grid.insertAdjacentHTML('beforeend', items.map((p) => productCardHtml(p, imgs[p.id] || [])).join(''));
      offset += items.length;
      empty.hidden = grid.children.length > 0;
      more.hidden = items.length < PAGE_SIZE;
    } catch (err) {
      grid.innerHTML = `<div class="alert alert-error">${escapeHtml(t('shop.error'))} ${escapeHtml(err.message)}</div>`;
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
