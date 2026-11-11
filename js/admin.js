/**
 * admin.js — Administration des produits : liste, ajout, modification, archivage.
 * La vérification de rôle ici n'améliore que l'affichage ; l'écriture est refusée par Supabase (RLS)
 * si l'utilisateur n'a pas le rôle requis.
 */
import { escapeHtml, icon } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';
import { listCategories, STATUS_LABELS, formatFcfa } from './products.js';

const CATALOGUE_ROLES = ['administrateur_principal', 'gestionnaire_produits'];

/** Message de succès à afficher après rechargement de la page. */
let pending = null;

export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = `
      <div class="alert alert-warn">Connectez-vous pour accéder à l'administration.</div>
      <a class="btn btn-primary" href="#/connexion">Se connecter</a>`;
    return;
  }
  const codes = await getRoleCodes();
  if (window.location.hash.split('/')[2] === 'demandes') {
    return (await import('./special-orders.js')).renderStaff(container);
  }
  if (window.location.hash.split('/')[2] === 'annonces') {
    return (await import('./announcements-admin.js')).render(container);
  }
  if (window.location.hash.split('/')[2] === 'support') {
    return (await import('./support.js')).renderStaff(container);
  }
  if (window.location.hash.split('/')[2] === 'paiements') {
    return (await import('./payments-admin.js')).render(container);
  }
  if (window.location.hash.split('/')[2] === 'tableau') {
    return (await import('./dashboard-admin.js')).render(container);
  }
  if (window.location.hash.split('/')[2] === 'logistique') {
    return (await import('./logistics-admin.js')).render(container);
  }
  if (!codes.some((c) => CATALOGUE_ROLES.includes(c))) {
    container.innerHTML = '<div class="alert alert-error">Accès réservé à l’équipe Viva Shop.</div>';
    return;
  }

  const isPrincipal = codes.includes('administrateur_principal');
  if (window.location.hash.split('/')[2] === 'equipe') {
    if (!isPrincipal) {
      container.innerHTML = '<div class="alert alert-error">Réservé à l’administrateur principal.</div>';
      return;
    }
    return (await import('./team.js')).render(container);
  }
  if (window.location.hash.split('/')[2] === 'campagnes') {
    return (await import('./campaigns.js')).render(container);
  }

  const [categories, products] = await Promise.all([listCategories(), loadProducts()]);
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  container.innerHTML = `
    <div class="admin-toolbar">
      <h1>Produits</h1>
      <a class="btn btn-ghost btn-small" href="#/admin/annonces">Annonces</a>
      ${isPrincipal ? '<a class="btn btn-ghost btn-small" href="#/admin/tableau">Tableau de bord</a>' : ''}
      <a class="btn btn-ghost btn-small" href="#/admin/campagnes">Campagnes</a>
      ${isPrincipal ? '<a class="btn btn-ghost btn-small" href="#/admin/equipe">Équipe</a>' : ''}
      <button id="new" class="btn btn-gold" type="button">${icon('tag')} Nouveau produit</button>
    </div>
    <div id="admin-msg" class="alert" role="status" hidden></div>
    <section id="form-wrap" hidden></section>
    <ul class="admin-list">
      ${products.map((p) => rowHtml(p, categoryName)).join('') || '<li class="empty">Aucun produit pour le moment.</li>'}
    </ul>`;

  const msg = container.querySelector('#admin-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  if (pending) { say(pending.text, pending.type); pending = null; }

  // Recharge la page d'administration après une modification
  const refresh = (text) => {
    pending = text ? { text, type: 'success' } : null;
    render(container);
  };

  container.querySelector('#new').addEventListener('click', () => openForm(container, null, categories, say, refresh));

  container.querySelector('.admin-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const product = products.find((p) => p.id === btn.dataset.id);
    if (btn.dataset.action === 'edit') {
      openForm(container, product, categories, say, refresh);
    } else if (btn.dataset.action === 'archive') {
      const { error } = await supabase.from('products')
        .update({ is_archived: !product.is_archived }).eq('id', product.id);
      if (error) say(translateError(error), 'error');
      else refresh(product.is_archived ? 'Produit réactivé.' : 'Produit archivé.');
    } else if (btn.dataset.action === 'delete') {
      if (!window.confirm('Supprimer définitivement ce produit ? Cette action est impossible s’il a déjà des réservations ou des paiements.')) return;
      const { error } = await supabase.rpc('delete_product', { p_id: product.id });
      if (error) say(translateError(error), 'error');
      else refresh('Produit supprimé.');
    }
  });
}

