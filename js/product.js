/**
 * product.js — Fiche produit : tarifs dégressifs, réservation, favoris, code copiable.
 */
import { openPhotoViewer } from './viewer.js';
import { escapeHtml, icon } from './ui.js';
import {
  getProductByCode, favoriteIdsAmong, setFavorite, listTiers, unitPriceFor,
  createReservation, formatFcfa, listProductImages, allImages,
} from './products.js';
import { getSession, translateError } from './auth.js';
import { t } from './i18n.js';

const STATUS_CLASS = { en_attente: 'var(--status-red)', collecte_ouverte: 'var(--status-green)', commande_cloturee: 'var(--status-grey)', situation_particuliere: 'var(--status-orange)' };

export async function render(container) {
  const code = decodeURIComponent(window.location.hash.split('/')[2] || '');
  const p = await getProductByCode(code);

  if (!p) {
    container.innerHTML = `
      <div class="alert alert-warn">${escapeHtml(t('prod.notfound'))}</div>
      <a class="btn btn-ghost" href="#/boutique">${escapeHtml(t('prod.backshop'))}</a>`;
    return;
  }

  const session = await getSession();
  const [tiers, favIds] = await Promise.all([listTiers(p.id), favoriteIdsAmong([p.id])]);
  let isFav = favIds.includes(p.id);
  const basePrice = p.promo_price ?? p.price_ht;
  const extra = await listProductImages([p.id]).then((m) => m[p.id] || []).catch(() => []);
  const list = allImages(p, extra);
  const image = list.length
    ? `<div class="gallery-wrap"><div class="gallery">${list.map((u) => `<img src="${escapeHtml(u)}" alt="${escapeHtml(p.name)}">`).join('')}</div>${list.length > 1 ? `<div class="gallery-dots">${list.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>` : ''}</div>`
    : `<div class="product-placeholder large">${icon('package')}</div>`;

  container.innerHTML = `
    <a class="back" href="#/boutique">${escapeHtml(t('prod.back'))}</a>
    <article class="product-detail">
      <div class="product-img large">${image}</div>
      <div class="card">
        <span class="status-badge" style="--c: ${STATUS_CLASS[p.status] || STATUS_CLASS.en_attente}">${escapeHtml(t('pstatus.' + p.status))}</span>
        <h1>${escapeHtml(p.name)}</h1>
        <p class="code-line">
          <span>${escapeHtml(t('prod.code'))} <strong id="product-code">${escapeHtml(p.code)}</strong></span>
          <button id="copy-code" class="btn btn-ghost btn-small" type="button">${escapeHtml(t('prod.copy'))}</button>
        </p>
        <p class="price-big">${escapeHtml(formatFcfa(basePrice))} <small>${escapeHtml(t('prod.ht'))}</small></p>
        ${p.promo_price != null ? `<p class="old-price">${escapeHtml(t('prod.normal', { price: formatFcfa(p.price_ht) }))}</p>` : ''}
        ${tiersHtml(tiers)}
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}

        ${datesHtml(p)}
        <div class="actions">
          <button id="fav" class="btn btn-ghost btn-block" type="button">${escapeHtml(isFav ? t('prod.fav.remove') : t('prod.fav.add'))}</button>
          ${p.status === 'collecte_ouverte'
            ? `<a class="btn btn-gold btn-block" href="#/declarer?code=${encodeURIComponent(p.code)}">${escapeHtml(t('prod.pay'))}</a>`
            : `<button class="btn btn-gold btn-block" type="button" disabled>${escapeHtml(t('prod.paynot'))}</button>`}
        </div>

        <div class="reservation">${reservationHtml(p, session)}</div>
        <p id="product-msg" class="alert" role="status" hidden></p>
      </div>
    </article>`;

  const gallery = container.querySelector('.gallery');
  if (gallery) {
    const dots = container.querySelectorAll('.gallery-dots span');
    gallery.addEventListener('scroll', () => {
      const i = Math.round(gallery.scrollLeft / gallery.clientWidth);
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    }, { passive: true });
  }
  container.querySelectorAll('.gallery img').forEach((imgEl, i, all) => {
    imgEl.addEventListener('click', () => openPhotoViewer([...all].map((x) => x.getAttribute('src')), i, p.code));
  });
  const msg = container.querySelector('#product-msg');
  const show = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('#copy-code').addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capturé avant l'attente : currentTarget devient nul après
    try {
      await navigator.clipboard.writeText(p.code);
      btn.textContent = t('prod.copied');
    } catch {
      show(t('prod.copyfail'), 'info');
    }
  });

  container.querySelector('#fav').addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capturé avant l'attente
    if (!session) { show(t('prod.fav.login'), 'warn'); return; }
    try {
      await setFavorite(p.id, isFav);
      isFav = !isFav;
      btn.textContent = isFav ? t('prod.fav.remove') : t('prod.fav.add');
    } catch (err) {
      show(err.message, 'error');
    }
  });

  const form = container.querySelector('#reserve');
  if (form) {
    const qtyInput = form.querySelector('[name="quantity"]');
    const estimate = form.querySelector('#estimate');
    const updateEstimate = () => {
      const qty = Math.max(1, Number(qtyInput.value) || 1);
      const unit = unitPriceFor(tiers, qty, basePrice);
      estimate.textContent = t('prod.estimate', { total: formatFcfa(unit * qty), unit: formatFcfa(unit) });
    };
    qtyInput.addEventListener('input', updateEstimate);
    updateEstimate();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const quantity = Number(fd.get('quantity'));
      if (!Number.isInteger(quantity) || quantity < 1) { show(t('prod.qty') + ' ?', 'error'); return; }
      try {
        await createReservation({
          productId: p.id,
          quantity,
          variant: String(fd.get('variant')).trim(),
          capacity: String(fd.get('capacity')).trim(),
          notes: String(fd.get('notes')).trim(),
        });
        form.reset();
        updateEstimate();
        show(t('prod.reserved'), 'success');
      } catch (err) {
        show(err.message.includes('row-level') ? t('prod.closed.closed') : translateError(err), 'error');
      }
    });
  }
}

