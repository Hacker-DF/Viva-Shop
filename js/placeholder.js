/**
 * placeholder.js — Écran provisoire pour les sections non encore développées.
 * Il indique clairement la phase prévue : aucune fonctionnalité n'est présentée comme opérationnelle.
 */
import { escapeHtml, icon } from './ui.js';

export function render(container, { route }) {
  container.innerHTML = `
    <section class="card placeholder">
      <div class="placeholder-icon">${icon(route.icon)}</div>
      <span class="badge">Phase ${escapeHtml(String(route.phase))}</span>
      <h1>${escapeHtml(route.label)}</h1>
      <p>Cette section sera développée lors de la phase ${escapeHtml(String(route.phase))} du projet.</p>
      <a class="btn btn-ghost" href="#/accueil">Retour à l'accueil</a>
    </section>`;
}
