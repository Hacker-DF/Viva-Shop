/**
 * special-orders.js — Commandes spéciales : le client décrit un produit absent du catalogue.
 * Client : formulaire et suivi (render). Équipe : étude, devis, refus (renderStaff).
 */
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';
import { formatFcfa } from './products.js';

const STATUS = {
  get recue() { return t('st.sp.recue'); },
  get etude() { return t('st.sp.etude'); },
  get devis_envoye() { return t('st.sp.devis_envoye'); },
  get acceptee() { return t('st.sp.acceptee'); },
  get refusee() { return t('st.sp.refusee'); },
  get annulee() { return t('st.sp.annulee'); },
};
const STAFF_ROLES = ['administrateur_principal', 'responsable_commandes'];

/** Vue client. */
export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = `<div class="alert alert-warn">${escapeHtml(t('sp.guest'))}</div><a class="btn btn-primary" href="#/connexion">${escapeHtml(t('common.login'))}</a>`;
    return;
  }
  const { data, error } = await supabase.from('special_orders')
    .select('id, reference, product_name, image_url, quantity, status, quote_amount, quote_note, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  container.innerHTML = `
    <a class="back" href="#/boutique">${t('sp.back')}</a>
    <h1>${escapeHtml(t('sp.title'))}</h1>
    <p class="hint">${escapeHtml(t('sp.hint'))}</p>
    <div id="sp-msg" class="alert" role="status" hidden></div>
    <form id="sp-form" class="card admin-form" novalidate>
      <label>${escapeHtml(t('sp.product'))}<input name="product_name" required maxlength="150"></label>
      <label>${escapeHtml(t('sp.photo'))}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
      <label>${t('sp.supplier')}<input name="supplier_link" type="url" maxlength="300" placeholder="https://…"></label>
      <label>${t('sp.description')}<textarea name="description" rows="3" maxlength="1000"></textarea></label>
      <div class="two-cols">
        <label>${t('sp.qty')}<input name="quantity" type="number" min="1" step="1" value="1" required></label>
        <label>${t('sp.budget')}<input name="budget" type="number" min="0" step="1"></label>
      </div>
      <label>${t('sp.notes')}<textarea name="notes" rows="2" maxlength="500"></textarea></label>
      <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('sp.send'))}</button>
    </form>
    <h2 class="section-title">${escapeHtml(t('sp.mine'))}</h2>
    <ul class="admin-list">
      ${data.map((r) => `
        <li class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.reference)} · ${escapeHtml(r.product_name)}</strong>
            ${r.image_url ? `<img class="color-thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.product_name)}">` : ''}
            <span class="product-code">${escapeHtml(t('sp.qty'))} ${r.quantity}${r.quote_amount != null ? ' · ' + escapeHtml(t('sp.quote')) + ' : ' + escapeHtml(formatFcfa(r.quote_amount)) : ''}</span>
            ${r.quote_note ? `<span class="product-code">${escapeHtml(r.quote_note)}</span>` : ''}
          </div>
          <span class="status-badge" style="--c: var(--electric)">${escapeHtml(STATUS[r.status] || r.status)}</span>
          ${r.status === 'acceptee' ? `<p class="product-code">${escapeHtml(t('sp.accepted_note'))}</p>` : ''}
          ${r.status === 'devis_envoye' ? `<div class="admin-actions wrap">
            <button class="btn btn-primary btn-small" type="button" data-id="${r.id}" data-decision="acceptee">${escapeHtml(t('sp.accept'))}</button>
            <button class="btn btn-ghost btn-small" type="button" data-id="${r.id}" data-decision="refusee">${escapeHtml(t('sp.refuse'))}</button>
          </div>` : ''}
        </li>`).join('') || `<li class="empty">${escapeHtml(t('sp.none'))}</li>`}
    </ul>`;

  const msg = container.querySelector('#sp-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('ul.admin-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-decision]');
    if (!btn) return;
    const { data: changed, error: decError } = await supabase.from('special_orders')
      .update({ status: btn.dataset.decision }).eq('id', btn.dataset.id).select('id');
    const m = container.querySelector('#sp-msg');
    if (decError || !changed?.length) {
      m.className = 'alert alert-error';
      m.textContent = decError ? translateError(decError) : t('sp.denied');
      m.hidden = false;
      return;
    }
    await render(container);
    const done = container.querySelector('#sp-msg');
    done.className = 'alert alert-success';
    done.textContent = btn.dataset.decision === 'acceptee'
      ? t('sp.accepted_msg')
      : t('sp.refused_msg');
    done.hidden = false;
  });

  container.querySelector('#sp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const productName = String(fd.get('product_name')).trim();
    const link = String(fd.get('supplier_link')).trim();
    const quantity = Number(fd.get('quantity'));
    const budgetRaw = String(fd.get('budget')).trim();
    if (productName.length < 2) { say(t('sp.name_err'), 'error'); return; }
    if (link && !link.startsWith('https://')) { say(t('sp.link_err'), 'error'); return; }
    if (!Number.isInteger(quantity) || quantity < 1) { say(t('decl.qty_err'), 'error'); return; }

    // Photo facultative, rangée dans le dossier « demandes »
    let imageUrl = null;
    const photo = fd.get('photo');
    if (photo && photo.size > 0) {
      if (photo.size > 5 * 1024 * 1024) { say(t('sp.photo_big'), 'error'); return; }
      const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `demandes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upError } = await supabase.storage.from('produits').upload(path, photo, { contentType: photo.type, upsert: false });
      if (upError) { say(translateError(upError), 'error'); return; }
      imageUrl = supabase.storage.from('produits').getPublicUrl(path).data.publicUrl;
    }

    const { error: insError } = await supabase.from('special_orders').insert({
      user_id: session.user.id,
      product_name: productName,
      image_url: imageUrl,
      supplier_link: link || null,
      description: String(fd.get('description')).trim() || null,
      quantity,
      budget: budgetRaw === '' ? null : Number(budgetRaw),
      notes: String(fd.get('notes')).trim() || null,
    });
    if (insError) { say(translateError(insError), 'error'); return; }
    render(container);
    container.querySelector('#sp-msg').className = 'alert alert-success';
    container.querySelector('#sp-msg').textContent = t('sp.sent');
    container.querySelector('#sp-msg').hidden = false;
  });
}

