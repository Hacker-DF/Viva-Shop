/**
 * password.js — Demande de réinitialisation du mot de passe (route #/mot-de-passe).
 * Le lien envoyé par email ouvre reset.html, qui permet de choisir le nouveau mot de passe.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { translateError } from './auth.js';
import { t } from './i18n.js';

export function render(container) {
  container.innerHTML = `
    <section class="card auth">
      <h1>${t('pw.title')}</h1>
      <p class="hint">${t('pw.hint')}</p>
      <form id="pw-form" novalidate>
        <div class="field">
          <label for="pw-email">${t('auth.email')}</label>
          <input id="pw-email" name="email" type="email" required autocomplete="email">
        </div>
        <div id="pw-msg" class="alert" role="status" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">${t('pw.send')}</button>
      </form>
      <p class="auth-footer"><a href="#/connexion">${t('pw.back')}</a></p>
    </section>`;

  const msg = container.querySelector('#pw-msg');
  container.querySelector('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    // Adresse absolue de reset.html, à côté de index.html (sans la partie après #)
    const redirectTo = new URL('reset.html', window.location.href.split('#')[0]).href;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    msg.hidden = false;
    if (error) {
      msg.className = 'alert alert-error';
      msg.textContent = translateError(error);
      return;
    }
    // Même message, que le compte existe ou non (ne révèle pas les inscriptions)
    msg.className = 'alert alert-success';
    msg.textContent = t('pw.sent');
  });
}
