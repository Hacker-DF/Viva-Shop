/**
 * admin.js — Administration des produits : liste, ajout, modification, archivage.
 * La vérification de rôle ici n'améliore que l'affichage ; l'écriture est refusée par Supabase (RLS)
 * si l'utilisateur n'a pas le rôle requis.
 */
import { bindCategoryGuess } from './category-guess.js';
import { escapeHtml, icon } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';
import { listCategories, STATUS_LABELS, formatFcfa, listTiers } from './products.js';
import { t } from './i18n.js';

const CATALOGUE_ROLES = ['administrateur_principal', 'gestionnaire_produits'];

/** Message de succès à afficher après rechargement de la page. */
let pending = null;

export async function render(container) {
  const session = await getSession();
  if (!session) {
    container.innerHTML = `
      <div class="alert alert-warn">${t('adm.login')}</div>
      <a class="btn btn-primary" href="#/connexion">${t('auth.submit.login')}</a>`;
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
    container.innerHTML = `<div class="alert alert-error">${t('adm.restricted')}</div>`;
    return;
  }

  const isPrincipal = codes.includes('administrateur_principal');
  if (window.location.hash.split('/')[2] === 'equipe') {
    if (!isPrincipal) {
      container.innerHTML = `<div class="alert alert-error">${t('adm.principal_only')}</div>`;
      return;
    }
    return (await import('./team.js')).render(container);
  }
  if (window.location.hash.split('/')[2] === 'reservations') {
    if (!isPrincipal) {
      container.innerHTML = `<div class="alert alert-error">${t('adm.principal_only')}</div>`;
      return;
    }
    return (await import('./reservations-admin.js')).render(container);
  }
  if (window.location.hash.split('/')[2] === 'journal') {
    if (!isPrincipal) {
      container.innerHTML = `<div class="alert alert-error">${t('adm.principal_only')}</div>`;
      return;
    }
    return (await import('./journal.js')).render(container);
  }
  if (window.location.hash.split('/')[2] === 'campagnes') {
    return (await import('./campaigns.js')).render(container);
  }

  const [categories, products] = await Promise.all([listCategories(), loadProducts()]);
  const categoryName = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  container.innerHTML = `
    <div class="admin-toolbar">
      <h1>${t('admin.products')}</h1>
      <a class="btn btn-ghost btn-small" href="#/admin/annonces">${t('ann.title')}</a>
      ${isPrincipal ? `<a class="btn btn-ghost btn-small" href="#/admin/tableau">${t('pf.staff.dash')}</a>` : ''}
      <a class="btn btn-ghost btn-small" href="#/admin/campagnes">${t('adm.campaigns')}</a>
      ${isPrincipal ? `<a class="btn btn-ghost btn-small" href="#/admin/equipe">${t('team.title')}</a>` : ''}
      ${isPrincipal ? `<a class="btn btn-ghost btn-small" href="#/admin/journal">${t('jr.title')}</a>` : ''}
      ${isPrincipal ? `<a class="btn btn-ghost btn-small" href="#/admin/reservations">${t('res.admin_title')}</a>` : ''}
      <button id="new" class="btn btn-gold" type="button">${icon('tag')} ${t('adm.new')}</button>
    </div>
    <div id="admin-msg" class="alert" role="status" hidden></div>
    <section id="form-wrap" hidden></section>
    <ul class="admin-list">
      ${products.map((p) => rowHtml(p, categoryName)).join('') || `<li class="empty">${t('adm.none')}</li>`}
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
      else refresh(product.is_archived ? t('adm.reactivated') : t('adm.archived'));
    } else if (btn.dataset.action === 'delete') {
      if (!window.confirm(t('adm.delete_confirm'))) return;
      const { error } = await supabase.rpc('delete_product', { p_id: product.id });
      if (error) say(translateError(error), 'error');
      else refresh(t('adm.deleted'));
    }
  });
}

async function loadProducts() {
  const { data, error } = await supabase.from('products')
    .select('id, code, name, description, category_id, price_ht, promo_price, main_image_url, status, is_archived, has_colors, order_date, reservation_deadline')
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
        <span class="product-code">${escapeHtml(p.code)} · ${escapeHtml(categoryName[p.category_id] || t('adm.nocat'))}</span>
        <span class="admin-meta">
          <span class="status-badge" style="--c: ${status.color}">${escapeHtml(status.label)}</span>
          ${p.is_archived ? `<span class="status-badge" style="--c: var(--grey-600)">${t('adm.archived_badge')}</span>` : ''}
          ${escapeHtml(formatFcfa(p.promo_price ?? p.price_ht))}
        </span>
      </div>
      <div class="admin-actions">
        <button class="btn btn-ghost btn-small" type="button" data-action="edit" data-id="${p.id}">${t('adm.edit')}</button>
        <button class="btn btn-ghost btn-small" type="button" data-action="archive" data-id="${p.id}">
          ${p.is_archived ? t('adm.reactivate') : t('adm.archive')}
        </button>
        <button class="btn btn-ghost btn-small" type="button" data-action="delete" data-id="${p.id}">${t('common.delete')}</button>
      </div>
    </li>`;
}

