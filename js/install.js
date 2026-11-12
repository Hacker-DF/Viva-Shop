/**
 * install.js — Invitation à installer Viva Shop sur le téléphone.
 * Android et ordinateur : bouton « Installer » (le navigateur fournit l'installation).
 * iPhone : pas d'installation automatique, donc une courte explication.
 */
import { t } from './i18n.js';

const DISMISS_KEY = 'vs-install-dismissed';
const WEEK = 7 * 24 * 60 * 60 * 1000;
let deferred = null;
let banner = null;

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const dismissedRecently = () => Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < WEEK;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  show();
});
window.addEventListener('appinstalled', () => { deferred = null; hide(); });

function hide() {
  if (banner) banner.hidden = true;
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  hide();
}

function show() {
  if (isStandalone() || dismissedRecently()) return;
  if (!deferred && !isIos()) return;
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'dialog');
    banner.innerHTML = `
      <strong>${t('ins.title')}</strong>
      <p>${isIos() ? t('ins.ios') : t('ins.text')}</p>
      <div class="install-actions">
        ${deferred ? `<button type="button" class="btn btn-primary btn-small" data-act="install">${t('ins.install')}</button>` : ''}
        <button type="button" class="btn btn-ghost btn-small" data-act="later">${t('ins.later')}</button>
      </div>`;
    banner.addEventListener('click', async (e) => {
      const act = e.target.closest('button[data-act]')?.dataset.act;
      if (act === 'later') return dismiss();
      if (act === 'install' && deferred) {
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        hide();
      }
    });
    document.body.appendChild(banner);
  }
  banner.hidden = false;
}

/** À appeler au démarrage : sur iPhone, l'invitation s'affiche sans événement du navigateur. */
export function initInstall() {
  if (isIos() && !isStandalone() && !dismissedRecently()) setTimeout(show, 4000);
}
