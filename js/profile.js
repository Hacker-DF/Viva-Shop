/**
 * profile.js — Mon compte.
 * #/compte                 : menu principal (groupes, rubriques cliquables)
 * #/compte/infos           : informations personnelles
 * #/compte/identifiants    : identifiants (nom d'utilisateur, email masqué)
 * #/compte/photo           : photo de profil
 * #/compte/adresses        : adresses de livraison
 * #/compte/mot-de-passe    : changement du mot de passe
 * Les droits sont vérifiés par la base ; l'écran n'affiche que ce qui est permis.
 */
import { escapeHtml, icon } from './ui.js';
import { getProfile, updateProfile, getRoleLabels, getRoleCodes, getSession, signOut, translateError } from './auth.js';
import { fieldHtml } from './auth-pages.js';
import { supabase } from './supabase.js';
import { renderAddresses } from './addresses.js';

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

const SECTIONS = {
  'infos': { title: 'Informations personnelles' },
  'identifiants': { title: 'Identifiants' },
  'photo': { title: 'Photo de profil' },
  'adresses': { title: 'Adresses de livraison' },
  'mot-de-passe': { title: 'Changer le mot de passe' },
};

export async function render(container) {
  const profile = await getProfile();
  if (!profile) {
    const session = await getSession();
    if (session) {
      container.innerHTML = '<div class="alert alert-warn">Votre profil est en cours de création. Patientez quelques secondes, puis rechargez la page.</div>';
    } else {
      renderGuest(container);
    }
    return;
  }

  const session = await getSession();
  const view = {
    profile,
    session,
    email: session?.user?.email || '',
    roles: await getRoleLabels(),
    codes: await getRoleCodes(),
  };

  const sub = window.location.hash.split('/')[2] || '';
  if (SECTIONS[sub]) return renderSection(container, sub, view);
  return renderMenu(container, view);
}

/* ---------- Menu principal ---------- */

function row(href, iconName, title, subtitle = '') {
  return `
    <a class="menu-row" href="${href}">
      ${icon(iconName)}
      <span><strong>${escapeHtml(title)}</strong>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}</span>
      <span class="chev" aria-hidden="true">›</span>
    </a>`;
}

function renderMenu(container, { profile, roles, codes, email }) {
  const has = (list) => codes.some((c) => list.includes(c));
  const initials = `${profile.first_name[0] || ''}${profile.last_name[0] || ''}`;

  const staffRows = [];
  if (has(['administrateur_principal', 'gestionnaire_produits'])) staffRows.push(row('#/admin', 'shield', 'Produits', 'Catalogue, photos, couleurs'));
  if (has(['administrateur_principal'])) staffRows.push(row('#/admin/tableau', 'shield', 'Tableau de bord', 'Chiffres, clients, journal'));
  if (has(['administrateur_principal', 'gestionnaire_produits', 'responsable_logistique'])) staffRows.push(row('#/admin/annonces', 'message', 'Annonces', 'Messages de l’accueil'));
  if (has(['administrateur_principal', 'agent_financier'])) staffRows.push(row('#/admin/paiements', 'credit-card', 'Vérification des paiements', 'Déclarations à traiter'));
  if (has(['administrateur_principal', 'agent_chine', 'responsable_logistique', 'agent_livraison'])) staffRows.push(row('#/admin/logistique', 'truck', 'Logistique', 'Colis et affectations'));
  if (has(['administrateur_principal', 'responsable_commandes'])) staffRows.push(row('#/admin/demandes', 'package', 'Demandes spéciales', 'Études et devis'));
  if (has(['administrateur_principal', 'support_client', 'responsable_commandes'])) staffRows.push(row('#/admin/support', 'support', 'Réclamations', 'Demandes des clients'));
  if (has(['administrateur_principal'])) staffRows.push(row('#/admin/equipe', 'user', 'Équipe', 'Rôles et accès'));

  container.innerHTML = `
    <section class="account-head card">
      ${profile.avatar_url
        ? `<img class="avatar avatar-img" src="${escapeHtml(profile.avatar_url)}" alt="">`
        : `<div class="avatar" aria-hidden="true">${escapeHtml(initials)}</div>`}
      <div>
        <h1>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</h1>
        <small>@${escapeHtml(profile.username)}</small>
        <p class="roles">${roles.length ? escapeHtml(roles.join(' · ')) : 'Compte client'}</p>
      </div>
    </section>

    ${profile.is_suspended ? '<div class="alert alert-error">Votre compte est suspendu : vous ne pouvez plus réserver ni déclarer de paiement. Contactez un assistant.</div>' : ''}

    <h2 class="menu-title">Mon profil</h2>
    <nav class="menu-group">
      ${row('#/compte/infos', 'user', 'Informations personnelles', 'Nom, téléphone, ville')}
      ${row('#/compte/identifiants', 'lock', 'Identifiants', `@${profile.username}`)}
      ${row('#/compte/photo', 'user', 'Photo de profil', 'Modifier ma photo')}
    </nav>

    <h2 class="menu-title">Livraison et sécurité</h2>
    <nav class="menu-group">
      ${row('#/compte/adresses', 'store', 'Adresses de livraison', 'Où recevoir mes colis')}
      ${row('#/compte/mot-de-passe', 'lock', 'Changer le mot de passe', 'Au moins 8 caractères')}
    </nav>

    ${staffRows.length ? `<h2 class="menu-title">Espace équipe</h2><nav class="menu-group">${staffRows.join('')}</nav>` : ''}

    <h2 class="menu-title">Aide et informations</h2>
    <nav class="menu-group">
      ${row('#/guide', 'file-text', 'Guide d’utilisation')}
      ${row('#/confidentialite', 'lock', 'Politique de confidentialité')}
      ${row('#/conditions', 'shield', 'Conditions générales')}
      ${row('#/support', 'message', 'Signaler un problème', 'Écrire à l’équipe')}
    </nav>

    <button id="logout" class="btn btn-ghost btn-block logout" type="button">Se déconnecter</button>`;

  container.querySelector('#logout').addEventListener('click', async () => {
    await signOut();
    window.location.hash = '#/accueil';
  });
}

