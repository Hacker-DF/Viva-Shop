/**
 * logistics-admin.js — Logistique : création des colis, couleurs avec photo, statuts par rôle.
 * La base vérifie chaque action ; cet écran n'affiche que les étapes permises au rôle.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { getSession, getRoleCodes, translateError } from './auth.js';
import { formatFcfa } from './products.js';
import { t } from './i18n.js';

const LOGISTICS_ROLES = ['administrateur_principal', 'agent_chine', 'responsable_logistique', 'agent_livraison'];

const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR');

export const SHIP_STATUS = {
  transmise_chine: {
    get label() { return t('st.ship.transmise_chine'); },
    color: 'var(--status-red)',
  },
  achat_effectue: {
    get label() { return t('st.ship.achat_effectue'); },
    color: 'var(--electric)',
  },
  recu_chine: {
    get label() { return t('st.ship.recu_chine'); },
    color: 'var(--electric)',
  },
  expedie: {
    get label() { return t('st.ship.expedie'); },
    color: 'var(--status-orange)',
  },
  arrive_togo: {
    get label() { return t('st.ship.arrive_togo'); },
    color: 'var(--status-orange)',
  },
  en_livraison: {
    get label() { return t('st.ship.en_livraison'); },
    color: 'var(--status-green)',
  },
  livre: {
    get label() { return t('st.ship.livre'); },
    color: 'var(--status-grey)',
  },
};

/** Étape suivante permise à chaque rôle. */
const NEXT = {
  agent_chine: { transmise_chine: 'achat_effectue', achat_effectue: 'recu_chine' },
  responsable_logistique: { recu_chine: 'expedie', expedie: 'arrive_togo' },
  agent_livraison: { arrive_togo: 'en_livraison', en_livraison: 'livre' },
};
const ACTION_LABEL = {
  achat_effectue: 'Achat effectué', recu_chine: 'Reçu en Chine', expedie: 'Expédié',
  arrive_togo: 'Arrivé au Togo', en_livraison: 'En livraison', livre: 'Livré',
};

/** Étape suivante pour cet utilisateur, ou null. */
function nextFor(codes, status) {
  for (const role of codes) {
    const next = NEXT[role]?.[status];
    if (next) return next;
  }
  return null;
}

let pending = null;