async function loadProducts() {
  const { data, error } = await supabase.from('products')
    .select('id, code, name, description, category_id, price_ht, promo_price, main_image_url, status, is_archived')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

function rowHtml(p, categoryName) {
  const status = STATUS_LABELS[p.status] || STATUS_LABELS.en_attente;
  return `
    <li class="admin-row ${p.is_archived ? 'is-archived' : ''}">
      <div class="admin-row-main">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="product-code">${escapeHtml(p.code)} · ${escapeHtml(categoryName[p.category_id] || 'Sans catégorie')}</span>
        <span class="admin-meta">
          <span class="status-badge" style="--c: ${status.color}">${escapeHtml(status.label)}</span>
          ${p.is_archived ? '<span class="status-badge" style="--c: var(--grey-600)">Archivé</span>' : ''}
          ${escapeHtml(formatFcfa(p.promo_price ?? p.price_ht))}
        </span>
      </div>
      <div class="admin-actions">
        <button class="btn btn-ghost btn-small" type="button" data-action="edit" data-id="${p.id}">Modifier</button>
        <button class="btn btn-ghost btn-small" type="button" data-action="archive" data-id="${p.id}">
          ${p.is_archived ? 'Réactiver' : 'Archiver'}
        </button>
        <button class="btn btn-ghost btn-small" type="button" data-action="delete" data-id="${p.id}">Supprimer</button>
      </div>
    </li>`;
}

/** Formulaire d'ajout (product = null) ou de modification. */
async function openForm(container, product, categories, say, onSaved) {
  const wrap = container.querySelector('#form-wrap');
  const v = product || {};
  const statusOptions = Object.entries(STATUS_LABELS)
    .map(([key, s]) => `<option value="${key}" ${v.status === key ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('');
  const categoryOptions = categories
    .map((c) => `<option value="${c.id}" ${v.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

  wrap.hidden = false;
  wrap.innerHTML = `
    <form class="card admin-form" novalidate>
      <h2>${product ? 'Modifier le produit' : 'Nouveau produit'}</h2>
      ${product ? `<p class="product-code">Code ${escapeHtml(product.code)} (non modifiable)</p>` : ''}
      <label>Nom<input name="name" required minlength="2" maxlength="150" value="${escapeHtml(v.name || '')}"></label>
      <label>Catégorie<select name="category"><option value="">Sans catégorie</option>${categoryOptions}</select></label>
      <label>Description<textarea name="description" rows="3">${escapeHtml(v.description || '')}</textarea></label>
      <div class="two-cols">
        <label>Prix HT (FCFA)<input name="price" type="number" min="0" step="1" required value="${v.price_ht ?? ''}"></label>
        <label>Promotion (FCFA)<input name="promo" type="number" min="0" step="1" value="${v.promo_price ?? ''}"></label>
      </div>
      <label>Statut commercial<select name="status">${statusOptions}</select></label>
      <label>Adresse de l'image principale (https)<input name="image" type="url" placeholder="https://…" value="${escapeHtml(v.main_image_url || '')}"></label>
      <label>Photo du produit (JPG, PNG ou WebP, 5 Mo maximum)
        <input name="photo" type="file" accept="image/jpeg,image/png,image/webp">
      </label>
      <p class="hint">La photo envoyée remplace l’adresse d’image ci-dessus. Une image carrée (800 × 800 px) s’affiche mieux.</p>
      <p class="field-error" id="form-error" hidden></p>
      <div class="actions">
        <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
        <button class="btn btn-ghost btn-block" type="button" data-cancel>Annuler</button>
      </div>
    </form>`;

  const form = wrap.querySelector('form');
  const err = wrap.querySelector('#form-error');
  wrap.querySelector('[data-cancel]').addEventListener('click', () => { wrap.hidden = true; wrap.innerHTML = ''; });
  if (product) {
    renderColorManager(wrap, product.id, say);
    renderImageManager(wrap, product.id, say);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = String(fd.get('name')).trim();
    const price = Number(fd.get('price'));
    const promoRaw = String(fd.get('promo')).trim();
    const promo = promoRaw === '' ? null : Number(promoRaw);
    const image = String(fd.get('image')).trim();

    // Contrôles avant envoi (la base revalide tout)
    let problem = '';
    if (name.length < 2) problem = 'Le nom doit comporter au moins 2 caractères.';
    else if (!Number.isInteger(price) || price < 0) problem = 'Le prix doit être un nombre entier positif.';
    else if (promo !== null && (!Number.isInteger(promo) || promo < 0 || promo > price)) problem = 'La promotion doit être un entier entre 0 et le prix HT.';
    else if (image && !image.startsWith('https://')) problem = 'L’adresse de l’image doit commencer par https://';
    if (problem) { err.textContent = problem; err.hidden = false; return; }

    // Téléversement de la photo (si une photo est choisie)
    let imageUrl = image || null;
    const photo = fd.get('photo');
    if (photo && photo.size > 0) {
      if (photo.size > 5 * 1024 * 1024) { err.textContent = 'Photo trop lourde (5 Mo maximum).'; err.hidden = false; return; }
      const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('produits')
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadError) { err.textContent = translateError(uploadError); err.hidden = false; return; }
      imageUrl = supabase.storage.from('produits').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name,
      category_id: String(fd.get('category')) || null,
      description: String(fd.get('description')).trim() || null,
      price_ht: price,
      promo_price: promo,
      status: String(fd.get('status')),
      main_image_url: imageUrl,
    };

    const request = product
      ? supabase.from('products').update(payload).eq('id', product.id).select('code').single()
      : supabase.from('products').insert(payload).select('code').single();
    const { data, error } = await request;

    if (error) { err.textContent = translateError(error); err.hidden = false; return; }
    onSaved(product ? 'Produit modifié.' : `Produit créé. Code : ${data.code}`);
  });
}


/** Couleurs disponibles d'un produit (nom seulement), sous le formulaire de modification. */
async function renderColorManager(wrap, productId, say) {
  const { data: colors, error } = await supabase.from('product_colors')
    .select('id, name').eq('product_id', productId).order('name');
  if (error) { say(translateError(error), 'error'); return; }

  const section = document.createElement('section');
  section.className = 'card admin-form';
  section.id = 'color-manager';
  const reload = () => { section.remove(); renderColorManager(wrap, productId, say); };

  section.innerHTML = `
    <h2>Couleurs disponibles</h2>
    <p class="hint">Ces couleurs sont proposées lors de l’ajout d’un colis.</p>
    <ul class="campaign-items">
      ${colors.map((c) => `<li>${escapeHtml(c.name)} <button type="button" class="chip-x" data-del="${c.id}" aria-label="Supprimer la couleur">×</button></li>`).join('')
        || '<li class="product-code">Aucune couleur pour ce produit.</li>'}
    </ul>
    <form id="color-add" novalidate>
      <label>Nom de la couleur<input name="name" maxlength="40" required></label>
      <button class="btn btn-ghost btn-block" type="submit">Ajouter la couleur</button>
    </form>`;

  section.addEventListener('click', async (e) => {
    const del = e.target.closest('button[data-del]');
    if (!del) return;
    const { error: delError } = await supabase.from('product_colors').delete().eq('id', del.dataset.del);
    if (delError) { say(translateError(delError), 'error'); return; }
    say('Couleur supprimée.', 'success');
    reload();
  });

  section.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = String(new FormData(e.target).get('name')).trim();
    if (!name) { say('Indiquez le nom de la couleur.', 'error'); return; }
    const { error: insError } = await supabase.from('product_colors').insert({ product_id: productId, name });
    if (insError) {
      say(insError.message.includes('duplicate') ? 'Cette couleur existe déjà pour ce produit.' : translateError(insError), 'error');
      return;
    }
    say('Couleur ajoutée.', 'success');
    reload();
  });

  wrap.appendChild(section);
}