/** Formulaire d'ajout (product = null) ou de modification. */
async function openForm(container, product, categories, say, onSaved) {
  const wrap = container.querySelector('#form-wrap');
  const tiersNow = product ? await listTiers(product.id) : [];
  const v = product || {};
  const statusOptions = Object.entries(STATUS_LABELS)
    .map(([key, s]) => `<option value="${key}" ${v.status === key ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('');
  const categoryOptions = categories
    .map((c) => `<option value="${c.id}" ${v.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

  wrap.hidden = false;
  wrap.innerHTML = `
    <form class="card admin-form" novalidate>
      <h2>${product ? t('adm.edit_product') : t('adm.new')}</h2>
      ${product ? `<p class="product-code">${t('adm.code')} ${escapeHtml(product.code)} (${t('adm.nonedit')})</p>` : ''}
      <label>${t('adm.name')}<input name="name" required minlength="2" maxlength="150" value="${escapeHtml(v.name || '')}"></label>
      <label>${t('adm.category')}<select name="category"><option value="">${t('adm.nocat')}</option>${categoryOptions}</select></label>
      <label>${t('adm.description')}<textarea name="description" rows="3">${escapeHtml(v.description || '')}</textarea></label>
      <div class="two-cols">
        <label>${t('adm.price')}<input name="price" type="number" min="0" step="1" required value="${v.price_ht ?? ''}"></label>
        <label>${t('adm.promo')}<input name="promo" type="number" min="0" step="1" value="${v.promo_price ?? ''}"></label>
      </div>
      <div class="two-cols">
        <label>${t('adm.order_date')}<input name="order_date" type="date" value="${escapeHtml(v.order_date || '')}"></label>
        <label>${t('adm.res_deadline')}<input name="reservation_deadline" type="date" value="${escapeHtml(v.reservation_deadline || '')}"></label>
      </div>
      <label>${t('adm.status')}<select name="status">${statusOptions}</select></label>
      <label>${t('adm.image')}<input name="image" type="url" placeholder="https://…" value="${escapeHtml(v.main_image_url || '')}"></label>
      <div class="field-block">
        <span class="field-label">${t('adm.main_photo')}</span>
        <label class="file-drop" data-empty="${t('adm.choose_main')}">
          <input class="visually-hidden" name="photo" type="file" accept="image/jpeg,image/png,image/webp">
          <span class="file-drop-icon" aria-hidden="true">+</span>
          <span class="file-drop-text">${t('adm.choose_main')}</span>
        </label>
      </div>
      <div class="field-block">
        <span class="field-label">${t('adm.extra_photos')}</span>
        <label class="file-drop" data-empty="${t('adm.add_photos')}">
          <input class="visually-hidden" name="gallery" type="file" multiple accept="image/jpeg,image/png,image/webp">
          <span class="file-drop-icon" aria-hidden="true">+</span>
          <span class="file-drop-text">${t('adm.add_photos')}</span>
        </label>
      </div>
      <label class="check-line">
        <input name="has_colors" type="checkbox" ${v.has_colors === false ? '' : 'checked'}>
        ${t('adm.has_colors')}
      </label>
      ${tiersBlockHtml(tiersNow)}
      <p class="hint"><strong>${t('adm.min_strong')}</strong>${t('adm.min_rest')}</p>
      <p class="field-error" id="form-error" hidden></p>
      <div class="actions">
        <button class="btn btn-primary btn-block" type="submit">${t('adm.save')}</button>
        <button class="btn btn-ghost btn-block" type="button" data-cancel>${t('adm.cancel')}</button>
      </div>
    </form>`;

  const form = wrap.querySelector('form');
  const err = wrap.querySelector('#form-error');
  wrap.querySelector('[data-cancel]').addEventListener('click', () => { wrap.hidden = true; wrap.innerHTML = ''; });
  bindFileDrops(wrap);
  const tierRows = wrap.querySelector('#tier-rows');
  wrap.querySelector('#tier-add').addEventListener('click', () => tierRows.insertAdjacentHTML('beforeend', tierRowHtml()));
  tierRows.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-tier-remove]');
    if (removeBtn) removeBtn.closest('.tier-row').remove();
  });
  bindCategoryGuess(wrap.querySelector('form'), categories);
  if (product) {
    if (product.has_colors !== false) renderColorManager(wrap, product.id, say);
    renderImageManager(wrap, product.id, say);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const tiers = readTiers(form);
    const tierProblem = validateTiers(tiers);
    if (tierProblem) { err.textContent = tierProblem; err.hidden = false; return; }
    const name = String(fd.get('name')).trim();
    const price = Number(fd.get('price'));
    const promoRaw = String(fd.get('promo')).trim();
    const promo = promoRaw === '' ? null : Number(promoRaw);
    const image = String(fd.get('image')).trim();

    // Contrôles avant envoi (la base revalide tout)
    let problem = '';
    if (name.length < 2) problem = t('adm.err_name');
    else if (!Number.isInteger(price) || price < 0) problem = t('adm.err_price');
    else if (promo !== null && (!Number.isInteger(promo) || promo < 0 || promo > price)) problem = t('adm.err_promo');
    else if (image && !image.startsWith('https://')) problem = t('adm.err_https');
    if (problem) { err.textContent = problem; err.hidden = false; return; }

    // Minimum de 5 photos par produit, photo principale comprise
    const newPhoto = fd.get('photo');
    const galleryCount = fd.getAll('gallery').filter((f) => f && f.size > 0).length;
    const mainCount = (newPhoto && newPhoto.size > 0) || image ? 1 : 0;
    let existingCount = 0;
    if (product) {
      const { count } = await supabase.from('product_images')
        .select('id', { count: 'exact', head: true }).eq('product_id', product.id);
      existingCount = count || 0;
    }
    const totalPhotos = mainCount + galleryCount + existingCount;
    if (totalPhotos < 3) {
      err.textContent = `${t('adm.err_photos')} ${totalPhotos}.`;
      err.hidden = false;
      return;
    }

    // Téléversement de la photo (si une photo est choisie)
    let imageUrl = image || null;
    const photo = fd.get('photo');
    if (photo && photo.size > 0) {
      if (photo.size > 5 * 1024 * 1024) { err.textContent = t('adm.err_big'); err.hidden = false; return; }
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
      has_colors: fd.has('has_colors'),
      order_date: String(fd.get('order_date') || '') || null,
      reservation_deadline: String(fd.get('reservation_deadline') || '') || null,
    };

    const request = product
      ? supabase.from('products').update(payload).eq('id', product.id).select('code').single()
      : supabase.from('products').insert(payload).select('id, code').single();
    const { data, error } = await request;

    if (error) { err.textContent = translateError(error); err.hidden = false; return; }
    if (!product) {
      const extra = fd.getAll('gallery').filter((f) => f && f.size > 0);
      if (extra.length) {
        const galleryError = await uploadGalleryPhotos(data.id, extra);
        if (galleryError) { err.textContent = galleryError; err.hidden = false; }
      }
    }
    const tierError = await saveTiers(product ? product.id : data.id, tiers);
    if (tierError) { err.textContent = translateError(tierError); err.hidden = false; return; }
    onSaved(product ? t('adm.updated') : `${t('adm.created')} ${data.code}`);
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
    <h2>${t('adm.colors')}</h2>
    <p class="hint">${t('adm.colors_hint')}</p>
    <ul class="campaign-items">
      ${colors.map((c) => `<li>${escapeHtml(c.name)} <button type="button" class="chip-x" data-del="${c.id}" aria-label="${t('adm.del_color')}">×</button></li>`).join('')
        || `<li class="product-code">${t('adm.no_colors')}</li>`}
    </ul>
    <form id="color-add" novalidate>
      <label>${t('adm.color_name')}<input name="name" maxlength="40" required></label>
      <button class="btn btn-ghost btn-block" type="submit">${t('adm.add_color')}</button>
    </form>`;

  section.addEventListener('click', async (e) => {
    const del = e.target.closest('button[data-del]');
    if (!del) return;
    const { error: delError } = await supabase.from('product_colors').delete().eq('id', del.dataset.del);
    if (delError) { say(translateError(delError), 'error'); return; }
    say(t('adm.color_deleted'), 'success');
    reload();
  });

  section.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = String(new FormData(e.target).get('name')).trim();
    if (!name) { say(t('adm.color_name_err'), 'error'); return; }
    const { error: insError } = await supabase.from('product_colors').insert({ product_id: productId, name });
    if (insError) {
      say(insError.message.includes('duplicate') ? t('adm.color_dup') : translateError(insError), 'error');
      return;
    }
    say(t('adm.color_added'), 'success');
    reload();
  });

  bindFileDrops(section);
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
    <h2>${t('adm.photos_title')}</h2>
    <p class="hint">${t('adm.min_hint')} <strong>${imgs.length}</strong> ${t('adm.extra_have')}</p>
    <div class="thumbs">
      ${imgs.map((i) => `
        <div class="thumb">
          <img src="${escapeHtml(i.url)}" alt="">
          <button type="button" class="chip-x" data-del="${i.id}" aria-label="${t('adm.del_photo')}">×</button>
        </div>`).join('') || `<p class="product-code">${t('adm.no_extra')}</p>`}
    </div>
    <form id="img-add" novalidate>
      <label class="file-drop" data-empty="${t('adm.add_photos')}">
        <input class="visually-hidden" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp">
        <span class="file-drop-icon" aria-hidden="true">+</span>
        <span class="file-drop-text">${t('adm.add_photos')}</span>
      </label>
      <button class="btn btn-primary btn-block" type="submit">${t('adm.upload')}</button>
    </form>`;

  section.addEventListener('click', async (e) => {
    const del = e.target.closest('button[data-del]');
    if (!del) return;
    const { data: removed, error: delError } = await supabase.from('product_images')
      .delete().eq('id', del.dataset.del).select('id');
    if (delError) { say(translateError(delError), 'error'); return; }
    if (!removed?.length) { say(t('adm.del_denied'), 'error'); return; }
    say(t('adm.photo_deleted'), 'success');
    reload();
  });

  section.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = [...section.querySelector('input[name="photos"]').files];
    if (!files.length) { say(t('adm.choose_one'), 'error'); return; }
    let position = imgs.length;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { say(t('adm.one_big'), 'error'); return; }
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
    say(`${files.length} ${t('adm.added')}`, 'success');
    reload();
  });

  bindFileDrops(section);
  wrap.appendChild(section);
}


