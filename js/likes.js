/**
 * likes.js — Bouton « J'aime » sur les cartes produit (boutique, favoris, accueil).
 * Utilise la même table que les favoris de la fiche produit.
 * Les boutons sont détectés automatiquement dès qu'ils apparaissent à l'écran.
 */
import { t } from './i18n.js';
import { getSession } from './auth.js';
import { favoriteIdsAmong, setFavorite } from './products.js';

function setLikeState(btn, on) {
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? t('like.remove') : t('like.add'));
}

/** Affiche l'état « aimé » des boutons qui viennent d'apparaître. */
async function hydratePending() {
  const pending = [...document.querySelectorAll('[data-like]:not([data-ready])')];
  if (!pending.length) return;
  pending.forEach((b) => { b.dataset.ready = '1'; });
  const ids = [...new Set(pending.map((b) => b.dataset.like))];
  let favs = [];
  try { favs = await favoriteIdsAmong(ids); } catch { favs = []; }
  pending.forEach((b) => setLikeState(b, favs.includes(b.dataset.like)));
}

let scheduled = false;
new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; hydratePending(); });
}).observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', async (e) => {
  const btn = e.target.closest?.('[data-like]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  if (btn.disabled) return;
  const wasOn = btn.classList.contains('on');
  const session = await getSession();
  if (!session) { window.location.hash = '#/connexion'; return; }
  btn.disabled = true;
  try {
    await setFavorite(btn.dataset.like, wasOn);
    setLikeState(btn, !wasOn);
  } catch {
    // En cas d'échec, le cœur garde son état précédent.
  } finally {
    btn.disabled = false;
  }
});
