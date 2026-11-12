/**
 * password-eye.js — Ajoute un œil pour afficher ou masquer chaque champ de mot de passe.
 * Détecte aussi les champs ajoutés plus tard à l'écran.
 */
import { t } from './i18n.js';

const EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

function addEye(input) {
  input.dataset.eye = '1';
  const wrap = document.createElement('span');
  wrap.className = 'pw-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pw-eye';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', t('pf.show'));
  btn.innerHTML = EYE;
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', show ? 'true' : 'false');
    btn.setAttribute('aria-label', show ? t('pf.hide') : t('pf.show'));
  });
  wrap.appendChild(btn);
}

function scan() {
  document.querySelectorAll('input[type="password"]:not([data-eye])').forEach(addEye);
}

scan();
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; scan(); });
}).observe(document.body, { childList: true, subtree: true });