function tiersHtml(tiers) {
  if (!tiers.length) return '';
  const rows = tiers.map((tr) => `
    <tr><td>${tr.min_qty}${tr.max_qty ? ` ${escapeHtml(t('prod.tiers.to'))} ${tr.max_qty}` : ` ${escapeHtml(t('prod.tiers.plus'))}`}</td>
    <td>${escapeHtml(formatFcfa(tr.unit_price_ht))}</td></tr>`).join('');
  return `
    <table class="tiers">
      <caption>${escapeHtml(t('prod.tiers'))}</caption>
      <thead><tr><th>${escapeHtml(t('prod.tiers.qty'))}</th><th>${escapeHtml(t('prod.tiers.unit'))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function reservationHtml(p, session) {
  if (p.reservation_deadline && p.reservation_deadline < todayIso()) {
    return `<p class="alert alert-info">${escapeHtml(t('dates.closed'))}</p>`;
  }
  if (p.status !== 'collecte_ouverte' && p.status !== 'en_attente') {
    const key = p.status === 'commande_cloturee' ? 'prod.closed.closed' : 'prod.closed.susp';
    return `<p class="alert alert-info">${escapeHtml(t(key))}</p>`;
  }
  if (p.status === 'collecte_ouverte') {
    return `<p class="alert alert-info">${escapeHtml(t('prod.closed.open'))}</p>`;
  }
  if (!session) {
    return `<p class="alert alert-warn">${escapeHtml(t('prod.login.reserve'))}</p>`;
  }
  return `
    <form id="reserve" class="admin-form" novalidate>
      <h2>${escapeHtml(t('prod.reserve'))}</h2>
      <label>${escapeHtml(t('prod.qty'))}<input name="quantity" type="number" min="1" max="10000" step="1" value="1" required></label>
      <label>${escapeHtml(t('prod.variant'))}<input name="variant" maxlength="60"></label>
      <label>${escapeHtml(t('prod.capacity'))}<input name="capacity" maxlength="60"></label>
      <label>${escapeHtml(t('prod.notes'))}<textarea name="notes" rows="2" maxlength="500"></textarea></label>
      <p id="estimate" class="price-big"></p>
      <p class="hint">${escapeHtml(t('prod.notpayment'))}</p>
      <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('prod.reserve'))}</button>
    </form>`;
}


/** Date au format AAAA-MM-JJ, heure locale. */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** « 2026-12-03 » → « 03/12/2026 ». */
function frDate(iso) {
  return iso.split('-').reverse().join('/');
}

/** Lignes d'information : commande prévue et limite de réservation (seulement si renseignées). */
function datesHtml(p) {
  const lines = [];
  if (p.order_date) lines.push(`${t('dates.order')} ${frDate(p.order_date)}`);
  if (p.reservation_deadline) lines.push(`${t('dates.reserve')} ${frDate(p.reservation_deadline)}`);
  if (!lines.length) return '';
  return `<ul class="product-dates">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
}
