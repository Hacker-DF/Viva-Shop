/**
 * campaigns.js — Campagnes de collecte : création, produits, ouverture et clôture.
 * Le statut des produits est mis à jour par la base (triggers) ; l'écran ne fait que demander.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { translateError } from './auth.js';
import { t } from './i18n.js';

const STATE_LABELS = {
  get brouillon() { return t('cp.state.brouillon'); },
  get ouverte() { return t('cp.state.ouverte'); },
  get cloturee() { return t('cp.state.cloturee'); },
};
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
      <h1>${t('cp.title')}</h1>
      <a class="btn btn-ghost btn-small" href="#/admin">${t('admin.products')}</a>
    </div>
    <div id="camp-msg" class="alert" role="status" hidden></div>

    <form id="new-camp" class="card admin-form" novalidate>
      <h2>${t('cp.new')}</h2>
      <label>${t('cp.name')}<input name="name" required minlength="2" maxlength="120"></label>
      <label>${t('cp.deadline')}<input name="deadline" type="datetime-local"></label>
      <button class="btn btn-primary btn-block" type="submit">${t('cp.create')}</button>
    </form>

    <ul class="admin-list">
      ${campRes.data.map((c) => campaignHtml(c, productsOf[c.id] || [], productById, free)).join('')
        || `<li class="empty">${t('cp.none')}</li>`}
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
    done(t('cp.created'));
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
      return done(`${t('cp.campaign')} : ${STATE_LABELS[state].toLowerCase()}. ${t('cp.statuses_updated')}`);
    }
    if (action === 'delete') {
      if (!window.confirm(t('cp.delete_confirm'))) return;
      const { error: err } = await supabase.rpc('delete_campaign', { p_id: id });
      if (err) return say(translateError(err), 'error');
      return done(t('cp.deleted'));
    }
    if (action === 'remove') {
      const { error: err } = await supabase.from('campaign_products').delete().eq('product_id', id);
      if (err) return say(translateError(err), 'error');
      done(t('cp.removed'));
    }
  });

  // Ajout d'un produit à une campagne
  list.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const productId = String(new FormData(form).get('product'));
    if (!productId) return say(t('cp.choose'), 'error');
    const { error: err } = await supabase.from('campaign_products')
      .insert({ campaign_id: form.dataset.campaign, product_id: productId });
    if (err) {
      return say(err.message.includes('duplicate') ? t('cp.dup') : translateError(err), 'error');
    }
    done(t('cp.added'));
  });
}

function campaignHtml(c, productIds, productById, free) {
  const items = productIds.map((id) => productById[id]).filter(Boolean);
  const action = c.state === 'ouverte'
    ? `<button class="btn btn-ghost btn-small" type="button" data-action="state" data-id="${c.id}" data-state="cloturee">${t('cp.close')}</button>`
    : `<button class="btn btn-gold btn-small" type="button" data-action="state" data-id="${c.id}" data-state="ouverte">${t('cp.open')}</button>`;
  const deadline = c.payment_deadline
    ? `${t('cp.pay_before')} ${escapeHtml(new Date(c.payment_deadline).toLocaleString('fr-FR'))}`
    : t('cp.no_deadline');

  const removeBtn = c.state === 'ouverte'
    ? ''
    : `<button class="btn btn-ghost btn-small" type="button" data-action="delete" data-id="${c.id}">${t('common.delete')}</button>`;

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
              <button type="button" class="chip-x" data-action="remove" data-id="${p.id}" aria-label="${t('cp.remove_aria')}">×</button>
            </li>`).join('') || `<li class="product-code">${t('cp.no_products')}</li>`}
        </ul>
        ${free.length ? `
          <form class="add-product" data-campaign="${c.id}" novalidate>
            <select name="product" aria-label="${t('cp.product_aria')}">
              <option value="">${t('cp.add_product')}</option>
              ${free.map((p) => `<option value="${p.id}">${escapeHtml(p.code)} · ${escapeHtml(p.name)}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-small" type="submit">${t('cp.add')}</button>
          </form>` : ''}
      </div>
      <div class="admin-actions">${action}
        ${removeBtn}</div>
    </li>`;
}
