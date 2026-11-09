/**
 * product.js — Fiche produit : tarifs dégressifs, réservation, favoris, code copiable.
 * Le paiement reste désactivé jusqu'à la phase 5.
 */
import { escapeHtml, icon } from './ui.js';
import {
  getProductByCode, favoriteIdsAmong, setFavorite, listTiers, unitPriceFor,
  createReservation, STATUS_LABELS, formatFcfa,
} from './products.js';
import { getSession } from './auth.js';

export async function render(container) {
  const code = decodeURIComponent(window.location.hash.split('/')[2] || '');
  const p = await getProductByCode(code);

  if (!p) {
    container.innerHTML = `
      <div class="alert alert-warn">Produit introuvable. Vérifiez le code produit.</div>
      <a class="btn btn-ghost" href="#/boutique">Retour à la boutique</a>`;
    return;
  }

  const session = await getSession();
  const [tiers, favIds] = await Promise.all([listTiers(p.id), favoriteIdsAmong([p.id])]);
  let isFav = favIds.includes(p.id);
  const status = STATUS_LABELS[p.status] || STATUS_LABELS.en_attente;
  const basePrice = p.promo_price ?? p.price_ht;
  const image = p.main_image_url
    ? `<img src="${escapeHtml(p.main_image_url)}" alt="${escapeHtml(p.name)}">`
    : `<div class="product-placeholder large">${icon('package')}</div>`;

  container.innerHTML = `
    <a class="back" href="#/boutique">← Boutique</a>
    <article class="product-detail">
      <div class="product-img large">${image}</div>
      <div class="card">
        <span class="status-badge" style="--c: ${status.color}">${escapeHtml(status.label)}</span>
        <h1>${escapeHtml(p.name)}</h1>
        <p class="code-line">
          <span>Code <strong id="product-code">${escapeHtml(p.code)}</strong></span>
          <button id="copy-code" class="btn btn-ghost btn-small" type="button">Copier</button>
        </p>
        <p class="price-big">${escapeHtml(formatFcfa(basePrice))} <small>HT</small></p>
        ${p.promo_price != null ? `<p class="old-price">Prix normal : ${escapeHtml(formatFcfa(p.price_ht))}</p>` : ''}
        ${tiersHtml(tiers)}
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}

        <div class="actions">
          <button id="fav" class="btn btn-ghost btn-block" type="button">${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button>
          ${p.status === 'collecte_ouverte'
            ? `<a class="btn btn-gold btn-block" href="#/declarer?code=${encodeURIComponent(p.code)}">Payer et déclarer</a>`
            : '<button class="btn btn-gold btn-block" type="button" disabled>Paiement disponible quand la collecte est ouverte</button>'}
        </div>

        <div class="reservation">${reservationHtml(p, session)}</div>
        <p id="product-msg" class="alert" role="status" hidden></p>
      </div>
    </article>`;

  const msg = container.querySelector('#product-msg');
  const show = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('#copy-code').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(p.code);
      e.currentTarget.textContent = 'Copié ✓';
    } catch {
      show('Copie impossible : sélectionnez le code et copiez-le manuellement.', 'info');
    }
  });

  container.querySelector('#fav').addEventListener('click', async (e) => {
    if (!session) { show('Connectez-vous pour ajouter ce produit à vos favoris.', 'warn'); return; }
    try {
      await setFavorite(p.id, isFav);
      isFav = !isFav;
      e.currentTarget.textContent = isFav ? 'Retirer des favoris' : 'Ajouter aux favoris';
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
      estimate.textContent = `Total estimatif : ${formatFcfa(unit * qty)} HT (${formatFcfa(unit)} / unité)`;
    };
    qtyInput.addEventListener('input', updateEstimate);
    updateEstimate();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const quantity = Number(fd.get('quantity'));
      if (!Number.isInteger(quantity) || quantity < 1) { show('Quantité invalide.', 'error'); return; }
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
        show('Réservation enregistrée. Ce n’est pas un paiement.', 'success');
      } catch (err) {
        show(err.message.includes('row-level') ? 'Réservation impossible pour le moment.' : err.message, 'error');
      }
    });
  }
}

function tiersHtml(tiers) {
  if (!tiers.length) return '';
  const rows = tiers.map((t) => `
    <tr><td>${t.min_qty}${t.max_qty ? ` à ${t.max_qty}` : ' et plus'}</td>
    <td>${escapeHtml(formatFcfa(t.unit_price_ht))}</td></tr>`).join('');
  return `
    <table class="tiers">
      <caption>Tarifs dégressifs (HT par unité)</caption>
      <thead><tr><th>Quantité</th><th>Prix unitaire</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function reservationHtml(p, session) {
  if (p.status !== 'en_attente') {
    const text = {
      collecte_ouverte: 'La collecte est ouverte : la réservation n’est plus disponible.',
      commande_cloturee: 'La commande est clôturée pour ce produit.',
      situation_particuliere: 'Réservations temporairement suspendues pour ce produit.',
    }[p.status] || 'Réservation indisponible pour ce produit.';
    return `<p class="alert alert-info">${escapeHtml(text)}</p>`;
  }
  if (!session) {
    return '<p class="alert alert-warn"><a href="#/connexion">Connectez-vous</a> pour réserver ce produit.</p>';
  }
  return `
    <form id="reserve" class="admin-form" novalidate>
      <h2>Réserver</h2>
      <label>Quantité<input name="quantity" type="number" min="1" max="10000" step="1" value="1" required></label>
      <label>Variante (facultatif)<input name="variant" maxlength="60" placeholder="Ex. noir"></label>
      <label>Capacité (facultatif)<input name="capacity" maxlength="60" placeholder="Ex. 64 Go"></label>
      <label>Informations complémentaires (facultatif)<textarea name="notes" rows="2" maxlength="500"></textarea></label>
      <p id="estimate" class="price-big"></p>
      <p class="hint">Une réservation n’est pas un paiement.</p>
      <button class="btn btn-primary btn-block" type="submit">Réserver</button>
    </form>`;
}