/** Affiche le nombre de fichiers choisis dans chaque zone de dépôt. */
function bindFileDrops(root) {
  root.querySelectorAll('.file-drop').forEach((label) => {
    const input = label.querySelector('input[type="file"]');
    const text = label.querySelector('.file-drop-text');
    if (!input || !text) return;
    input.addEventListener('change', () => {
      const n = input.files.length;
      label.dataset.count = String(n);
      text.textContent = n ? `${n} ${t('adm.chosen')}` : label.dataset.empty;
    });
  });
}

/** Envoie les photos supplémentaires d'un produit venant d'être créé. Retourne un message d'erreur ou null. */
async function uploadGalleryPhotos(productId, files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 5 * 1024 * 1024) return `${t('adm.photo_pre')} « ${file.name} » ${t('adm.photo_post')}`;
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `produits/${productId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upError } = await supabase.storage.from('produits').upload(path, file, { contentType: file.type, upsert: false });
    if (upError) return translateError(upError);
    const url = supabase.storage.from('produits').getPublicUrl(path).data.publicUrl;
    const { error: insError } = await supabase.from('product_images').insert({ product_id: productId, url, position: i });
    if (insError) return translateError(insError);
  }
  return null;
}

/** Bloc « Tarifs par quantité » du formulaire produit. */
function tierRowHtml(tr = {}) {
  return `<div class="tier-row">
    <label>${t('adm.tier_min')}<input name="tier_min" type="number" min="1" step="1" value="${tr.min_qty ?? ''}"></label>
    <label>${t('adm.tier_max')}<input name="tier_max" type="number" min="1" step="1" value="${tr.max_qty ?? ''}" placeholder="${t('adm.tier_plus')}"></label>
    <label>${t('adm.tier_price')}<input name="tier_price" type="number" min="0" step="1" value="${tr.unit_price_ht ?? ''}"></label>
    <button type="button" class="btn btn-ghost btn-small tier-remove" data-tier-remove aria-label="${t('adm.tier_remove')}">×</button>
  </div>`;
}

function tiersBlockHtml(tiers) {
  return `<section class="tiers-editor">
    <h3>${t('adm.tiers_title')}</h3>
    <p class="hint">${t('adm.tiers_hint')}</p>
    <div id="tier-rows">${(tiers.length ? tiers : [{}]).map(tierRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost btn-small" id="tier-add">+ ${t('adm.tier_add')}</button>
  </section>`;
}

/** Lit les paliers saisis, sans les lignes vides. */
function readTiers(form) {
  return [...form.querySelectorAll('#tier-rows .tier-row')].map((row) => {
    const read = (name) => row.querySelector(`[name="${name}"]`).value;
    return {
      min: read('tier_min') === '' ? null : Number(read('tier_min')),
      max: read('tier_max') === '' ? null : Number(read('tier_max')),
      price: read('tier_price') === '' ? null : Number(read('tier_price')),
    };
  }).filter((r) => r.min !== null || r.max !== null || r.price !== null);
}

/** Contrôle : valeurs entières cohérentes, et paliers qui ne se chevauchent pas. */
function validateTiers(rows) {
  if (!rows.length) return null;
  for (const r of rows) {
    if (!Number.isInteger(r.min) || r.min < 1 || !Number.isInteger(r.price) || r.price < 0) return t('adm.tier_err');
    if (r.max !== null && (!Number.isInteger(r.max) || r.max < r.min)) return t('adm.tier_order');
  }
  const sorted = [...rows].sort((a, b) => a.min - b.min);
  for (let i = 1; i < sorted.length; i++) {
    const previousEnd = sorted[i - 1].max ?? Infinity;
    if (sorted[i].min <= previousEnd) return t('adm.tier_order');
  }
  return null;
}

/** Remplace les paliers du produit par ceux de l'écran. */
async function saveTiers(productId, rows) {
  const { error: delError } = await supabase.from('price_tiers').delete().eq('product_id', productId);
  if (delError) return delError;
  if (!rows.length) return null;
  const { error } = await supabase.from('price_tiers').insert(rows.map((r) => ({
    product_id: productId, min_qty: r.min, max_qty: r.max, unit_price_ht: r.price,
  })));
  return error;
}
