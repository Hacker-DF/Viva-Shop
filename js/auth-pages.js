/**
 * auth-pages.js — Écrans de connexion et d'inscription.
 */
import { escapeHtml } from './ui.js';
import { signIn, signUp, validateRegistration, translateError, getSession } from './auth.js';
import { t } from './i18n.js';

const loginFields = () => [
  { name: 'email', label: t('auth.email'), type: 'email', autocomplete: 'email' },
  { name: 'password', label: t('auth.password'), type: 'password', autocomplete: 'current-password' },
];

const registerFields = () => [
  { name: 'username', label: t('auth.username'), type: 'text', autocomplete: 'username', hint: t('auth.username.hint') },
  { name: 'first_name', label: t('auth.firstname'), type: 'text', autocomplete: 'given-name' },
  { name: 'last_name', label: t('auth.lastname'), type: 'text', autocomplete: 'family-name' },
  { name: 'phone', label: t('auth.phone'), type: 'tel', autocomplete: 'tel', hint: 'Exemple : +228 90 00 00 00' },
  { name: 'city', label: t('auth.city'), type: 'text', autocomplete: 'address-level2', optional: true },
  { name: 'email', label: t('auth.email'), type: 'email', autocomplete: 'email', hint: t('auth.email.hint') },
  { name: 'password', label: t('auth.password'), type: 'password', autocomplete: 'new-password', hint: t('auth.password.hint') },
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
  if (await getSession()) {
    window.location.hash = '#/compte';
    return;
  }

  if (route.view === 'register') {
    mount(container, {
      title: t('auth.register'),
      fields: registerFields(),
      submitLabel: t('auth.register'),
      footer: `${escapeHtml(t('auth.haveaccount'))} <a href="#/connexion">${escapeHtml(t('auth.login'))}</a>`,
      validate: validateRegistration,
      onSubmit: async (data, msg) => {
        const { session } = await signUp(data);
        if (session) {
          window.location.hash = '#/compte';
          return;
        }
        msg.className = 'alert alert-success';
        msg.textContent = t('auth.confirmmail');
        msg.hidden = false;
      },
    });
    return;
  }

  mount(container, {
    title: t('auth.login'),
    fields: loginFields(),
    submitLabel: t('auth.submit.login'),
    footer: `${escapeHtml(t('auth.noaccount'))} <a href="#/inscription">${escapeHtml(t('auth.create'))}</a><br><a href="#/mot-de-passe">Mot de passe oublié ?</a>`,
    validate: (d) => {
      const errors = {};
      if (!d.email) errors.email = t('auth.email.required');
      if (!d.password) errors.password = t('auth.password.required');
      return errors;
    },
    onSubmit: async (data) => {
      await signIn(data.email.trim(), data.password);
      window.location.hash = '#/compte';
    },
  });
}
