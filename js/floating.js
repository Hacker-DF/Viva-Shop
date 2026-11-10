/**
 * floating.js — Menu flottant WhatsApp, présent sur toutes les pages.
 * Rejoindre la communauté, rejoindre la chaîne, ou écrire à un assistant avec un message préformaté.
 */
import { escapeHtml, icon } from './ui.js';
import { t } from './i18n.js';
import { APP_CONFIG } from './config.js';
import { getProfile } from './auth.js';

const waNumber = (phone) => phone.replace(/\D/g, '');

/** Événement d'installation de l'application (Android, ordinateur), capturé dès le chargement. */
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; });
window.addEventListener('appinstalled', () => { installEvent = null; });

const isIos = /iPhone|iPad/.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

/** Code produit lu dans l'adresse, si l'on est sur une fiche produit. */
function currentProductCode() {
  const m = window.location.hash.match(/^#\/produit\/([^/?]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/** Message préformaté selon le format du cahier des charges. */
function buildMessage(profile, code, concern) {
  return [
    'Bonjour, je souhaite obtenir des informations concernant un produit sur Viva Shop.',
    `Nom : ${profile?.last_name || '[Nom du client]'}`,
    `Prénom : ${profile?.first_name || '[Prénom du client]'}`,
    `Code du produit : ${code || '[Code produit]'}`,
    'Ma préoccupation :',
    concern || '[Écrire votre message ici.]',
  ].join('\n');
}

export function mountFloatingMenu() {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="fab" class="fab" type="button" aria-expanded="false"></button>
    <div id="fab-panel" class="fab-panel" hidden></div>
    <div id="fab-sheet" class="sheet-backdrop" hidden></div>`;
  document.body.appendChild(wrap);

  const fab = wrap.querySelector('#fab');
  const panel = wrap.querySelector('#fab-panel');
  const sheet = wrap.querySelector('#fab-sheet');

  const closePanel = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); };
  const closeSheet = () => { sheet.hidden = true; sheet.innerHTML = ''; };

  fab.innerHTML = icon('message');

  fab.addEventListener('click', () => {
    const open = panel.hidden;
    fab.setAttribute('aria-label', t('fab.open'));
    if (!open) return closePanel();
    panel.innerHTML = `
      <a href="${escapeHtml(APP_CONFIG.whatsapp.communityUrl)}" target="_blank" rel="noopener">${icon('support')} ${escapeHtml(t('fab.community'))}</a>
      <a href="${escapeHtml(APP_CONFIG.whatsapp.channelUrl)}" target="_blank" rel="noopener">${icon('message')} ${escapeHtml(t('fab.channel'))}</a>
      ${APP_CONFIG.whatsapp.assistants.map((a, i) => `
        <button type="button" data-assistant="${i}">${icon('user')} ${escapeHtml(t('fab.assistant', { name: a.name }))}</button>`).join('')}
      ${installEvent ? `<button type="button" data-install="1">${icon('check')} ${escapeHtml(t('fab.install'))}</button>` : ''}
      ${isIos && !isStandalone ? `<p class="hint">${escapeHtml(t('fab.ios'))}</p>` : ''}`;
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
  });

  // Choix d'un assistant : ouverture de la feuille de message
  panel.addEventListener('click', async (e) => {
    if (e.target.closest('button[data-install]') && installEvent) {
      installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      closePanel();
      return;
    }
    const btn = e.target.closest('button[data-assistant]');
    if (!btn) return;
    closePanel();
    const assistant = APP_CONFIG.whatsapp.assistants[Number(btn.dataset.assistant)];
    let profile = null;
    try { profile = await getProfile(); } catch { profile = null; }
    const code = currentProductCode();

    sheet.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <h2>${escapeHtml(t('fab.sheet.title', { name: assistant.name }))}</h2>
        <p class="hint">${escapeHtml(t('fab.sheet.hint'))}</p>
        <textarea id="fab-concern" rows="5" placeholder="${escapeHtml(t('fab.sheet.placeholder'))}"></textarea>
        <button id="fab-send" class="btn btn-primary btn-block" type="button">${escapeHtml(t('fab.sheet.send'))}</button>
        <button id="fab-cancel" class="btn btn-ghost btn-block" type="button">${escapeHtml(t('fab.sheet.cancel'))}</button>
      </div>`;
    sheet.hidden = false;

    sheet.querySelector('#fab-cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#fab-send').addEventListener('click', () => {
      const concern = sheet.querySelector('#fab-concern').value.trim();
      const text = buildMessage(profile, code, concern);
      window.open(`https://wa.me/${waNumber(assistant.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      closeSheet();
    });
  });

  // Fermer en touchant le fond
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
}
