/**
 * profile.js — Mon compte : informations personnelles, identifiants, photo, coordonnées,
 * adresses, mot de passe, aide et déconnexion. Les droits sont vérifiés par la base.
 */
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';
import { getProfile, updateProfile, getRoleLabels, getRoleCodes, getSession, signOut, translateError } from './auth.js';
import { fieldHtml } from './auth-pages.js';
import { supabase } from './supabase.js';
import { renderAddresses } from './addresses.js';

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export async function render(container) {
  const profile = await getProfile();
  if (!profile) {
    const session = await getSession();
    if (session) {
      container.innerHTML = `<div class="alert alert-warn">${escapeHtml(t('prof.creating'))}</div>`;
    } else {
      renderGuest(container);
    }
    return;
  }

  const session = await getSession();
  const email = session?.user?.email || '';
  const roles = await getRoleLabels();
  const codes = await getRoleCodes();
  const has = (list) => codes.some((c) => list.includes(c));
  const initials = `${profile.first_name[0] || ''}${profile.last_name[0] || ''}`;

  container.innerHTML = `
    <section class="card auth">
      <div class="profile-head">
        ${profile.avatar_url
          ? `<img class="avatar avatar-img" src="${escapeHtml(profile.avatar_url)}" alt="">`
          : `<div class="avatar" aria-hidden="true">${escapeHtml(initials)}</div>`}
        <div>
          <h1>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</h1>
          <small>@${escapeHtml(profile.username)}</small>
        </div>
      </div>
      <p class="roles">${roles.length
        ? escapeHtml(t('prof.roles', { roles: roles.join(', ') }))
        : escapeHtml(t('prof.client'))}</p>
      ${profile.is_suspended ? '<div class="alert alert-error">Votre compte est suspendu : vous ne pouvez plus réserver ni déclarer de paiement. Contactez un assistant.</div>' : ''}
      ${has(['administrateur_principal', 'gestionnaire_produits']) ? `<a class="btn btn-ghost btn-block" href="#/admin">${escapeHtml(t('prof.admin'))}</a>` : ''}
      ${has(['administrateur_principal', 'agent_financier']) ? '<a class="btn btn-ghost btn-block" href="#/admin/paiements">Vérification des paiements</a>' : ''}
      ${has(['administrateur_principal', 'agent_chine', 'responsable_logistique', 'agent_livraison']) ? '<a class="btn btn-ghost btn-block" href="#/admin/logistique">Logistique</a>' : ''}
      ${has(['administrateur_principal', 'support_client', 'responsable_commandes']) ? '<a class="btn btn-ghost btn-block" href="#/admin/support">Réclamations</a>' : ''}
      ${has(['administrateur_principal', 'responsable_commandes']) ? '<a class="btn btn-ghost btn-block" href="#/admin/demandes">Demandes spéciales</a>' : ''}
    </section>

    <section class="card auth" id="my-info">
      <h2 class="section-title">${escapeHtml(t('pf.section.info'))}</h2>

      <h3>${escapeHtml(t('pf.section.ids'))}</h3>
      <p>${escapeHtml(t('auth.username'))} : <strong>@${escapeHtml(profile.username)}</strong></p>
      <section class="personal">
        <p>${escapeHtml(t('auth.email'))} : <strong id="mask-email">${escapeHtml(maskEmail(email))}</strong></p>
        <p>${escapeHtml(t('auth.phone'))} : <strong id="mask-phone">${escapeHtml(maskPhone(profile.phone))}</strong></p>
        <p>${escapeHtml(t('auth.city'))} : <strong id="mask-city">${profile.city ? '••••••' : '—'}</strong></p>
        <button type="button" id="reveal" class="btn btn-ghost btn-small" data-shown="0">${escapeHtml(t('prof.reveal'))}</button>
      </section>

      <h3>${escapeHtml(t('pf.section.photo'))}</h3>
      <label class="btn btn-ghost btn-small">${escapeHtml(t('pf.photo.change'))}
        <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      </label>

      <h3>${escapeHtml(t('pf.section.contact'))}</h3>
      <details class="edit-details">
        <summary>${escapeHtml(t('prof.edit'))}</summary>
        <form id="profile-form" novalidate>
          ${fieldHtml({ name: 'first_name', label: t('auth.firstname'), type: 'text', autocomplete: 'given-name', value: profile.first_name })}
          ${fieldHtml({ name: 'last_name', label: t('auth.lastname'), type: 'text', autocomplete: 'family-name', value: profile.last_name })}
          ${fieldHtml({ name: 'phone', label: t('auth.phone'), type: 'tel', autocomplete: 'tel', value: profile.phone })}
          ${fieldHtml({ name: 'city', label: t('auth.city'), type: 'text', autocomplete: 'address-level2', value: profile.city || '', optional: true })}
          <div class="alert" id="profile-msg" role="status" hidden></div>
          <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('prof.save'))}</button>
        </form>
      </details>

      <div id="addresses-slot"></div>

      <h3>${escapeHtml(t('pf.section.password'))}</h3>
      <form id="pw-change" class="admin-form" novalidate>
        <label>${escapeHtml(t('pf.newpw'))}<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <label>${escapeHtml(t('pf.confirmpw'))}<input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="hint">${escapeHtml(t('pf.pw.rule'))}</p>
        <div class="alert" id="pw-msg" role="status" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('pf.pw.save'))}</button>
      </form>
    </section>

    <section class="card auth">
      <h2 class="section-title">${escapeHtml(t('prof.help'))}</h2>
      <nav class="help-links">
        <a class="btn btn-ghost btn-block" href="#/guide">${icon('file-text')} ${escapeHtml(t('prof.guide'))}</a>
        <a class="btn btn-ghost btn-block" href="#/confidentialite">${icon('lock')} ${escapeHtml(t('prof.privacy'))}</a>
        <a class="btn btn-ghost btn-block" href="#/conditions">${icon('shield')} ${escapeHtml(t('prof.terms'))}</a>
        <a class="btn btn-ghost btn-block" href="#/support">${icon('message')} ${escapeHtml(t('pf.signal'))}</a>
      </nav>
    </section>

    <button id="logout" class="btn btn-ghost btn-block" type="button">${escapeHtml(t('prof.logout'))}</button>`;

  renderAddresses(container.querySelector('#addresses-slot'));

  // Photo de profil
  container.querySelector('#avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const msg = container.querySelector('#profile-msg');
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      msg.className = 'alert alert-error';
      msg.textContent = t('pf.photo.big');
      msg.hidden = false;
      return;
    }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const { error: upError } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false });
    if (upError) {
      msg.className = 'alert alert-error';
      msg.textContent = translateError(upError);
      msg.hidden = false;
      return;
    }
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    try {
      await updateProfile({ avatar_url: url });
      await render(container);
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = translateError(err);
      msg.hidden = false;
    }
  });

  // Affichage masqué des coordonnées
  const reveal = container.querySelector('#reveal');
  reveal.addEventListener('click', () => {
    const shown = reveal.dataset.shown === '1';
    reveal.dataset.shown = shown ? '0' : '1';
    reveal.textContent = t(shown ? 'prof.reveal' : 'prof.hide');
    container.querySelector('#mask-email').textContent = shown ? maskEmail(email) : email;
    container.querySelector('#mask-phone').textContent = shown ? maskPhone(profile.phone) : profile.phone;
    container.querySelector('#mask-city').textContent = shown ? (profile.city || '—') : (profile.city ? '••••••' : '—');
  });

  // Coordonnées
  const form = container.querySelector('#profile-form');
  const msg = container.querySelector('#profile-msg');
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
      msg.className = 'alert alert-success';
      msg.textContent = t('prof.saved');
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = translateError(err);
    }
    msg.hidden = false;
  });

  // Changement de mot de passe
  container.querySelector('#pw-change').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get('password'));
    const pw2 = String(fd.get('confirm'));
    const m = container.querySelector('#pw-msg');
    m.hidden = false;
    if (!PASSWORD_RE.test(pw)) { m.className = 'alert alert-error'; m.textContent = t('pf.pw.rule'); return; }
    if (pw !== pw2) { m.className = 'alert alert-error'; m.textContent = t('pf.pw.mismatch'); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { m.className = 'alert alert-error'; m.textContent = translateError(error); return; }
    e.currentTarget.reset();
    m.className = 'alert alert-success';
    m.textContent = t('pf.pw.ok');
  });

  // Déconnexion
  container.querySelector('#logout').addEventListener('click', async () => {
    await signOut();
    window.location.hash = '#/accueil';
  });
}

/** Téléphone masqué : seuls les deux derniers chiffres restent visibles. */
function maskPhone(p) {
  const d = String(p || '');
  return d.length > 4 ? '•••• ' + d.slice(-2) : '••••';
}

/** Email masqué : deux premiers caractères puis le domaine. */
function maskEmail(e) {
  const [u = '', dom = ''] = String(e || '').split('@');
  return dom ? `${u.slice(0, 2)}•••@${dom}` : '••••';
}

function renderGuest(container) {
  container.innerHTML = `
    <section class="card placeholder">
      <div class="placeholder-icon">${icon('user')}</div>
      <h1>${escapeHtml(t('prof.title'))}</h1>
      <p>${escapeHtml(t('prof.guest'))}</p>
      <a class="btn btn-primary" href="#/connexion">${escapeHtml(t('auth.login'))}</a>
      <a class="btn btn-ghost" href="#/inscription">${escapeHtml(t('auth.create'))}</a>
    </section>`;
}