/* ---------- Sous-pages ---------- */

function subpageHead(title) {
  return `<a class="back" href="#/compte">← Mon compte</a><h1 class="subpage-title">${escapeHtml(title)}</h1>`;
}

function showMsg(el, text, type) {
  el.className = `alert alert-${type}`;
  el.textContent = text;
  el.hidden = false;
}

async function renderSection(container, key, view) {
  const { profile } = view;
  const head = subpageHead(SECTIONS[key].title);

  if (key === 'infos') {
    container.innerHTML = `${head}
      <section class="card auth">
        <form id="info-form" novalidate>
          ${fieldHtml({ name: 'first_name', label: 'Prénom', type: 'text', autocomplete: 'given-name', value: profile.first_name })}
          ${fieldHtml({ name: 'last_name', label: 'Nom', type: 'text', autocomplete: 'family-name', value: profile.last_name })}
          ${fieldHtml({ name: 'phone', label: 'Téléphone (WhatsApp)', type: 'tel', autocomplete: 'tel', value: profile.phone })}
          ${fieldHtml({ name: 'city', label: 'Ville (facultatif)', type: 'text', autocomplete: 'address-level2', value: profile.city || '', optional: true })}
          <div class="alert" id="info-msg" role="status" hidden></div>
          <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
        </form>
      </section>`;
    const form = container.querySelector('#info-form');
    const msg = container.querySelector('#info-msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await updateProfile({
          first_name: String(fd.get('first_name')).trim(),
          last_name: String(fd.get('last_name')).trim(),
          phone: String(fd.get('phone')).trim(),
          city: String(fd.get('city')).trim() || null,
        });
        showMsg(msg, 'Informations enregistrées.', 'success');
      } catch (err) {
        showMsg(msg, translateError(err), 'error');
      }
    });
    return;
  }

  if (key === 'identifiants') {
    const masked = maskEmail(view.email);
    container.innerHTML = `${head}
      <section class="card">
        <div class="field-line"><span>Nom d’utilisateur</span><strong>@${escapeHtml(profile.username)}</strong></div>
        <div class="field-line"><span>Email</span><strong id="mask-email">${escapeHtml(masked)}</strong></div>
        <button id="reveal" class="btn btn-ghost btn-small" type="button" data-shown="0">Afficher</button>
        <p class="hint">Pour changer votre nom d’utilisateur ou votre email, écrivez à un assistant : ces informations servent à vous connecter.</p>
      </section>`;
    container.querySelector('#reveal').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const shown = btn.dataset.shown === '1';
      btn.dataset.shown = shown ? '0' : '1';
      btn.textContent = shown ? 'Afficher' : 'Masquer';
      container.querySelector('#mask-email').textContent = shown ? maskEmail(view.email) : view.email;
    });
    return;
  }

  if (key === 'photo') {
    container.innerHTML = `${head}
      <section class="card auth">
        <div class="photo-preview">
          ${profile.avatar_url
            ? `<img class="avatar avatar-xl" src="${escapeHtml(profile.avatar_url)}" alt="Photo actuelle">`
            : `<div class="avatar avatar-xl" aria-hidden="true">${escapeHtml(`${profile.first_name[0] || ''}${profile.last_name[0] || ''}`)}</div>`}
        </div>
        <label class="btn btn-primary btn-block">Choisir une photo
          <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
        </label>
        <p class="hint">JPG, PNG ou WebP, 2 Mo maximum.</p>
        <div class="alert" id="photo-msg" role="status" hidden></div>
      </section>`;
    container.querySelector('#avatar-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const msg = container.querySelector('#photo-msg');
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { showMsg(msg, 'Photo trop lourde (2 Mo maximum).', 'error'); return; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${view.session.user.id}/${Date.now()}.${ext}`;
      const { error: upError } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
      if (upError) { showMsg(msg, translateError(upError), 'error'); return; }
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      try {
        await updateProfile({ avatar_url: url });
        await render(container);
      } catch (err) {
        showMsg(msg, translateError(err), 'error');
      }
    });
    return;
  }

  if (key === 'adresses') {
    container.innerHTML = `${head}<div id="addresses-slot"></div>`;
    renderAddresses(container.querySelector('#addresses-slot'));
    return;
  }

  if (key === 'mot-de-passe') {
    container.innerHTML = `${head}
      <section class="card auth">
        <form id="pw-change" novalidate>
          <div class="field">
            <label for="pw-current">Mot de passe actuel</label>
            <input id="pw-current" name="current" type="password" autocomplete="current-password" required placeholder="••••••••">
          </div>
          <div class="field">
            <label for="pw-new">Nouveau mot de passe</label>
            <input id="pw-new" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="••••••••">
          </div>
          <div class="field">
            <label for="pw-confirm">Confirmer le mot de passe</label>
            <input id="pw-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required placeholder="••••••••">
          </div>
          <p class="hint">8 caractères minimum, avec une majuscule, une minuscule et un symbole.</p>
          <div class="alert" id="pw-msg" role="status" hidden></div>
          <button class="btn btn-primary btn-block" type="submit">Modifier le mot de passe</button>
        </form>
      </section>`;
    container.querySelector('#pw-change').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget; // capturé avant l'attente
      const fd = new FormData(form);
      const current = String(fd.get('current'));
      const pw = String(fd.get('password'));
      const pw2 = String(fd.get('confirm'));
      const msg = container.querySelector('#pw-msg');
      if (!current) { showMsg(msg, 'Saisissez votre mot de passe actuel.', 'error'); return; }
      if (!PASSWORD_RE.test(pw)) { showMsg(msg, '8 caractères minimum, avec une majuscule, une minuscule et un symbole.', 'error'); return; }
      if (pw !== pw2) { showMsg(msg, 'Les deux mots de passe ne correspondent pas.', 'error'); return; }
      if (pw === current) { showMsg(msg, 'Le nouveau mot de passe doit être différent de l’actuel.', 'error'); return; }
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email;
      if (!email) { showMsg(msg, 'Session expirée. Reconnectez-vous.', 'error'); return; }
      // Vérification de l'ancien mot de passe avant toute modification
      const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (checkError) { showMsg(msg, 'Mot de passe actuel incorrect.', 'error'); return; }
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { showMsg(msg, translateError(error), 'error'); return; }
      form.reset();
      showMsg(msg, 'Mot de passe modifié.', 'success');
    });
  }
}

/* ---------- Outils ---------- */

/** Email masqué : deux premiers caractères puis le domaine. */
function maskEmail(e) {
  const [u = '', dom = ''] = String(e || '').split('@');
  return dom ? `${u.slice(0, 2)}•••@${dom}` : '••••';
}

function renderGuest(container) {
  container.innerHTML = `
    <section class="card placeholder">
      <div class="placeholder-icon">${icon('user')}</div>
      <h1>Mon compte</h1>
      <p>Connectez-vous pour gérer votre profil, vos commandes et vos adresses.</p>
      <a class="btn btn-primary" href="#/connexion">Se connecter</a>
      <a class="btn btn-ghost" href="#/inscription">Créer un compte</a>
    </section>`;
}
