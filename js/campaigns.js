/**
 * campaigns.js — Campagnes de collecte : création, produits, ouverture et clôture.
 * Le statut des produits est mis à jour par la base (triggers) ; l'écran ne fait que demander.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { translateError } from './auth.js';

const STATE_LABELS = { brouillon: 'Brouillon', ouverte: 'Collecte ouverte', cloturee: 'Clôturée' };
const STATE_COLORS = { brouillon: 'var(--grey-600)', ouverte: 'var(--status-green)', cloturee: 'var(--status-grey)' };

/** Message à afficher après le rechargement de la page. */
let pending = null;

export async function render(container) {
  const note = pending;
  pending = null;

  const [campRes, linkRes, prodRes] = await Promise.all([
    supabase.from('campaigns').select('id, name, state, payment_deadline').order('created_at', { ascending: false }),
    supabase.from('campaign_products').select('campaign_id, product_id'),
    supabase.from('products').select('id, code, name').eq('is_archived', false).order('name'),
  ]);
  const error = campRes.error || linkRes.error || prodRes.error;
  if (error) throw error;

  const productById = Object.fromEntries(prodRes.data.map((p) => [p.id, p]));
  const assigned = new Set(linkRes.data.map((l) => l.product_id));
  const productsOf = {};
  linkRes.data.forEach((l) => { (productsOf[l.campaign_id] ||= []).push(l.product_id); });
  const free = prodRes.data.filter((p) => !assigned.has(p.id));

  container.innerHTML = `
    <div class="admin-toolbar">
      <h1>Campagnes</h1>
      <a class="btn btn-ghost btn-small" href="#/admin">Produits</a>
    </div>
    <div id="camp-msg" class="alert" role="status" hidden></div>

    <form id="new-camp" class="card admin-form" novalidate>
      <h2>Nouvelle campagne</h2>
      <label>Nom<input name="name" required minlength="2" maxlength="120"></label>
      <label>Date limite de paiement (facultatif)<input name="deadline" type="datetime-local"></label>
      <button class="btn btn-primary btn-block" type="submit">Créer la campagne</button>
    </form>

    <ul class="admin-list">
      ${campRes.data.map((c) => campaignHtml(c, productsOf[c.id] || [], productById, free)).join('')
        || '<li class="empty">Aucune campagne pour le moment.</li>'}
    </ul>`;

  const msg = container.querySelector('#camp-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  if (note) say(note.text, note.type);

  const done = (text) => { pending = { text, type: 'success' }; render(container); };

  container.querySelector('#new-camp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const deadline = String(fd.get('deadline'));
    const { error: err } = await supabase.from('campaigns').insert({
      name: String(fd.get('name')).trim(),
      payment_deadline: deadline ? new Date(deadline).toISOString() : null,
    });
    if (err) return say(translateError(err), 'error');
    done('Campagne créée.');
  });

  const list = container.querySelector('.admin-list');

  // Ouverture / clôture et retrait de produit
  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id, state } = btn.dataset;

    if (action === 'state') {
      const { error: err } = await supabase.from('campaigns').update({ state }).eq('id', id);
      if (err) return say(translateError(err), 'error');
      return done(`Campagne : ${STATE_LABELS[state].toLowerCase()}. Statuts des produits mis à jour.`);
    }
    if (action === 'remove') {
      const { error: err } = await supabase.from('campaign_products').delete().eq('product_id', id);
      if (err) return say(translateError(err), 'error');
      done('Produit retiré de la campagne.');
    }
  });

  // Ajout d'un produit à une campagne
  list.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const productId = String(new FormData(form).get('product'));
    if (!productId) return say('Choisissez un produit.', 'error');
    const { error: err } = await supabase.from('campaign_products')
      .insert({ campaign_id: form.dataset.campaign, product_id: productId });
    if (err) {
      return say(err.message.includes('duplicate') ? 'Ce produit est déjà dans une campagne.' : translateError(err), 'error');
    }
    done('Produit ajouté à la campagne.');
  });
}

function campaignHtml(c, productIds, productById, free) {
  const items = productIds.map((id) => productById[id]).filter(Boolean);
  const action = c.state === 'ouverte'
    ? `<button class="btn btn-ghost btn-small" type="button" data-action="state" data-id="${c.id}" data-state="cloturee">Clôturer la collecte</button>`
    : `<button class="btn btn-gold btn-small" type="button" data-action="state" data-id="${c.id}" data-state="ouverte">Ouvrir la collecte</button>`;
  const deadline = c.payment_deadline
    ? `Paiement avant le ${escapeHtml(new Date(c.payment_deadline).toLocaleString('fr-FR'))}`
    : 'Sans date limite';

  return `
    <li class="admin-row">
      <div class="admin-row-main">
        <strong>${escapeHtml(c.name)}</strong>
        <span class="admin-meta">
          <span class="status-badge" style="--c: ${STATE_COLORS[c.state]}">${STATE_LABELS[c.state]}</span>
          ${escapeHtml(deadline)}
        </span>
        <ul class="campaign-items">
          ${items.map((p) => `
            <li><span class="product-code">${escapeHtml(p.code)}</span> ${escapeHtml(p.name)}
              <button type="button" class="chip-x" data-action="remove" data-id="${p.id}" aria-label="Retirer ce produit">×</button>
            </li>`).join('') || '<li class="product-code">Aucun produit</li>'}
        </ul>
        ${free.length ? `
          <form class="add-product" data-campaign="${c.id}" novalidate>
            <select name="product" aria-label="Produit à ajouter">
              <option value="">Ajouter un produit…</option>
              ${free.map((p) => `<option value="${p.id}">${escapeHtml(p.code)} · ${escapeHtml(p.name)}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-small" type="submit">Ajouter</button>
          </form>` : ''}
      </div>
      <div class="admin-actions">${action}</div>
    </li>`;
}
