/**
 * auth-pages.js — Écrans de connexion et d'inscription.
 */
import { escapeHtml } from './ui.js';
import { signIn, signUp, validateRegistration, translateError, getSession } from './auth.js';

const LOGIN_FIELDS = [
  { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
  { name: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password' },
];

const REGISTER_FIELDS = [
  { name: 'username', label: 'Nom d’utilisateur', type: 'text', autocomplete: 'username', hint: 'Minuscules, chiffres ou _ (3 à 20)' },
  { name: 'first_name', label: 'Prénom', type: 'text', autocomplete: 'given-name' },
  { name: 'last_name', label: 'Nom', type: 'text', autocomplete: 'family-name' },
  { name: 'phone', label: 'Téléphone (WhatsApp)', type: 'tel', autocomplete: 'tel', hint: 'Exemple : +228 90 00 00 00' },
  { name: 'city', label: 'Ville (facultatif)', type: 'text', autocomplete: 'address-level2', optional: true },
  { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', hint: 'Sert à vous connecter et à réinitialiser votre mot de passe' },
  { name: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'new-password', hint: '8 caractères minimum' },
];

/** Champ de formulaire accessible (libellé, aide, message d'erreur). Exporté pour le profil. */
export function fieldHtml(f) {
  return `
    <div class="field">
      <label for="f-${f.name}">${escapeHtml(f.label)}</label>
      <input id="f-${f.name}" name="${f.name}" type="${f.type}" autocomplete="${f.autocomplete}"
             value="${escapeHtml(f.value ?? '')}" ${f.optional ? '' : 'required'}>
      ${f.hint ? `<small class="hint">${escapeHtml(f.hint)}</small>` : ''}
      <small class="field-error" data-error="${f.name}"></small>
    </div>`;
}

/** Monte un formulaire, gère la validation et les erreurs. */
function mount(container, { title, fields, submitLabel, footer, validate, onSubmit }) {
  container.innerHTML = `
    <section class="card auth">
      <h1>${escapeHtml(title)}</h1>
      <form id="auth-form" novalidate>
        ${fields.map(fieldHtml).join('')}
        <div class="alert alert-error" id="form-msg" role="alert" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">${escapeHtml(submitLabel)}</button>
      </form>
      <p class="auth-footer">${footer}</p>
    </section>`;

  const form = container.querySelector('#auth-form');
  const msg = container.querySelector('#form-msg');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('[data-error]').forEach((el) => { el.textContent = ''; });

    const errors = validate ? validate(data) : {};
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([key, text]) => {
        const el = form.querySelector(`[data-error="${key}"]`);
        if (el) el.textContent = text;
      });
      return;
    }

    submitBtn.disabled = true;
    msg.hidden = true;
    try {
      await onSubmit(data, msg);
    } catch (err) {
      msg.className = 'alert alert-error';
      msg.textContent = translateError(err);
      msg.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

export async function render(container, { route }) {
  // Déjà connecté : pas de raison d'afficher la connexion
  if (await getSession()) {
    window.location.hash = '#/compte';
    return;
  }

  if (route.view === 'register') {
    mount(container, {
      title: 'Créer mon compte',
      fields: REGISTER_FIELDS,
      submitLabel: 'Créer mon compte',
      footer: 'Déjà inscrit ? <a href="#/connexion">Se connecter</a>',
      validate: validateRegistration,
      onSubmit: async (data, msg) => {
        const { session } = await signUp(data);
        if (session) {
          window.location.hash = '#/compte';
          return;
        }
        // Confirmation par email activée dans Supabase : pas de session immédiate
        msg.className = 'alert alert-success';
        msg.textContent = 'Compte créé. Confirmez votre adresse email, puis connectez-vous.';
        msg.hidden = false;
      },
    });
    return;
  }

  mount(container, {
    title: 'Connexion',
    fields: LOGIN_FIELDS,
    submitLabel: 'Se connecter',
    footer: 'Pas encore de compte ? <a href="#/inscription">Créer un compte</a>',
    validate: (d) => {
      const errors = {};
      if (!d.email) errors.email = 'Email requis';
      if (!d.password) errors.password = 'Mot de passe requis';
      return errors;
    },
    onSubmit: async (data) => {
      await signIn(data.email.trim(), data.password);
      window.location.hash = '#/compte';
    },
  });
}
