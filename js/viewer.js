/**
 * viewer.js — Visionneuse plein écran des photos d'un produit.
 * Appui sur une photo pour l'ouvrir ; glisser à gauche ou à droite, flèches du clavier,
 * ou Échap et clic hors de la photo pour fermer.
 */
import { t } from './i18n.js';

/** Télécharge une photo ; à défaut (réseau ou navigateur), l'ouvre dans un nouvel onglet. */
async function downloadPhoto(url, fileName) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('téléchargement impossible');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

export function openPhotoViewer(urls, start = 0, baseName = 'photo') {
  if (!urls.length) return;
  let index = Math.min(Math.max(start, 0), urls.length - 1);

  const overlay = document.createElement('div');
  overlay.className = 'photo-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <button type="button" class="pv-close" aria-label="${t('pv.close')}">×</button>
    <button type="button" class="pv-download">${t('pv.download')}</button>
    <button type="button" class="pv-nav pv-prev" aria-label="${t('pv.prev')}">‹</button>
    <img alt="">
    <button type="button" class="pv-nav pv-next" aria-label="${t('pv.next')}">›</button>
    <p class="pv-count"></p>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const img = overlay.querySelector('img');
  const count = overlay.querySelector('.pv-count');
  const downloadBtn = overlay.querySelector('.pv-download');
  const prevBtn = overlay.querySelector('.pv-prev');
  const nextBtn = overlay.querySelector('.pv-next');

  const show = () => {
    img.src = urls[index];
    count.textContent = `${index + 1} / ${urls.length}`;
    prevBtn.hidden = nextBtn.hidden = urls.length < 2;
  };
  const go = (step) => { index = (index + step + urls.length) % urls.length; show(); };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };
  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('pv-close')) close();
  });
  downloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const url = urls[index];
    const ext = (url.split('.').pop().split('?')[0] || 'jpg').toLowerCase();
    downloadPhoto(url, `${baseName}-${index + 1}.${ext === 'jpeg' ? 'jpg' : ext}`);
  });
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); go(-1); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); go(1); });

  let startX = null;
  overlay.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  overlay.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('keydown', onKey);
  show();
}
