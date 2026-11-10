/**
 * special-orders.js — Commandes spéciales : le client décrit un produit absent du catalogue.
 * Client : formulaire et suivi (render). Équipe : étude, devis, refus (renderStaff).
 */
import { escapeHtml, icon } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';
import { formatFcfa } from './products.js';

const STATUS = {
  recue: 'Reçue', etude: 'En étude', devis_envoye: 'Devis envoyé',
  acceptee: 'Acceptée', refusee: 'Refusée', annulee: 'Annulée',
};
const STAFF_ROLES = ['administrateur_principal', 'responsable_commandes'];

/** Vue client. */
export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = '<div class="alert alert-warn">Connectez-vous pour faire une demande.</div><a class="btn btn-primary" href="#/connexion">Se connecter</a>';
    return;
  }
  const { data, error } = await supabase.from('special_orders')
    .select('reference, product_name, image_url, quantity, status, quote_amount, quote_note, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  container.innerHTML = `
    <a class="back" href="#/boutique">← Boutique</a>
    <h1>Demande spéciale</h1>
    <p class="hint">Vous ne trouvez pas un produit ? Décrivez-le : notre équipe l’étudie et vous envoie un devis.</p>
    <div id="sp-msg" class="alert" role="status" hidden></div>
    <form id="sp-form" class="card admin-form" novalidate>
      <label>Nom du produit recherché<input name="product_name" required maxlength="150"></label>
      <label>Photo du produit (facultatif, 5 Mo maximum)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
      <label>Lien du fournisseur (facultatif)<input name="supplier_link" type="url" maxlength="300" placeholder="https://…"></label>
      <label>Description<textarea name="description" rows="3" maxlength="1000"></textarea></label>
      <div class="two-cols">
        <label>Quantité<input name="quantity" type="number" min="1" step="1" value="1" required></label>
        <label>Budget indicatif (FCFA, facultatif)<input name="budget" type="number" min="0" step="1"></label>
      </div>
      <label>Informations complémentaires (facultatif)<textarea name="notes" rows="2" maxlength="500"></textarea></label>
      <button class="btn btn-primary btn-block" type="submit">Envoyer ma demande</button>
    </form>
    <h2 class="section-title">Mes demandes</h2>
    <ul class="admin-list">
      ${data.map((r) => `
        <li class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.reference)} · ${escapeHtml(r.product_name)}</strong>
            ${r.image_url ? `<img class="color-thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.product_name)}">` : ''}
            <span class="product-code">Quantité ${r.quantity}${r.quote_amount != null ? ' · Devis : ' + escapeHtml(formatFcfa(r.quote_amount)) : ''}</span>
            ${r.quote_note ? `<span class="product-code">${escapeHtml(r.quote_note)}</span>` : ''}
          </div>
          <span class="status-badge" style="--c: var(--electric)">${escapeHtml(STATUS[r.status] || r.status)}</span>
        </li>`).join('') || '<li class="empty">Aucune demande pour le moment.</li>'}
    </ul>`;

  const msg = container.querySelector('#sp-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };

  container.querySelector('#sp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const productName = String(fd.get('product_name')).trim();
    const link = String(fd.get('supplier_link')).trim();
    const quantity = Number(fd.get('quantity'));
    const budgetRaw = String(fd.get('budget')).trim();
    if (productName.length < 2) { say('Indiquez le nom du produit (2 caractères minimum).', 'error'); return; }
    if (link && !link.startsWith('https://')) { say('Le lien du fournisseur doit commencer par https://', 'error'); return; }
    if (!Number.isInteger(quantity) || quantity < 1) { say('Quantité invalide.', 'error'); return; }

    // Photo facultative, rangée dans le dossier « demandes »
    let imageUrl = null;
    const photo = fd.get('photo');
    if (photo && photo.size > 0) {
      if (photo.size > 5 * 1024 * 1024) { say('Photo trop lourde (5 Mo maximum).', 'error'); return; }
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
    container.querySelector('#sp-msg').textContent = 'Demande envoyée. Vous serez prévenu dès qu’un devis est disponible.';
    container.querySelector('#sp-msg').hidden = false;
  });
}

/** Vue équipe : étude, devis et refus des demandes. */
export async function renderStaff(container) {
  const session = await getSession();
  if (!session) { container.innerHTML = '<div class="alert alert-warn">Connectez-vous.</div>'; return; }
  const codes = await getRoleCodes();
  if (!codes.some((c) => STAFF_ROLES.includes(c))) {
    container.innerHTML = '<div class="alert alert-error">Accès réservé au responsable des commandes.</div>';
    return;
  }

  const { data, error } = await supabase.from('special_orders')
    .select('id, reference, product_name, image_url, description, quantity, budget, supplier_link, status, quote_amount, profiles(first_name, last_name, username)')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;

  container.innerHTML = `
    <div class="admin-toolbar"><h1>Demandes spéciales</h1></div>
    <div id="sp-staff-msg" class="alert" role="status" hidden></div>
    <ul class="admin-list" id="sp-list">
      ${data.map((r) => `
        <li class="admin-row">
          <div class="admin-row-main">
            <strong>${escapeHtml(r.reference)} · ${escapeHtml(r.product_name)}</strong>
            ${r.image_url ? `<img class="color-thumb" src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.product_name)}">` : ''}
            <span class="product-code">${escapeHtml(r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name} (@${r.profiles.username})` : '')}</span>
            <span class="product-code">Quantité ${r.quantity}${r.budget != null ? ' · Budget ' + escapeHtml(formatFcfa(r.budget)) : ''}</span>
            ${r.description ? `<p class="product-code">${escapeHtml(r.description)}</p>` : ''}
            ${r.supplier_link ? `<a href="${escapeHtml(r.supplier_link)}" target="_blank" rel="noopener">Lien fournisseur</a>` : ''}
            <span class="status-badge" style="--c: var(--electric)">${escapeHtml(STATUS[r.status] || r.status)}</span>
          </div>
          <div class="admin-actions wrap">
            ${r.status === 'recue' ? `<button class="btn btn-ghost btn-small" type="button" data-id="${r.id}" data-action="study">Étudier</button>` : ''}
            ${r.status === 'recue' || r.status === 'etude' ? `<button class="btn btn-primary btn-small" type="button" data-id="${r.id}" data-action="quote">Envoyer un devis</button>` : ''}
            ${r.status !== 'refusee' && r.status !== 'acceptee' ? `<button class="btn btn-ghost btn-small" type="button" data-id="${r.id}" data-action="refuse">Refuser</button>` : ''}
          </div>
        </li>`).join('') || '<li class="empty">Aucune demande pour le moment.</li>'}
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
      const amount = window.prompt('Montant du devis (FCFA) :');
      if (amount === null) return;
      const value = Number(amount);
      if (!Number.isInteger(value) || value < 0) { say('Montant invalide.', 'error'); return; }
      const note = window.prompt('Détails du devis (facultatif) :', '') || '';
      update = { status: 'devis_envoye', quote_amount: value, quote_note: note.trim() || null };
    } else if (btn.dataset.action === 'refuse') {
      if (!window.confirm('Refuser cette demande ?')) return;
      update = { status: 'refusee' };
    }

    if (!update) return;
    const { error: upError } = await supabase.from('special_orders').update(update).eq('id', id);
    if (upError) { say(translateError(upError), 'error'); return; }
    renderStaff(container);
  });
}
