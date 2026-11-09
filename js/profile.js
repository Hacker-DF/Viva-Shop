/**
 * profile.js — Espace « Mon compte » : profil, rôles, déconnexion.
 * Le contrôle d'accès réel se fait dans Supabase (RLS) ; cet écran n'affiche que ce qui est permis.
 */
import { escapeHtml, icon } from './ui.js';
import { getProfile, updateProfile, getRoleLabels, getRoleCodes, getSession, signOut, translateError } from './auth.js';
import { fieldHtml } from './auth-pages.js';

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

  const roles = await getRoleLabels();
  const isStaff = (await getRoleCodes()).some((c) => ['administrateur_principal', 'gestionnaire_produits'].includes(c));
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
      <p class="roles">${roles.length ? 'Rôles : ' + roles.map(escapeHtml).join(', ') : 'Compte client'}</p>
      ${isStaff ? '<a class="btn btn-ghost btn-block" href="#/admin">Administration des produits</a>' : ''}

      <form id="profile-form" novalidate>
        ${fieldHtml({ name: 'first_name', label: 'Prénom', type: 'text', autocomplete: 'given-name', value: profile.first_name })}
        ${fieldHtml({ name: 'last_name', label: 'Nom', type: 'text', autocomplete: 'family-name', value: profile.last_name })}
        ${fieldHtml({ name: 'phone', label: 'Téléphone (WhatsApp)', type: 'tel', autocomplete: 'tel', value: profile.phone })}
        ${fieldHtml({ name: 'city', label: 'Ville (facultatif)', type: 'text', autocomplete: 'address-level2', value: profile.city || '', optional: true })}
        <div class="alert" id="profile-msg" role="status" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">Enregistrer</button>
      </form>

      <h2 class="section-title">Aide et informations</h2>
      <nav class="help-links">
        <a class="btn btn-ghost btn-block" href="#/guide">${icon('file-text')} Guide d’utilisation</a>
        <a class="btn btn-ghost btn-block" href="#/confidentialite">${icon('lock')} Politique de confidentialité</a>
        <a class="btn btn-ghost btn-block" href="#/conditions">${icon('shield')} Conditions générales</a>
      </nav>
      <button class="btn btn-ghost btn-block" id="logout" type="button">Se déconnecter</button>
    </section>`;

  const form = container.querySelector('#profile-form');
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
      msg.textContent = 'Profil enregistré.';
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
      <h1>Mon compte</h1>
      <p>Connectez-vous pour gérer votre profil, vos réservations et vos commandes.</p>
      <a class="btn btn-primary" href="#/connexion">Se connecter</a>
      <a class="btn btn-ghost" href="#/inscription">Créer un compte</a>
    </section>`;
}
