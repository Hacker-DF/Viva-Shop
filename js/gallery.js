/**
 * gallery.js — Défilement en cycle des photos des cartes produit.
 * Un seul minuteur pour toute l'application, quel que soit le nombre de cartes affichées.
 */
let started = false;

export function startGalleryCycle() {
  if (started) return;
  started = true;
  setInterval(() => {
    document.querySelectorAll('[data-cycle]').forEach((el) => {
      const imgs = el.querySelectorAll('img');
      if (imgs.length < 2) return;
      const next = (Number(el.dataset.idx || 0) + 1) % imgs.length;
      el.dataset.idx = String(next);
      imgs.forEach((img, k) => img.classList.toggle('on', k === next));
    });
  }, 2500);
}