export async function render(container) {
  const note = pending;
  pending = null;

  const session = await getSession();
  if (!session) {
    container.innerHTML = '<div class="alert alert-warn">Connectez-vous pour accéder à la logistique.</div>';
    return;
  }
  const codes = await getRoleCodes();
  if (!codes.some((c) => LOGISTICS_ROLES.includes(c))) {
    container.innerHTML = '<div class="alert alert-error">Accès réservé à l’équipe logistique.</div>';
    return;
  }
  const canCreate = codes.some((c) => ['administrateur_principal', 'responsable_logistique'].includes(c));
  const canArrival = codes.some((c) => ['administrateur_principal', 'responsable_logistique'].includes(c));
  const canDelete = canArrival;

  const [shipRes, colorRes, productRes, confirmedRes] = await Promise.all([
    supabase.from('shipments')
      .select('id, tracking_number, status, color_name, color_photo_url, estimated_arrival, assigned_to, declaration_id, payment_declarations(order_number, amount, products(name, code)), profiles!user_id(first_name, last_name, username)')
      .order('created_at', { ascending: false }).limit(100),
    supabase.from('product_colors').select('id, product_id, name, photo_url').order('name'),
    supabase.from('products').select('id, code, name, has_colors').eq('is_archived', false).order('name'),
    canCreate
      ? supabase.from('payment_declarations').select('id, order_number, product_id, products(name, code)').eq('status', 'paiement_confirme')
      : Promise.resolve({ data: [] }),
  ]);
  const error = shipRes.error || colorRes.error || productRes.error || confirmedRes.error;
  if (error) throw error;

  // Déclarations confirmées qui n'ont pas encore de colis
  const shipped = new Set(shipRes.data.map((s) => s.declaration_id));
  const shipments = shipRes.data;

  const colorsByProduct = {};
  colorRes.data.forEach((c) => { (colorsByProduct[c.product_id] ||= []).push(c); });

  container.innerHTML = `
    <div class="admin-toolbar"><h1>Logistique</h1><a class="btn btn-ghost btn-small" href="#/admin/annonces">Mes annonces</a></div>
    <div id="log-msg" class="alert" role="status" hidden></div>

    ${canCreate ? createFormHtml((confirmedRes.data || []).filter((d) => !shipped.has(d.id)), colorsByProduct) : ''}

    <h2 class="section-title">Colis</h2>
    <ul class="admin-list" id="ship-list">
      ${shipments.map((s) => shipmentHtml(s, codes, canArrival, canDelete)).join('') || '<li class="empty">Aucun colis pour le moment.</li>'}
    </ul>`;

  const msg = container.querySelector('#log-msg');
  const say = (text, type) => { msg.className = `alert alert-${type}`; msg.textContent = text; msg.hidden = false; };
  if (note) say(note.text, note.type);
  const done = (text) => { pending = { text, type: 'success' }; render(container); };

  const hasColorsById = Object.fromEntries(productRes.data.map((p) => [p.id, p.has_colors !== false]));

  // Création d'un colis
  const createForm = container.querySelector('#create-ship');
  if (createForm) {
    const decl = createForm.querySelector('[name="declaration"]');
    const color = createForm.querySelector('[name="color"]');

    const fillColors = () => {
      const productId = decl.selectedOptions[0]?.dataset.product;
      const list = colorsByProduct[productId] || [];
      const enabled = hasColorsById[productId] !== false;
      color.innerHTML = '<option value="">Sans couleur (facultatif)</option>'
        + (enabled ? list.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('') : '')
        + (enabled ? '<option value="__new__">+ Ajouter une couleur disponible…</option>' : '');
      color.dataset.product = productId || '';
    };
    decl.addEventListener('change', fillColors);
    color.addEventListener('change', async () => {
      if (color.value !== '__new__') return;
      const name = window.prompt('Nom de la couleur disponible :');
      color.value = '';
      if (!name || !name.trim()) return;
      const { error: colorError } = await supabase.from('product_colors')
        .insert({ product_id: color.dataset.product, name: name.trim() });
      if (colorError) {
        say(colorError.message.includes('duplicate') ? 'Cette couleur existe déjà pour ce produit.' : translateError(colorError), 'error');
        return;
      }
      done('Couleur ajoutée. Vous pouvez la choisir.');
    });
    fillColors();

    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!decl.value) { say('Choisissez une déclaration confirmée.', 'error'); return; }
      const { error: rpcError } = await supabase.rpc('create_shipment', {
        p_declaration: decl.value, p_color: color.value || null,
      });
      if (rpcError) {
        say(rpcError.message.includes('duplicate') ? 'Un colis existe déjà pour cette déclaration.' : translateError(rpcError), 'error');
        return;
      }
      done('Colis ajouté.');
    });
  }

  // Ajout d'une couleur avec sa photo
  const colorForm = container.querySelector('#add-color');
  if (colorForm) {
    colorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(colorForm);
      const name = String(fd.get('name')).trim();
      const photo = fd.get('photo');
      if (!fd.get('product') || name.length < 1) { say('Choisissez un produit et indiquez la couleur.', 'error'); return; }

      let photoUrl = null;
      if (photo && photo.size > 0) {
        if (photo.size > 5 * 1024 * 1024) { say('Photo trop lourde (5 Mo maximum).', 'error'); return; }
        const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `couleurs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upError } = await supabase.storage.from('produits').upload(path, photo, { contentType: photo.type, upsert: false });
        if (upError) { say(translateError(upError), 'error'); return; }
        photoUrl = supabase.storage.from('produits').getPublicUrl(path).data.publicUrl;
      }

      const { error: insError } = await supabase.from('product_colors').insert({
        product_id: String(fd.get('product')), name, photo_url: photoUrl,
      });
      if (insError) {
        say(insError.message.includes('duplicate') ? 'Cette couleur existe déjà pour ce produit.' : translateError(insError), 'error');
        return;
      }
      done('Couleur ajoutée.');
    });
  }

  // Avancement d'un colis
  container.querySelector('#ship-list').addEventListener('click', async (e) => {
    const assign = e.target.closest('button[data-assign]');
    if (assign) {
      const username = window.prompt('Nom d’utilisateur de l’agent (laisser vide pour retirer l’affectation) :', '');
      if (username === null) return;
      const { error: asError } = await supabase.rpc('assign_shipment', { p_id: assign.dataset.assign, p_username: username.trim() });
      if (asError) { say(translateError(asError), 'error'); return; }
      done('Affectation enregistrée.');
      return;
    }
    const del = e.target.closest('button[data-delete]');
    if (del) {
      if (!window.confirm('Supprimer ce colis ? Cette suppression est enregistrée dans le journal.')) return;
      const { error: delError } = await supabase.rpc('delete_shipment', { p_id: del.dataset.delete });
      if (delError) { say(translateError(delError), 'error'); return; }
      done('Colis supprimé.');
      return;
    }
    const arrival = e.target.closest('button[data-arrival]');
    if (arrival) {
      const typed = window.prompt('Date d’arrivée estimée (JJ/MM/AAAA) :', '');
      if (!typed) return;
      const m = typed.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) { say('Format attendu : JJ/MM/AAAA.', 'error'); return; }
      const { error: arrError } = await supabase.rpc('set_estimated_arrival', {
        p_id: arrival.dataset.arrival, p_date: `${m[3]}-${m[2]}-${m[1]}`,
      });
      if (arrError) { say(translateError(arrError), 'error'); return; }
      done('Date d’arrivée enregistrée. Le client la voit dans Mes colis.');
      return;
    }
    const btn = e.target.closest('button[data-next]');
    if (!btn) return;
    const comment = window.prompt('Commentaire (facultatif) :', '');
    if (comment === null) return;
    const { error: rpcError } = await supabase.rpc('set_shipment_status', {
      p_id: btn.dataset.id, p_status: btn.dataset.next, p_comment: comment,
    });
    if (rpcError) { say(translateError(rpcError), 'error'); return; }
    done('Statut mis à jour.');
  });
}

function createFormHtml(confirmed, colorsByProduct) {
  const available = confirmed;
  return `
    <form id="create-ship" class="card admin-form" novalidate>
      <h2>Ajouter un colis</h2>
      <p class="hint">Disponible uniquement pour les paiements confirmés.</p>
      <label>Déclaration confirmée
        <select name="declaration">
          ${available.map((d) => `<option value="${d.id}" data-product="${d.product_id}">${escapeHtml(d.order_number)} · ${escapeHtml(d.products?.name || '')}</option>`).join('')
            || '<option value="">Aucune déclaration confirmée</option>'}
        </select>
      </label>
      <label>Couleur (facultatif)<select name="color"></select></label>
      <button class="btn btn-primary btn-block" type="submit">Ajouter le colis</button>
    </form>`;
}

function colorFormHtml(products) {
  return `
    <form id="add-color" class="card admin-form" novalidate>
      <h2>Ajouter une couleur à un produit</h2>
      <label>Produit
        <select name="product">
          ${products.map((p) => `<option value="${p.id}">${escapeHtml(p.code)} · ${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </label>
      <label>Couleur<input name="name" maxlength="40" placeholder="Exemple : Rouge"></label>
      <label>Photo de cette couleur<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
      <button class="btn btn-ghost btn-block" type="submit">Ajouter la couleur</button>
    </form>`;
}

function shipmentHtml(s, codes, canArrival, canDelete) {
  const st = SHIP_STATUS[s.status] || SHIP_STATUS.transmise_chine;
  const next = nextFor(codes, s.status);
  const decl = s.payment_declarations || {};
  const client = s.profiles ? `${s.profiles.first_name} ${s.profiles.last_name} (@${s.profiles.username})` : '';
  return `
    <li class="admin-row">
      <div class="admin-row-main">
        <strong>${escapeHtml(s.tracking_number)} · ${escapeHtml(decl.products?.name || '')}</strong>
        <span class="product-code">${escapeHtml(decl.order_number || '')} · ${escapeHtml(client)}</span>
        ${s.color_name ? `<span class="product-code">Couleur : ${escapeHtml(s.color_name)}</span>` : ''}
        ${s.color_photo_url ? `<img class="color-thumb" src="${escapeHtml(s.color_photo_url)}" alt="${escapeHtml(s.color_name || '')}">` : ''}
        <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
      </div>
      <div class="admin-actions wrap">
        ${s.estimated_arrival ? `<span class="product-code">Arrivée prévue : ${escapeHtml(fmtDate(s.estimated_arrival))}</span>` : ''}
        ${s.assigned_to ? '<span class="product-code">Affecté à un agent</span>' : '<span class="product-code">Non affecté</span>'}
        ${canArrival ? `<button class="btn btn-ghost btn-small" type="button" data-arrival="${s.id}">Date d’arrivée</button>` : ''}
        ${canArrival ? `<button class="btn btn-ghost btn-small" type="button" data-assign="${s.id}">${s.assigned_to ? 'Changer l’agent' : 'Affecter un agent'}</button>` : ''}
        ${canDelete ? `<button class="btn btn-ghost btn-small" type="button" data-delete="${s.id}">Supprimer le colis</button>` : ''}
        ${next ? `<button class="btn btn-primary btn-small" type="button" data-id="${s.id}" data-next="${next}">${escapeHtml(ACTION_LABEL[next])}</button>` : ''}
      </div>
    </li>`;
}

/** Suivi d'un colis pour le client (section « Mes colis » de Commandes). */
export async function myShipmentsHtml() {
  const { data, error } = await supabase.from('shipments')
    .select('status, color_name, color_photo_url, estimated_arrival, payment_declarations(order_number), tracking_events(status, comment, created_at)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return '';
  return `
    <h2 class="section-title">Mes colis</h2>
    <p class="hint">Suivez votre colis avec votre numéro de commande. Pour toute question, écrivez à un assistant.</p>
    ${data.map((s) => {
      const st = SHIP_STATUS[s.status] || SHIP_STATUS.transmise_chine;
      const events = [...(s.tracking_events || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
      return `
        <div class="card ship-card">
          <strong>Commande ${escapeHtml(s.payment_declarations?.order_number || '')}</strong>
          <span class="status-badge" style="--c: ${st.color}">${escapeHtml(st.label)}</span>
          ${s.estimated_arrival ? `<p><strong>Arrivée prévue : ${escapeHtml(fmtDate(s.estimated_arrival))}</strong></p>` : ''}
          ${s.color_name ? `<p class="product-code">Couleur : ${escapeHtml(s.color_name)}</p>` : ''}
          ${s.color_photo_url ? `<img class="color-thumb" src="${escapeHtml(s.color_photo_url)}" alt="${escapeHtml(s.color_name || '')}">` : ''}
          <ol class="timeline">
            ${events.map((ev) => `
              <li><span>${escapeHtml(SHIP_STATUS[ev.status]?.label || ev.status)}</span>
                <small>${escapeHtml(new Date(ev.created_at).toLocaleString('fr-FR'))}</small>
                ${ev.comment ? `<em>${escapeHtml(ev.comment)}</em>` : ''}
              </li>`).join('')}
          </ol>
        </div>`;
    }).join('')}`;
}