/** Vue équipe : étude, devis et refus des demandes. */
export async function renderStaff(container) {
  const session = await getSession();
  if (!session) { container.innerHTML = `<div class="alert alert-warn">${t('common.login_required')}</div>`; return; }
  const codes = await getRoleCodes();
  if (!codes.some((c) => STAFF_ROLES.includes(c))) {
    container.innerHTML = `<div class="alert alert-error">${t('sp.staff_restricted')}</div>`;
    return;
  }

  const { data, error } = await supabase.from('special_orders')
    .select('id, reference, product_name, image_url, description, quantity, budget, supplier_link, status, quote_amount, profiles(first_name, last_name, username, phone, city)')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;

  container.innerHTML = `
    <div class="admin-toolbar"><h1>${t('pf.staff.req')}</h1></div>
    <div id="sp-staff-msg" class="alert" role="status" hidden></div>
    <ul class="admin-list" id="sp-list">
      ${data.map((r) => `
        <li class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.reference)} · ${escapeHtml(r.product_name)}</strong>
            ${r.image_url ? `<img class="color-thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.product_name)}">` : ''}
            <span class="author-line"><strong>${escapeHtml(t('author.label'))} :</strong> ${escapeHtml(r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name} (@${r.profiles.username})${r.profiles.phone ? ' · ' + r.profiles.phone : ''}${r.profiles.city ? ' · ' + r.profiles.city : ''}` : t('author.missing'))}</span>
            <span class="product-code">${escapeHtml(t('sp.qty'))} ${r.quantity}${r.budget != null ? ' · ' + escapeHtml(t('sp.budget_short')) + ' ' + escapeHtml(formatFcfa(r.budget)) : ''}</span>
            ${r.description ? `<p class="product-code">${escapeHtml(r.description)}</p>` : ''}
            ${r.supplier_link ? `<a href="${escapeHtml(r.supplier_link)}" target="_blank" rel="noopener">${escapeHtml(t('sp.supplier_link'))}</a>` : ''}
            <span class="status-badge" style="--c: var(--electric)">${escapeHtml(STATUS[r.status] || r.status)}</span>
          </div>
          <div class="admin-actions wrap">
            ${r.status === 'recue' ? `<button class="btn btn-ghost btn-small" type="button" data-id="${r.id}" data-action="study">${escapeHtml(t('sp.study'))}</button>` : ''}
            ${r.status === 'recue' || r.status === 'etude' ? `<button class="btn btn-primary btn-small" type="button" data-id="${r.id}" data-action="quote">${escapeHtml(t('sp.send_quote'))}</button>` : ''}
            ${r.status !== 'refusee' && r.status !== 'acceptee' ? `<button class="btn btn-ghost btn-small" type="button" data-id="${r.id}" data-action="refuse">${escapeHtml(t('sp.refuse'))}</button>` : ''}
          </div>
        </li>`).join('') || `<li class="empty">${escapeHtml(t('sp.none'))}</li>`}
    </ul>`;

  const msg = container.querySelector('#sp-staff-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('#sp-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    let update = null;

    if (btn.dataset.action === 'study') {
      update = { status: 'etude' };
    } else if (btn.dataset.action === 'quote') {
      const amount = window.prompt(t('sp.quote_prompt'));
      if (amount === null) return;
      const value = Number(amount);
      if (!Number.isInteger(value) || value < 0) { say(t('sp.amount_err'), 'error'); return; }
      const note = window.prompt(t('sp.quote_detail'), '') || '';
      update = { status: 'devis_envoye', quote_amount: value, quote_note: note.trim() || null };
    } else if (btn.dataset.action === 'refuse') {
      if (!window.confirm(t('sp.refuse_confirm'))) return;
      update = { status: 'refusee' };
    }

    if (!update) return;
    const { error: upError } = await supabase.from('special_orders').update(update).eq('id', id);
    if (upError) { say(translateError(upError), 'error'); return; }
    renderStaff(container);
  });
}
