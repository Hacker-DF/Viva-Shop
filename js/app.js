/**
 * app.js — Point d'entrée de Viva Shop.
 * Ordre : thème → langue → navigation → routeur → service worker → test de connexion Supabase.
 */
import { APP_CONFIG } from './config.js';
import { buildNav, initRouter, renderCurrent } from './router.js';
import { showBanner, icon } from './ui.js';
import { t, setLang, getLang, onLangChange, LANGUAGES } from './i18n.js';

import { initTheme, toggleTheme, currentTheme } from './theme.js';

const outlet = document.getElementById('app');
const navEl = document.getElementById('bottom-nav');
const statusEl = document.getElementById('connection-status');
const langSelect = document.getElementById('lang-select');
const themeBtn = document.getElementById('theme-toggle');

let lastStatus = 'checking';

/** Indicateur « En ligne / Démo / Hors ligne » dans l'en-tête. */
function setStatus(state) {
  lastStatus = state;
  const labels = { ok: 'status.online', warn: 'status.demo', error: 'status.offline', checking: 'status.checking' };
  statusEl.className = `status status-${state === 'checking' ? '' : state}`;
  statusEl.textContent = t(labels[state]);
}

/** Vérifie la connexion Supabase sans bloquer l'application. */
async function checkBackend() {
  try {
    const { checkConnection } = await import('./supabase.js');
    const result = await checkConnection();
    if (result.ok) setStatus('ok');
    else if (result.reason === 'not-configured') {
      setStatus('warn');
      showBanner('Mode démo : renseignez l’URL et la clé Supabase dans js/config.js.', 'warn');
    } else {
      setStatus('error');
      showBanner('Serveur injoignable pour le moment. Vérifiez votre connexion.', 'error');
    }
  } catch (err) {
    setStatus('error');
    showBanner(`Impossible de charger le service : ${err.message}`, 'error');
  }
}

/** Erreurs non gérées affichées à l'écran (utile sur téléphone, sans console). */
function installErrorBanner() {
  window.addEventListener('error', (e) => showBanner(`Erreur : ${e.message}`, 'error'));
  window.addEventListener('unhandledrejection', (e) =>
    showBanner(`Erreur : ${e.reason?.message || e.reason}`, 'error'));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.error('Service worker non enregistré :', err);
    });
  });
}

/** Sélecteur de langue et bouton de thème de l'en-tête. */
function setupTools() {
  langSelect.innerHTML = LANGUAGES
    .map((l) => `<option value="${l.code}" ${l.code === getLang() ? 'selected' : ''}>${l.name}</option>`).join('');
  langSelect.addEventListener('change', () => setLang(langSelect.value));
  langSelect.setAttribute('aria-label', t('lang.label'));

  const drawThemeIcon = () => {
    themeBtn.innerHTML = icon(currentTheme() === 'dark' ? 'sun' : 'moon');
    themeBtn.setAttribute('aria-label', t('theme.toggle'));
    themeBtn.title = t('theme.toggle');
  };
  themeBtn.addEventListener('click', () => { toggleTheme(); drawThemeIcon(); });
  drawThemeIcon();
}

/** Quand la langue change, on redessine la navigation, l'écran courant et l'indicateur. */
function refreshLanguage() {
  document.documentElement.lang = getLang() === 'ewe' ? 'ee' : getLang();
  langSelect.setAttribute('aria-label', t('lang.label'));
  document.getElementById('brand-slogan').textContent = t('app.slogan');
  buildNav(navEl);
  setStatus(lastStatus);
  renderCurrent(outlet);
}

function boot() {
  document.title = APP_CONFIG.name;
  document.documentElement.lang = getLang() === 'ewe' ? 'ee' : getLang();
  document.getElementById('brand-slogan').textContent = t('app.slogan');
  initTheme();
  installErrorBanner();
  setupTools();
  buildNav(navEl);
  onLangChange(refreshLanguage);
  initRouter(outlet);
  registerServiceWorker();
  setStatus('checking');
  checkBackend();
}

boot();
