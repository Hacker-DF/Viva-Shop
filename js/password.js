/**
 * password.js — Demande de réinitialisation du mot de passe (route #/mot-de-passe).
 * Le lien envoyé par email ouvre reset.html, qui permet de choisir le nouveau mot de passe.
 */
import { escapeHtml } from './ui.js';
import { supabase } from './supabase.js';
import { translateError } from './auth.js';

export function render(container) {
  container.innerHTML = `
    <section class="card auth">
      <h1>Mot de passe oublié</h1>
      <p class="hint">Saisissez votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
      <form id="pw-form" novalidate>
        <div class="field">
          <label for="pw-email">Email</label>
          <input id="pw-email" name="email" type="email" required autocomplete="email">
        </div>
        <div id="pw-msg" class="alert" role="status" hidden></div>
        <button class="btn btn-primary btn-block" type="submit">Envoyer le lien</button>
      </form>
      <p class="auth-footer"><a href="#/connexion">Retour à la connexion</a></p>
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
    msg.textContent = 'Si un compte existe pour cet email, un lien vient d’être envoyé. Pensez à vérifier vos spams.';
  });
}
