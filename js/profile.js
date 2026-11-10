/**
 * profile.js — Espace « Mon compte » : profil, rôles, déconnexion.
 * Le contrôle d'accès réel se fait dans Supabase (RLS) ; cet écran n'affiche que ce qui est permis.
 */
import { escapeHtml, icon } from './ui.js';
import { getProfile, updateProfile, getRoleLabels, getRoleCodes, getSession, signOut, translateError } from './auth.js';
import { fieldHtml } from './auth-pages.js';
import { t } from './i18n.js';

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

  const email = (await getSession())?.user?.email || '';
  const roles = await getRoleLabels();
  const codes = await getRoleCodes();
  const isStaff = codes.some((c) => ['administrateur_principal', 'gestionnaire_produits'].includes(c));
  const isFinance = codes.some((c) => ['administrateur_principal', 'agent_financier'].includes(c));
  const isLogistics = codes.some((c) => ['administrateur_principal', 'agent_chine', 'responsable_logistique', 'agent_livraison'].includes(c));
  const isSupport = codes.some((c) => ['administrateur_principal', 'support_client', 'responsable_commandes'].includes(c));
  const initials = `${profile.first_name[0] || ''}${profile.last_name[0] || ''}`;

  container.innerHTML = `
    <section class="card auth">
      <div class="profile-head">
        <div class="avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <div>
          <h1>${escapeHtml(profile.first_name)} ${escapeHtml(profile.last_name)}</h1>
          <small>@${escapeHtml(profile.username)}</small>
        </div>
      </div>
      ${profile.is_suspended ? '<div class="alert alert-error">Votre compte est suspendu : vous ne pouvez plus réserver ni déclarer de paiement. Contactez un assistant.</div>' : ''}
      <p class="roles">${roles.length ? escapeHtml(t('prof.roles', { roles: roles.join(', ') })) : escapeHtml(t('prof.client'))}</p>
      ${isStaff ? '<a class="btn btn-ghost btn-block" href="#/admin">Administration des produits</a>' : ''}
      ${isFinance ? '<a class="btn btn-ghost btn-block" href="#/admin/paiements">Vérification des paiements</a>' : ''}
      ${isLogistics ? '<a class="btn btn-ghost btn-block" href="#/admin/logistique">Logistique</a>' : ''}
      ${isSupport ? '<a class="btn btn-ghost btn-block" href="#/admin/support">Réclamations</a>' : ''}
      ${codes.some((c) => ['administrateur_principal', 'responsable_commandes'].includes(c)) ? '<a class="btn btn-ghost btn-block" href="#/admin/demandes">Demandes spéciales</a>' : ''}

      <section class="personal">
        <h2 class="section-title">${escapeHtml(t('prof.personal'))}</h2>
        <p>Téléphone : <strong id="mask-phone">${escapeHtml(maskPhone(profile.phone))}</strong></p>
        <p>Email : <strong id="mask-email">${escapeHtml(maskEmail(email))}</strong></p>
        <p>Ville : <strong id="mask-city">${profile.city ? '••••••' : '—'}</strong></p>
        <button type="button" id="reveal" class="btn btn-ghost btn-small" data-shown="0">${escapeHtml(t('prof.reveal'))}</button>
      </section>
      <details class="edit-details">
        <summary>${escapeHtml(t('prof.edit'))}</summary>
      <form id="profile-form" novalidate>
        ${fieldHtml({ name: 'first_name', label: 'Prénom', type: 'text', autocomplete: 'given-name', value: profile.first_name })}
        ${fieldHtml({ name: 'last_name', label: 'Nom', type: 'text', autocomplete: 'family-name', value: profile.last_name })}
        ${fieldHtml({ name: 'phone', label: 'Téléphone (WhatsApp)', type: 'tel', autocomplete: 'tel', value: profile.phone })}
        ${fieldHtml({ name: 'city', label: 'Ville (facultatif)', type: 'text', autocomplete: 'address-level2', value: profile.city || '', optional: true })}
        <div class="alert" id="profile-msg" role="status" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">${escapeHtml(t('prof.save'))}</button>
      </form>
      </details>

      <h2 class="section-title">${escapeHtml(t('prof.help'))}</h2>
      <nav class="help-links">
        <a class="btn btn-ghost btn-block" href="#/guide">${icon('file-text')} ${escapeHtml(t('prof.guide'))}</a>
        <a class="btn btn-ghost btn-block" href="#/confidentialite">${icon('lock')} ${escapeHtml(t('prof.privacy'))}</a>
        <a class="btn btn-ghost btn-block" href="#/conditions">${icon('shield')} ${escapeHtml(t('prof.terms'))}</a>
        <a class="btn btn-ghost btn-block" href="#/support">${icon('message')} Signaler un problème</a>
      </nav>
      <button class="btn btn-ghost btn-block" id="logout" type="button">${escapeHtml(t('prof.logout'))}</button>
    </section>`;

  const form = container.querySelector('#profile-form');
  const reveal = container.querySelector('#reveal');
  reveal?.addEventListener('click', () => {
    const shown = reveal.dataset.shown === '1';
    reveal.dataset.shown = shown ? '0' : '1';
    reveal.textContent = t(shown ? 'prof.reveal' : 'prof.hide');
    container.querySelector('#mask-phone').textContent = shown ? maskPhone(profile.phone) : profile.phone;
    container.querySelector('#mask-email').textContent = shown ? maskEmail(email) : email;
    container.querySelector('#mask-city').textContent = shown ? (profile.city || '—') : (profile.city ? '••••••' : '—');
  });
  const msg = container.querySelector('#profile-msg');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const changes = {
      first_name: String(fd.get('first_name')).trim(),
      last_name: String(fd.get('last_name')).trim(),
      phone: String(fd.get('phone')).trim(),
      city: String(fd.get('city')).trim() || null,
    };
    try {
      await updateProfile(changes);
      msg.className = 'alert alert-success';
      msg.textContent = t('prof.saved');
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = translateError(err);
    }
    msg.hidden = false;
  });

  container.querySelector('#logout').addEventListener('click', async () => {
    await signOut();
    window.location.hash = '#/accueil';
  });
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

/** Téléphone masqué : seuls les deux derniers chiffres restent visibles. */
function maskPhone(p) { const d = String(p || ''); return d.length > 4 ? '•••• ' + d.slice(-2) : '••••'; }
/** Email masqué : deux premiers caractères puis le domaine. */
function maskEmail(e) { const [u = '', dom = ''] = String(e || '').split('@'); return dom ? `${u.slice(0, 2)}•••@${dom}` : '••••'; }