/** Photos supplémentaires d'un produit : ajout multiple, suppression, défilement sur la boutique. */
async function renderImageManager(wrap, productId, say) {
  const { data: imgs, error } = await supabase.from('product_images')
    .select('id, url, position').eq('product_id', productId).order('position');
  if (error) { say(translateError(error), 'error'); return; }

  const section = document.createElement('section');
  section.className = 'card admin-form';
  section.id = 'image-manager';
  const reload = () => { section.remove(); renderImageManager(wrap, productId, say); };

  section.innerHTML = `
    <h2>Photos du produit</h2>
    <p class="hint">Sur la boutique, les photos défilent en boucle. Sur la fiche, le client les parcourt en glissant.</p>
    <div class="thumbs">
      ${imgs.map((i) => `
        <div class="thumb">
          <img src="${escapeHtml(i.url)}" alt="">
          <button type="button" class="chip-x" data-del="${i.id}" aria-label="Supprimer la photo">×</button>
        </div>`).join('') || '<p class="product-code">Aucune photo supplémentaire.</p>'}
    </div>
    <form id="img-add" novalidate>
      <label>Ajouter des photos (plusieurs possibles, 5 Mo maximum chacune)
        <input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp">
      </label>
      <button class="btn btn-ghost btn-block" type="submit">Téléverser les photos</button>
    </form>`;

  section.addEventListener('click', async (e) => {
    const del = e.target.closest('button[data-del]');
    if (!del) return;
    const { data: removed, error: delError } = await supabase.from('product_images')
      .delete().eq('id', del.dataset.del).select('id');
    if (delError) { say(translateError(delError), 'error'); return; }
    if (!removed?.length) { say('Suppression refusée : vos droits ne permettent pas cette action.', 'error'); return; }
    say('Photo supprimée.', 'success');
    reload();
  });

  section.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = [...section.querySelector('input[name="photos"]').files];
    if (!files.length) { say('Choisissez au moins une photo.', 'error'); return; }
    let position = imgs.length;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { say('Une photo dépasse 5 Mo.', 'error'); return; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `produits/${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upError } = await supabase.storage.from('produits')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upError) { say(translateError(upError), 'error'); return; }
      const url = supabase.storage.from('produits').getPublicUrl(path).data.publicUrl;
      const { error: insError } = await supabase.from('product_images')
        .insert({ product_id: productId, url, position: position++ });
      if (insError) { say(translateError(insError), 'error'); return; }
    }
    say(`${files.length} photo(s) ajoutée(s).`, 'success');
    reload();
  });

  wrap.appendChild(section);
}
